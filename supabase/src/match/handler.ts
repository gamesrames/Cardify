import { applyAction, createGame, DEFAULT_RULES, getCard, redactEvents, validateDeck, viewFor } from '../motor';
import type { Action, CardDef, GameEvent, GameState, PlayerIndex } from '../motor';
import type { GameViewData, MatchEndCause, MatchRequest, MatchRow, MatchViewData, WaitingView } from './types';

/**
 * Partidas online 1x1. Cada chamada: lê o estado, aplica UMA ação com o motor (o mesmo código do app
 * contra o bot), grava de forma atômica e devolve a visão de quem chamou. Quem chama só PEDE a ação;
 * o resultado, o sorteio e as regras são do servidor.
 */

/** Tudo que o handler precisa do mundo externo. Nos testes entram versões falsas. */
export interface Deps {
  /** Id do usuário a partir do cabeçalho Authorization (ou null se inválido). */
  getUserId(req: Request): Promise<string | null>;
  /** Chama uma função SQL do banco (`match_*`). Lança Error com a mensagem do banco se ela recusar. */
  rpc(fn: string, args: Record<string, unknown>): Promise<unknown>;
  now(): Date;
  /** Semente de 32 bits sorteada com aleatoriedade criptográfica. */
  randomSeed(): number;
  newId(): string;
  /** Código de convite de 6 caracteres. */
  newCode(): string;
}

/** Alfabeto do código: sem 0/O e 1/I (confundem na hora de digitar). */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;
const LOG_LIMIT = 80;
const CODE_ATTEMPTS = 5;

const ERRORS = {
  unauthorized: [401, 'Entre no app antes de jogar online.'],
  invalid_request: [400, 'Pedido inválido.'],
  invalid_code: [400, 'O código tem 6 letras e números.'],
  code_not_found: [404, 'Não achei essa partida. Confira o código (vale por 15 minutos) ou peça outro.'],
  own_match: [409, 'Esse código é de uma partida criada por você. Passe-o para o seu amigo.'],
  already_in_match: [409, 'Você já está numa partida. Termine ou desista dela antes de começar outra.'],
  deck_missing: [422, 'Monte e salve o seu baralho em "Meu baralho" antes de jogar online.'],
  deck_invalid: [422, 'O seu baralho não é válido.'],
  match_not_found: [404, 'Partida não encontrada.'],
  not_waiting: [409, 'Essa partida já começou: use Desistir.'],
  match_finished: [409, 'Essa partida já terminou.'],
  not_your_turn: [409, 'Não é a sua vez.'],
  stale_state: [409, 'A partida mudou. Atualize a tela e jogue de novo.'],
  illegal_action: [422, 'Jogada não permitida.'],
  not_expired: [409, 'O tempo do turno ainda não acabou.'],
  internal: [500, 'Erro interno na partida.'],
} as const;
export type ErrorCode = keyof typeof ERRORS;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Erro de negócio: vira resposta HTTP com o código e a mensagem em português. */
class Refusal extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly extra: Record<string, unknown> = {},
    public readonly detail?: string,
  ) {
    super(code);
  }
}

function refusal(e: Refusal): Response {
  const [status, message] = ERRORS[e.code];
  return json(status, { error: e.code, message: e.detail ?? message, ...e.extra });
}

interface MatchConfig {
  turn_seconds: number;
  max_missed_turns: number;
  abandon_seconds: number;
}

interface LoadedDeck {
  name: string | null;
  cards: CardDef[];
  /** Caminho da foto de cada carta de foto do baralho. */
  photos: Record<string, string>;
}

