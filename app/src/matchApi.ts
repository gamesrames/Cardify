// Fala com a Edge Function `match` (contrato em docs/partidas-online.md) e tem a conta do relógio.
// Sem imports do React Native de propósito: dá para testar no Node (npm test).
// Os tipos vêm do servidor, que é o dono do contrato. `import type` some na compilação, então o
// empacotador do app nunca precisa ler a pasta supabase/ (só o TypeScript lê, para checar os tipos).
import type { GameViewData, MatchRequest, MatchResponse, MatchViewData } from '../../supabase/src/match/types';

export type { GameViewData, MatchEndCause, MatchRequest, MatchViewData, MatchViewRow, WaitingView } from '../../supabase/src/match/types';

/** Erro com o código do servidor (`not_your_turn`, `stale_state`...) e texto pronto para mostrar. */
export class MatchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'MatchError';
  }
}

export interface CallMatchOptions {
  /** Ex.: https://xxxx.supabase.co (sem barra no fim). */
  baseUrl: string;
  /** Chave pública do projeto (a "publishable"), exigida pelo gateway do Supabase. */
  apiKey: string;
  accessToken: string;
  request: MatchRequest;
  fetchFn?: typeof fetch;
}

export async function callMatch(options: CallMatchOptions): Promise<MatchResponse> {
  const doFetch = options.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${options.baseUrl}/functions/v1/match`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${options.accessToken}`,
        apikey: options.apiKey,
      },
      body: JSON.stringify(options.request),
    });
  } catch {
    throw new MatchError('network', 'Sem conexão com o servidor. Confira a internet e tente de novo.');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (response.status === 200 && isRecord(body) && typeof body.matchId === 'string') {
    return body as unknown as MatchResponse;
  }
  if (isRecord(body) && typeof body.error === 'string') {
    const { error, message, ...extra } = body;
    throw new MatchError(error, typeof message === 'string' ? message : 'Não deu para completar a ação.', extra);
  }
  // Resposta que não é nossa (ex.: a função `match` ainda não foi publicada, ou o gateway recusou o login).
  if (response.status === 404) {
    throw new MatchError('not_deployed', 'O servidor ainda não tem a função de partidas online (publique a função `match`).');
  }
  throw new MatchError('unexpected', `Resposta inesperada do servidor (HTTP ${response.status}).`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ---- Relógio do turno ----

/** Quanto tempo o app espera depois do prazo antes de pedir o estouro (o outro jogador pode estar só atrasado). */
export const TIMEOUT_GRACE_MS = 1500;

/**
 * Diferença entre o relógio do servidor e o do aparelho, medida quando a visão chegou:
 * `servidor ≈ aparelho + offset`. O prazo é do relógio do servidor, então a contagem regressiva usa isto.
 */
export function clockOffsetMs(serverNowMs: number, receivedAtMs: number): number {
  return serverNowMs - receivedAtMs;
}

/** Milissegundos que faltam para o prazo (negativo = já venceu); `null` sem prazo. */
export function msLeft(deadlineMs: number | null, offsetMs: number, nowMs: number): number | null {
  return deadlineMs === null ? null : deadlineMs - (nowMs + offsetMs);
}

/** "0:42"; nunca negativo. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * O app deve pedir ao servidor que aplique o estouro? Só quando a vez é do ADVERSÁRIO e o prazo dele venceu.
 * (Se a vez é minha e voltei atrasado, quero jogar: o servidor aceita a jogada até alguém pedir o estouro.)
 */
export function shouldClaimTimeout(view: GameViewData, offsetMs: number, nowMs: number): boolean {
  if (view.game.winner !== null || view.game.active === view.game.seat) return false;
  const left = msLeft(view.deadlineMs, offsetMs, nowMs);
  return left !== null && left < -TIMEOUT_GRACE_MS;
}

// ---- Visões ----

export interface RowLike {
  version: number;
}

/** Fica com a mais nova entre a que o app tem e a que chegou (o Realtime e a consulta podem chegar fora de ordem). */
export function newerRow<T extends RowLike>(current: T | null, incoming: T): T {
  return current && current.version > incoming.version ? current : incoming;
}

export interface Outcome {
  title: string;
  detail: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** Texto de fim de partida do ponto de vista de quem olha. Só chamar com a partida terminada. */
export function describeOutcome(view: GameViewData): Outcome {
  const { winner } = view.game;
  const cause = view.endCause;
  if (winner === 'draw') return { title: 'Empate', detail: 'Acabou o limite de turnos com a mesma vida.', tone: 'neutral' };
  const won = winner === view.game.seat;
  if (cause === 'forfeit') {
    return won
      ? { title: '🏆 Você venceu!', detail: `${view.foeName ?? 'O adversário'} desistiu.`, tone: 'good' }
      : { title: '🏳️ Você desistiu', detail: 'Desistência conta como derrota.', tone: 'bad' };
  }
  if (cause === 'timeout') {
    return won
      ? { title: '🏆 Você venceu!', detail: `${view.foeName ?? 'O adversário'} perdeu por tempo.`, tone: 'good' }
      : { title: '⏱ Você perdeu por tempo', detail: 'O tempo do seu turno estourou duas vezes seguidas.', tone: 'bad' };
  }
  if (cause === 'abandoned') {
    return won
      ? { title: '🏆 Você venceu!', detail: `${view.foeName ?? 'O adversário'} sumiu da partida.`, tone: 'good' }
      : { title: '⏱ Você perdeu por ausência', detail: 'Ficou tempo demais sem jogar.', tone: 'bad' };
  }
  return won
    ? { title: '🏆 Você venceu!', detail: 'Vida do adversário zerada.', tone: 'good' }
    : { title: '💀 Você perdeu', detail: 'Sua vida chegou a zero.', tone: 'bad' };
}

/** A visão é de uma partida (e não do convite esperando adversário)? */
export function isGame(view: MatchViewData | undefined | null): view is GameViewData {
  return view?.kind === 'game';
}