/** Baralho salvo na nuvem do jogador, com posse conferida e regras do motor. */
async function loadDeck(deps: Deps, userId: string): Promise<LoadedDeck> {
  const data = (await deps.rpc('match_load_deck', { p_user: userId })) as {
    display_name: string | null;
    card_ids: string[] | null;
    photo_cards: { id: string; name: string; element: CardDef['element']; rarity: CardDef['rarity']; attack: number; health: number; photo_path: string }[];
  };
  if (!data.card_ids || data.card_ids.length === 0) throw new Refusal('deck_missing');
  const photoById = new Map(data.photo_cards.map((c) => [c.id, c]));
  const cards: CardDef[] = [];
  const photos: Record<string, string> = {};
  for (const id of data.card_ids) {
    const photo = photoById.get(id);
    if (photo) {
      cards.push({ id: photo.id, name: photo.name, element: photo.element, rarity: photo.rarity, attack: photo.attack, health: photo.health });
      photos[photo.id] = photo.photo_path;
      continue;
    }
    try {
      cards.push(getCard(id)); // carta fixa do motor
    } catch {
      // Nem fixa, nem uma carta de foto que o jogador possui.
      throw new Refusal('deck_invalid', {}, 'O seu baralho tem uma carta que você não possui. Abra "Meu baralho" e salve de novo.');
    }
  }
  const problems = validateDeck(cards, DEFAULT_RULES);
  if (problems.length > 0) throw new Refusal('deck_invalid', { problems }, `O seu baralho não é válido: ${problems[0]}`);
  return { name: data.display_name, cards, photos };
}

async function loadConfig(deps: Deps): Promise<MatchConfig> {
  return (await deps.rpc('match_config', {})) as MatchConfig;
}

function seatOf(row: MatchRow, userId: string): PlayerIndex | null {
  if (row.host_id === userId) return 0;
  if (row.guest_id === userId) return 1;
  return null;
}

function playerId(row: { host_id: string; guest_id: string | null }, seat: PlayerIndex): string {
  const id = seat === 0 ? row.host_id : row.guest_id;
  if (!id) throw new Error('Partida sem o segundo jogador');
  return id;
}

/** As cartas de um lado que o adversário já viu: em campo ou mortas (já foram jogadas). */
function revealedIds(state: GameState, seat: PlayerIndex): string[] {
  const p = state.players[seat];
  return [...p.field.filter((c) => c !== null).map((c) => c!.card.id), ...p.discard.map((c) => c.id)];
}

function allIds(state: GameState, seat: PlayerIndex): string[] {
  const p = state.players[seat];
  return [...revealedIds(state, seat), ...p.hand.map((c) => c.id), ...p.drawPile.map((c) => c.id)];
}

interface ViewInput {
  matchId: string;
  version: number;
  state: GameState;
  events: GameEvent[]; // TODOS os eventos da partida, na ordem
  hostName: string | null;
  guestName: string | null;
  cardPhotos: Record<string, string>;
  deadline: Date | null;
  missed: [number, number];
  endCause: MatchEndCause | null;
  config: MatchConfig;
  now: Date;
}

/** Visão de cada jogador (jsonb para `match_write_views`) e a lista de fotos do adversário que ele pode ver. */
function buildViews(
  input: ViewInput,
  ids: { host: string; guest: string },
): { rows: unknown[]; byUser: Record<string, GameViewData> } {
  const rows: unknown[] = [];
  const byUser: Record<string, GameViewData> = {};
  for (const seat of [0, 1] as const) {
    const foe: PlayerIndex = seat === 0 ? 1 : 0;
    const userId = seat === 0 ? ids.host : ids.guest;
    const visible = redactEvents(input.events, seat);
    const log = visible.slice(-LOG_LIMIT);
    const photos: Record<string, string> = {};
    for (const id of allIds(input.state, seat)) {
      const path = input.cardPhotos[id];
      if (path) photos[id] = path;
    }
    const foePaths: string[] = [];
    for (const id of revealedIds(input.state, foe)) {
      const path = input.cardPhotos[id];
      if (path) {
        photos[id] = path;
        foePaths.push(path);
      }
    }
    const view: GameViewData = {
      kind: 'game',
      matchId: input.matchId,
      version: input.version,
      serverNowMs: input.now.getTime(),
      deadlineMs: input.deadline ? input.deadline.getTime() : null,
      turnSeconds: input.config.turn_seconds,
      maxMissedTurns: input.config.max_missed_turns,
      missed: seat === 0 ? input.missed : [input.missed[1], input.missed[0]],
      myName: seat === 0 ? input.hostName : input.guestName,
      foeName: seat === 0 ? input.guestName : input.hostName,
      endCause: input.endCause,
      game: viewFor(input.state, seat),
      photos,
      log,
      logStart: visible.length - log.length,
    };
    byUser[userId] = view;
    rows.push({
      player_id: userId,
      seat,
      status: input.state.winner === null ? 'active' : 'finished',
      view,
      photo_paths: foePaths,
    });
  }
  return { rows, byUser };
}

function dbError(e: unknown): string {
  return e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
}

// ---------------------------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------------------------

async function opCreate(deps: Deps, userId: string): Promise<MatchViewData & { matchId: string }> {
  const deck = await loadDeck(deps, userId);
  const matchId = deps.newId();
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = deps.newCode();
    const view: WaitingView = { kind: 'waiting', matchId, code, serverNowMs: deps.now().getTime() };
    try {
      await deps.rpc('match_create', {
        p_match: matchId,
        p_host: userId,
        p_code: code,
        p_deck: deck.cards,
        p_photos: deck.photos,
        p_views: [{ player_id: userId, seat: 0, status: 'waiting', view, photo_paths: [] }],
      });
      return view;
    } catch (e) {
      const msg = dbError(e);
      if (msg.includes('already_in_match')) {
        throw new Refusal('already_in_match', { matchId: await deps.rpc('match_current', { p_user: userId }) });
      }
      if (msg.includes('matches_code_waiting_idx') || msg.includes('duplicate key')) continue; // código repetido: sorteia outro
      throw e;
    }
  }
  throw new Error('Não consegui sortear um código livre');
}

async function opJoin(deps: Deps, userId: string, rawCode: unknown): Promise<GameViewData> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(code)) throw new Refusal('invalid_code');
  const invite = (await deps.rpc('match_by_code', { p_code: code })) as {
    id: string;
    host_id: string;
    host_deck: CardDef[];
    card_photos: Record<string, string>;
    host_name: string | null;
  } | null;
  if (!invite) throw new Refusal('code_not_found');
  if (invite.host_id === userId) throw new Refusal('own_match');

  const deck = await loadDeck(deps, userId);
  let created: ReturnType<typeof createGame>;
  try {
    // O servidor sorteia a semente: ordem das compras e quem começa. Nenhum jogador a vê nem influencia.
    created = createGame(invite.host_deck, deck.cards, deps.randomSeed());
  } catch (e) {
    throw new Refusal('deck_invalid', {}, dbError(e));
  }
  const config = await loadConfig(deps);
  const now = deps.now();
  const deadline = new Date(now.getTime() + config.turn_seconds * 1000);
  const cardPhotos = { ...invite.card_photos, ...deck.photos };
  const { rows, byUser } = buildViews(
    {
      matchId: invite.id,
      version: 1,
      state: created.state,
      events: created.events,
      hostName: invite.host_name,
      guestName: deck.name,
      cardPhotos,
      deadline,
      missed: [0, 0],
      endCause: null,
      config,
      now,
    },
    { host: invite.host_id, guest: userId },
  );
  try {
    await deps.rpc('match_join', {
      p_match: invite.id,
      p_guest: userId,
      p_state: created.state,
      p_events: created.events,
      p_deadline: deadline.toISOString(),
      p_views: rows,
    });
  } catch (e) {
    const msg = dbError(e);
    if (msg.includes('match_not_waiting')) throw new Refusal('code_not_found');
    if (msg.includes('own_match')) throw new Refusal('own_match');
    if (msg.includes('already_in_match')) {
      throw new Refusal('already_in_match', { matchId: await deps.rpc('match_current', { p_user: userId }) });
    }
    throw e;
  }
  return byUser[userId] as GameViewData;
}

interface Applied {
  state: GameState;
  newEvents: GameEvent[];
  cause: MatchEndCause | null;
  deadline: Date;
  missed: [number, number];
}

/** Grava o resultado de uma ação e devolve a visão de `userId`. Lança `stale_state` se outra ação passou na frente. */
async function commit(deps: Deps, row: MatchRow, applied: Applied, userId: string, config: MatchConfig): Promise<GameViewData> {
  const now = deps.now();
  const finished = applied.state.winner !== null;
  const events = [...row.events, ...applied.newEvents];
  const { rows, byUser } = buildViews(
    {
      matchId: row.id,
      version: row.version + 1,
      state: applied.state,
      events,
      hostName: row.host_name,
      guestName: row.guest_name,
      cardPhotos: row.card_photos,
      deadline: finished ? null : applied.deadline,
      missed: applied.missed,
      endCause: applied.cause,
      config,
      now,
    },
    { host: row.host_id, guest: playerId(row, 1) },
  );
  try {
    await deps.rpc('match_apply', {
      p_match: row.id,
      p_expected: row.version,
      p_state: applied.state,
      p_new_events: applied.newEvents,
      p_status: finished ? 'finished' : 'active',
      p_cause: applied.cause,
      p_deadline: applied.deadline.toISOString(),
      p_missed: applied.missed,
      p_views: rows,
    });
  } catch (e) {
    const msg = dbError(e);
    if (msg.includes('stale_state')) throw new Refusal('stale_state');
    if (msg.includes('match_not_active')) throw new Refusal('match_finished');
    throw e;
  }
  return byUser[userId] as GameViewData;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê a partida e confere que `userId` joga nela. Quem não joga recebe o mesmo "não encontrada" de uma que não existe. */
async function readMatch(deps: Deps, matchId: unknown, userId: string): Promise<{ row: MatchRow; seat: PlayerIndex }> {
  if (typeof matchId !== 'string' || !UUID.test(matchId)) throw new Refusal('invalid_request');
  const row = (await deps.rpc('match_get', { p_match: matchId })) as MatchRow | null;
  const seat = row ? seatOf(row, userId) : null;
  if (!row || seat === null) throw new Refusal('match_not_found');
  return { row, seat };
}

async function loadMatch(deps: Deps, matchId: unknown, userId: string): Promise<{ row: MatchRow; seat: PlayerIndex }> {
  const found = await readMatch(deps, matchId, userId);
  if (found.row.status !== 'active' || !found.row.state) throw new Refusal('match_finished');
  return found;
}

/** O criador desiste do convite antes de alguém entrar. Depois que a partida começa, o caminho é desistir. */
async function opCancel(deps: Deps, userId: string, matchId: unknown): Promise<void> {
  const { row, seat } = await readMatch(deps, matchId, userId);
  if (row.status === 'finished') return; // já cancelado: nada a fazer
  if (row.status !== 'waiting' || seat !== 0) throw new Refusal('not_waiting');
  await deps.rpc('match_cancel_waiting', { p_host: userId });
}

/** Jogada ou fim de turno do jogador da vez. A versão evita agir em cima de uma tela velha. */
async function opTurnAction(
  deps: Deps,
  userId: string,
  req: Extract<MatchRequest, { op: 'play' | 'end' }>,
): Promise<GameViewData> {
  if (!Number.isInteger(req.version)) throw new Refusal('invalid_request');
  if (req.op === 'play' && (!Number.isInteger(req.handIndex) || !Number.isInteger(req.slot))) {
    throw new Refusal('invalid_request');
  }
  const { row, seat } = await loadMatch(deps, req.matchId, userId);
  if (row.version !== req.version) throw new Refusal('stale_state');
  const state = row.state as GameState;
  if (state.active !== seat) throw new Refusal('not_your_turn');

  const action: Action =
    req.op === 'play' ? { type: 'play', handIndex: req.handIndex, slot: req.slot } : { type: 'end' };
  let result: ReturnType<typeof applyAction>;
  try {
    result = applyAction(state, action);
  } catch {
    throw new Refusal('illegal_action');
  }
  const config = await loadConfig(deps);
  const missed: [number, number] = [row.missed_turns[0], row.missed_turns[1]];
  missed[seat] = 0; // jogou: zera a contagem de turnos estourados
  // Jogar uma carta NÃO dá tempo novo; só passar o turno abre o relógio do próximo jogador.
  const passed = req.op === 'end';
  const deadline = passed
    ? new Date(deps.now().getTime() + config.turn_seconds * 1000)
    : new Date(row.turn_deadline ?? deps.now().getTime());
  return commit(
    deps,
    row,
    {
      state: result.state,
      newEvents: result.events,
      cause: result.state.winner !== null ? (result.state.endReason as MatchEndCause) : null,
      deadline,
      missed,
    },
    userId,
    config,
  );
}

/** Desistir vale a qualquer momento (até fora da vez), sem exigir a versão: nunca deve falhar por tela velha. */
async function opForfeit(deps: Deps, userId: string, matchId: unknown): Promise<GameViewData> {
  for (let attempt = 0; ; attempt++) {
    const { row, seat } = await loadMatch(deps, matchId, userId);
    const result = applyAction(row.state as GameState, { type: 'forfeit', player: seat });
    try {
      return await commit(
        deps,
        row,
        { state: result.state, newEvents: result.events, cause: 'forfeit', deadline: deps.now(), missed: row.missed_turns },
        userId,
        await loadConfig(deps),
      );
    } catch (e) {
      if (e instanceof Refusal && e.code === 'stale_state' && attempt < 2) continue; // outra ação passou na frente: lê de novo
      throw e;
    }
  }
}

/**
 * Tempo do turno estourado. Qualquer um dos dois jogadores pode pedir; o servidor confere o relógio dele.
 *  - 1º estouro (e demais antes do limite): o turno passa sozinho, sem jogada.
 *  - `max_missed_turns` estouros seguidos, ou turno vencido há mais de `abandon_seconds` (sumiu):
 *    o jogador da vez perde, pelo mesmo desfecho `forfeit` do motor.
 */
async function opTimeout(deps: Deps, userId: string, matchId: unknown): Promise<GameViewData> {
  for (let attempt = 0; ; attempt++) {
    const { row } = await loadMatch(deps, matchId, userId);
    const state = row.state as GameState;
    const config = await loadConfig(deps);
    const now = deps.now();
    const deadline = row.turn_deadline ? new Date(row.turn_deadline) : null;
    if (!deadline || now.getTime() < deadline.getTime()) {
      throw new Refusal('not_expired', { remainingMs: deadline ? deadline.getTime() - now.getTime() : null });
    }
    const late = state.active;
    const overdueMs = now.getTime() - deadline.getTime();
    const missed: [number, number] = [row.missed_turns[0], row.missed_turns[1]];
    missed[late] += 1;
    const abandoned = overdueMs > config.abandon_seconds * 1000;
    let applied: Applied;
    if (abandoned || missed[late] >= config.max_missed_turns) {
      const result = applyAction(state, { type: 'forfeit', player: late });
      applied = { state: result.state, newEvents: result.events, cause: abandoned ? 'abandoned' : 'timeout', deadline: now, missed };
    } else {
      const result = applyAction(state, { type: 'end' });
      const finished = result.state.winner !== null; // o fim de turno pode encerrar por limite de turnos
      applied = {
        state: result.state,
        newEvents: result.events,
        cause: finished ? (result.state.endReason as MatchEndCause) : null,
        deadline: new Date(now.getTime() + config.turn_seconds * 1000),
        missed,
      };
    }
    try {
      return await commit(deps, row, applied, userId, config);
    } catch (e) {
      if (e instanceof Refusal && e.code === 'stale_state' && attempt < 2) continue;
      throw e;
    }
  }
}

/**
 * Corpo (JSON): { op: 'create' } | { op: 'join', code } | { op: 'play', matchId, version, handIndex, slot }
 * | { op: 'end', matchId, version } | { op: 'forfeit', matchId } | { op: 'timeout', matchId } | { op: 'cancel', matchId }.
 * Resposta 200: { matchId, view } com a visão nova de quem chamou (view = null em `cancel`).
 */
export async function handleMatch(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return refusal(new Refusal('invalid_request'));
  try {
    const userId = await deps.getUserId(req);
    if (!userId) return refusal(new Refusal('unauthorized'));

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return refusal(new Refusal('invalid_request'));
    }
    let view: MatchViewData;
    switch (body.op) {
      case 'cancel':
        await opCancel(deps, userId, body.matchId);
        return json(200, { matchId: body.matchId, view: null });
      case 'create':
        view = await opCreate(deps, userId);
        break;
      case 'join':
        view = await opJoin(deps, userId, body.code);
        break;
      case 'play':
      case 'end':
        view = await opTurnAction(deps, userId, body as unknown as Extract<MatchRequest, { op: 'play' | 'end' }>);
        break;
      case 'forfeit':
        view = await opForfeit(deps, userId, body.matchId);
        break;
      case 'timeout':
        view = await opTimeout(deps, userId, body.matchId);
        break;
      default:
        return refusal(new Refusal('invalid_request'));
    }
    return json(200, { matchId: view.matchId, view });
  } catch (e) {
    if (e instanceof Refusal) return refusal(e);
    console.error('match: erro interno', dbError(e));
    return refusal(new Refusal('internal'));
  }
}
