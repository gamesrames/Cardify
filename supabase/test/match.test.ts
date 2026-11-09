import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleMatch } from '../src/match/handler';
import type { GameViewData, MatchViewData } from '../src/match/types';
import { addPhotoCard, GUEST_DECK, HOST_DECK, matchDepsOn, post, saveDeck, U1, U2, U3 } from './matchDeps';
import type { Clock } from './matchDeps';

// Fluxo completo da Edge Function `match` contra o banco REAL (migrações em memória) e o motor real.
const PHOTO_CARD = 'bbbbbbbb-0000-4000-8000-000000000001';

let db: PGlite;
let clock: Clock;
let ctx: ReturnType<typeof matchDepsOn>;

beforeEach(async () => {
  const { newMatchDb } = await import('./matchDeps');
  db = await newMatchDb();
  clock = { ms: Date.parse('2026-11-10T12:00:00Z'), advance(s) { this.ms += s * 1000; } };
  ctx = matchDepsOn(db, clock);
  await db.exec(`update profiles set display_name = 'Rames' where id = '${U1}'; update profiles set display_name = 'Amigo' where id = '${U2}'`);
  await addPhotoCard(db, PHOTO_CARD, U1);
  // O criador usa uma carta de foto no lugar de 'ar-pardal'.
  await saveDeck(db, U1, [...HOST_DECK.slice(0, 6), PHOTO_CARD]);
  await saveDeck(db, U2, GUEST_DECK);
});

type Reply = { status: number; body: Record<string, any> };
async function call(user: string, body: Record<string, unknown>): Promise<Reply> {
  ctx.caller.user = user;
  const res = await handleMatch(post(body), ctx.deps);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

/** Linha de match_views do jogador, lida como o app lê (papel authenticated, RLS valendo). */
async function myView(user: string, matchId: string): Promise<{ version: number; status: string; view: MatchViewData; photo_paths: string[] }> {
  const { as } = await import('./matchDeps');
  const rows = await as(db, user, () =>
    db.query<any>(`select version, status, view, photo_paths from match_views where match_id = $1`, [matchId]),
  );
  return rows.rows[0];
}

async function startMatch() {
  const created = await call(U1, { op: 'create' });
  const joined = await call(U2, { op: 'join', code: created.body.view.code });
  return { matchId: created.body.matchId as string, code: created.body.view.code as string, joined, created };
}

const gameOf = (r: Reply) => r.body.view as GameViewData;

describe('criar e entrar', () => {
  it('criar devolve um código de 6 caracteres e o criador enxerga a própria sala de espera', async () => {
    const r = await call(U1, { op: 'create' });
    expect(r.status).toBe(200);
    expect(r.body.view.kind).toBe('waiting');
    expect(r.body.view.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const row = await myView(U1, r.body.matchId);
    expect(row.status).toBe('waiting');
    expect(row.view).toMatchObject({ kind: 'waiting', code: r.body.view.code });
  });

  it('entrar com o código (em minúsculas, com espaços) começa a partida e os dois recebem a visão deles', async () => {
    const created = await call(U1, { op: 'create' });
    const joined = await call(U2, { op: 'join', code: ` ${String(created.body.view.code).toLowerCase()} ` });
    expect(joined.status).toBe(200);
    const guest = gameOf(joined);
    expect(guest.kind).toBe('game');
    expect(guest.game.seat).toBe(1);
    expect(guest.myName).toBe('Amigo');
    expect(guest.foeName).toBe('Rames');
    expect(guest.deadlineMs).toBe(clock.ms + 60_000);
    expect(guest.game.me.hand).toHaveLength(3);
    // quem joga depois só compra no começo do turno dele: o adversário tem 3 na mão se foi ele quem abriu
    expect(guest.game.foe.handCount).toBe(guest.game.firstPlayer === 0 ? 3 : 0);

    const host = (await myView(U1, created.body.matchId)).view as GameViewData; // a visão do criador chegou pela tabela
    expect(host.kind).toBe('game');
    expect(host.game.seat).toBe(0);
    expect(host.game.firstPlayer).toBe(guest.game.firstPlayer);
    expect(host.foeName).toBe('Amigo');
  });

  it('o criador não entra no próprio convite; código inexistente, malformado, já usado e vencido são recusados', async () => {
    const { code } = await startMatch();
    const c = await call(U1, { op: 'create' }).catch(() => null);
    expect(c?.status).toBe(409); // U1 já está numa partida em andamento
    expect(c?.body.error).toBe('already_in_match');
    expect((await call(U3, { op: 'join', code })).body.error).toBe('code_not_found'); // já usado
    expect((await call(U3, { op: 'join', code: 'ZZZZZ9' })).status).toBe(404);
    expect((await call(U3, { op: 'join', code: 'abc' })).body.error).toBe('invalid_code');
    expect((await call(U3, { op: 'join', code: 'OOOOOO' })).body.error).toBe('invalid_code'); // O e 0 não existem no alfabeto
  });

  it('não dá para entrar no próprio convite, e convite com mais de 15 minutos vence', async () => {
    await saveDeck(db, U3, GUEST_DECK);
    const a = await call(U1, { op: 'create' });
    const own = await call(U1, { op: 'join', code: a.body.view.code });
    expect(own.body.error).toBe('own_match');
    await db.exec(`update matches set created_at = now() - interval '16 minutes'`);
    expect((await call(U3, { op: 'join', code: a.body.view.code })).body.error).toBe('code_not_found');
  });

  it('criar de novo cancela o convite anterior', async () => {
    const a = await call(U1, { op: 'create' });
    const b = await call(U1, { op: 'create' });
    expect(b.body.view.code).not.toBe(a.body.view.code);
    expect((await call(U2, { op: 'join', code: a.body.view.code })).body.error).toBe('code_not_found');
    expect((await myView(U1, a.body.matchId)).status).toBe('finished');
    expect((await call(U2, { op: 'join', code: b.body.view.code })).status).toBe(200);
  });

  it('o criador pode cancelar o convite; depois ninguém entra', async () => {
    const a = await call(U1, { op: 'create' });
    expect((await call(U1, { op: 'cancel', matchId: a.body.matchId })).status).toBe(200);
    expect((await call(U2, { op: 'join', code: a.body.view.code })).body.error).toBe('code_not_found');
    expect((await call(U2, { op: 'cancel', matchId: a.body.matchId })).status).toBe(404); // não é dele
  });

  it('sem baralho salvo, ou com carta que o jogador não possui, ou ilegal pelas regras: recusa com motivo', async () => {
    expect((await call(U3, { op: 'create' })).body.error).toBe('deck_missing');
    // carta de foto do U1 no baralho do U3
    await saveDeck(db, U3, [PHOTO_CARD, ...GUEST_DECK.slice(0, 6)]);
    const stolen = await call(U3, { op: 'create' });
    expect(stolen.status).toBe(422);
    expect(stolen.body.error).toBe('deck_invalid');
    // 7 lendárias passam do limite de poder
    await db.exec(`delete from decks where owner_id = '${U3}'`);
    await saveDeck(db, U3, ['fogo-fenix', 'planta-ent', 'agua-baleia', 'fogo-leao', 'planta-urso', 'agua-tubarao', 'fogo-tigre']);
    const heavy = await call(U3, { op: 'create' });
    expect(heavy.body.error).toBe('deck_invalid');
    expect(heavy.body.message).toMatch(/limite/);
  });

  it('exige login e aceita só POST com JSON válido', async () => {
    const res = await handleMatch(post({ op: 'create' }, 'Bearer errado'), ctx.deps);
    expect(res.status).toBe(401);
    ctx.caller.user = U1;
    expect((await handleMatch(new Request('http://local/match', { method: 'GET' }), ctx.deps)).status).toBe(400);
    expect((await call(U1, { op: 'inventado' })).status).toBe(400);
    expect((await call(U1, { op: 'play', matchId: 'nao-e-uuid', version: 1, handIndex: 0, slot: 0 })).status).toBe(400);
  });
});

describe('segredo da mão e do monte', () => {
  it('a visão de cada jogador não contém nenhuma carta do outro baralho nem o estado do sorteio', async () => {
    const { matchId } = await startMatch();
    const host = JSON.stringify((await myView(U1, matchId)).view);
    const guest = JSON.stringify((await myView(U2, matchId)).view);
    for (const id of GUEST_DECK) expect(host).not.toContain(id);
    for (const id of HOST_DECK.slice(0, 6)) expect(guest).not.toContain(id);
    expect(guest).not.toContain(PHOTO_CARD);
    for (const text of [host, guest]) {
      expect(text).not.toContain('rngState');
      expect(text).not.toContain('drawPile');
    }
    // a foto da carta escondida também não é anunciada ao adversário
    expect((await myView(U2, matchId)).photo_paths).toEqual([]);
  });
});

describe('jogadas', () => {
  async function activeAndWaiting() {
    const s = await startMatch();
    const first = gameOf(s.joined).game.firstPlayer;
    const [active, other] = first === 1 ? [U2, U1] : [U1, U2];
    return { ...s, active, other };
  }

  it('o jogador da vez joga uma carta pelas ações que a visão lista; a versão sobe e o relógio não reinicia', async () => {
    const { matchId, active } = await activeAndWaiting();
    const before = (await myView(active, matchId)).view as GameViewData;
    const play = before.game.legal.find((a) => a.type === 'play')!;
    expect(play).toBeTruthy();
    const r = await call(active, { op: 'play', matchId, version: before.version, ...play });
    expect(r.status).toBe(200);
    const after = gameOf(r);
    expect(after.version).toBe(before.version + 1);
    expect(after.deadlineMs).toBe(before.deadlineMs);
    expect(after.game.me.hand).toHaveLength(before.game.me.hand.length - 1);
    expect(after.game.me.field.filter((c) => c !== null)).toHaveLength(1);
  });

  it('fora da vez, versão velha, jogada ilegal e ação em partida alheia são recusadas', async () => {
    const { matchId, active, other } = await activeAndWaiting();
    const v = ((await myView(active, matchId)).view as GameViewData).version;
    expect((await call(other, { op: 'end', matchId, version: v })).body.error).toBe('not_your_turn');
    expect((await call(active, { op: 'end', matchId, version: v - 1 })).body.error).toBe('stale_state');
    expect((await call(active, { op: 'play', matchId, version: v, handIndex: 9, slot: 0 })).body.error).toBe('illegal_action');
    expect((await call(active, { op: 'play', matchId, version: v, handIndex: 0, slot: 7 })).body.error).toBe('illegal_action');
    expect((await call(active, { op: 'play', matchId, version: 'x', handIndex: 0, slot: 0 })).status).toBe(400);
    expect((await call(U3, { op: 'end', matchId, version: v })).status).toBe(404);
    // nada disso mudou a partida
    expect(((await myView(active, matchId)).view as GameViewData).version).toBe(v);
  });

  it('encerrar o turno passa a vez, zera o relógio do próximo e mostra os ataques ao adversário', async () => {
    const { matchId, active, other } = await activeAndWaiting();
    const v = ((await myView(active, matchId)).view as GameViewData).version;
    clock.advance(10);
    const r = await call(active, { op: 'end', matchId, version: v });
    expect(r.status).toBe(200);
    const theirs = (await myView(other, matchId)).view as GameViewData;
    expect(theirs.game.active).toBe(theirs.game.seat);
    expect(theirs.deadlineMs).toBe(clock.ms + 60_000);
    expect(theirs.game.legal.length).toBeGreaterThan(0);
    // o log do adversário não revela as cartas que o outro comprou
    const draws = theirs.log.filter((e) => e.type === 'draw');
    expect(draws.every((e) => e.type === 'draw' && e.player === theirs.game.seat)).toBe(true);
  });

  it('duas jogadas ao mesmo tempo com a mesma versão: só uma passa', async () => {
    const { matchId, active } = await activeAndWaiting();
    const view = (await myView(active, matchId)).view as GameViewData;
    const plays = view.game.legal.filter((a) => a.type === 'play');
    const [a, b] = await Promise.all([
      call(active, { op: 'play', matchId, version: view.version, ...plays[0] }),
      call(active, { op: 'play', matchId, version: view.version, ...plays[1] }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it('uma partida inteira até o fim: motor decide, banco e visões ficam coerentes, fotos só do que foi jogado', async () => {
    const { matchId } = await startMatch();
    const paths = (await db.query<{ photo_path: string }>(`select photo_path from cards where id = '${PHOTO_CARD}'`)).rows.map((r) => r.photo_path);
    let guard = 0;
    let finished: GameViewData | null = null;
    let sawReveal = false;
    while (guard++ < 400) {
      // em sequência: `as` troca o papel da conexão, então duas leituras ao mesmo tempo se atrapalhariam
      const rows = [await myView(U1, matchId), await myView(U2, matchId)];
      const active = rows.find((r) => (r.view as GameViewData).game.legal.length > 0);
      if (!active) break;
      const user = rows[0] === active ? U1 : U2;
      const v = active.view as GameViewData;
      // invariante de privacidade: o adversário só tem o caminho da foto depois que a carta foi jogada
      const host = rows[0]!.view as GameViewData;
      const guestRow = rows[1]!;
      const revealed = [...host.game.me.field.filter((c) => c !== null).map((c) => c!.card.id), ...host.game.me.discard.map((c) => c.id)];
      expect(guestRow.photo_paths).toEqual(revealed.includes(PHOTO_CARD) ? paths : []);
      sawReveal ||= revealed.includes(PHOTO_CARD);
      const play = v.game.legal.find((a) => a.type === 'play');
      const r = await call(user, play ? { op: 'play', matchId, version: v.version, ...play } : { op: 'end', matchId, version: v.version });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      if (gameOf(r).game.winner !== null) {
        finished = gameOf(r);
        break;
      }
    }
    expect(finished).not.toBeNull();
    expect(sawReveal, 'a carta de foto foi jogada em algum momento (o teste de privacidade valeu)').toBe(true);
    expect(['hp_zero', 'turn_limit']).toContain(finished!.endCause);
    expect(finished!.deadlineMs).toBeNull();
    const row = (await db.query<any>(`select status, end_cause, turn_deadline, jsonb_array_length(events) n from matches where id = $1`, [matchId])).rows[0];
    expect(row).toMatchObject({ status: 'finished', end_cause: finished!.endCause, turn_deadline: null });
    expect(row.n).toBeGreaterThan(10);
    for (const u of [U1, U2]) expect((await myView(u, matchId)).status).toBe('finished');
    // depois do fim, nada mais é aceito, e o jogador pode começar outra partida
    expect((await call(U1, { op: 'end', matchId, version: 99 })).body.error).toBe('match_finished');
    expect((await call(U1, { op: 'create' })).status).toBe(200);
  });
});

describe('desistir', () => {
  it('quem não é da vez também desiste: o motor encerra com forfeit e o outro vence', async () => {
    const { matchId, joined } = await startMatch();
    const first = gameOf(joined).game.firstPlayer;
    const idle = first === 0 ? U2 : U1; // o que NÃO é da vez
    const r = await call(idle, { op: 'forfeit', matchId });
    expect(r.status).toBe(200);
    const v = gameOf(r);
    expect(v.game.winner).toBe(first);
    expect(v.game.endReason).toBe('forfeit');
    expect(v.endCause).toBe('forfeit');
    const other = (await myView(idle === U1 ? U2 : U1, matchId)).view as GameViewData;
    expect(other.game.winner).toBe(first);
    expect(other.log.at(-1)).toMatchObject({ type: 'game_over', reason: 'forfeit' });
    expect((await call(idle, { op: 'forfeit', matchId })).body.error).toBe('match_finished');
  });
});

describe('tempo do turno', () => {
  async function started() {
    const s = await startMatch();
    const first = gameOf(s.joined).game.firstPlayer;
    return { ...s, first, active: first === 0 ? U1 : U2, other: first === 0 ? U2 : U1 };
  }
  const row = async (id: string) => (await db.query<any>(`select status, end_cause, version, missed_turns from matches where id = $1`, [id])).rows[0];

  it('antes do prazo o servidor recusa; depois, o turno passa sozinho e o adversário pode pedir', async () => {
    const { matchId, active, other } = await started();
    clock.advance(30);
    const early = await call(other, { op: 'timeout', matchId });
    expect(early.status).toBe(409);
    expect(early.body.error).toBe('not_expired');
    expect(early.body.remainingMs).toBe(30_000);
    clock.advance(31);
    const r = await call(other, { op: 'timeout', matchId });
    expect(r.status).toBe(200);
    const v = gameOf(r);
    expect(v.game.active).toBe(v.game.seat); // agora é a vez de quem pediu
    expect(v.deadlineMs).toBe(clock.ms + 60_000);
    expect(v.missed).toEqual([0, 1]); // [eu, adversário]: o adversário estourou uma vez
    expect(((await myView(active, matchId)).view as GameViewData).missed).toEqual([1, 0]);
    // o mesmo pedido de novo (o outro cliente também contou o tempo) não faz nada
    expect((await call(active, { op: 'timeout', matchId })).body.error).toBe('not_expired');
  });

  it('dois estouros seguidos do mesmo jogador = derrota por tempo, pelo desfecho forfeit do motor', async () => {
    const { matchId, active, other } = await started();
    clock.advance(61);
    await call(other, { op: 'timeout', matchId }); // active estourou 1
    // other joga e passa a vez
    const mine = (await myView(other, matchId)).view as GameViewData;
    await call(other, { op: 'end', matchId, version: mine.version });
    clock.advance(61);
    const r = await call(other, { op: 'timeout', matchId }); // active estourou 2
    expect(r.status).toBe(200);
    const v = gameOf(r);
    expect(v.game.winner).toBe(v.game.seat);
    expect(v.game.endReason).toBe('forfeit');
    expect(v.endCause).toBe('timeout');
    expect((await row(matchId)).status).toBe('finished');
    void active;
  });

  it('jogar zera a contagem: estourar, jogar e estourar de novo não derruba', async () => {
    const { matchId, active, other } = await started();
    clock.advance(61);
    await call(other, { op: 'timeout', matchId }); // active: 1 estouro
    let v = ((await myView(other, matchId)).view as GameViewData).version;
    await call(other, { op: 'end', matchId, version: v });
    v = ((await myView(active, matchId)).view as GameViewData).version;
    await call(active, { op: 'end', matchId, version: v }); // active jogou: zera
    v = ((await myView(other, matchId)).view as GameViewData).version;
    await call(other, { op: 'end', matchId, version: v });
    clock.advance(61);
    const r = await call(other, { op: 'timeout', matchId });
    expect(gameOf(r).game.winner).toBeNull(); // 1 estouro, não 2
    expect(gameOf(r).missed).toEqual([0, 1]);
  });

  it('sumiu por mais de 5 minutos: perde na hora (abandono), sem esperar o segundo estouro', async () => {
    const { matchId, other } = await started();
    clock.advance(60 + 301);
    const r = await call(other, { op: 'timeout', matchId });
    expect(gameOf(r).endCause).toBe('abandoned');
    expect(gameOf(r).game.endReason).toBe('forfeit');
  });

  it('quem não joga a partida não consegue mexer no relógio dela', async () => {
    const { matchId } = await started();
    clock.advance(400);
    expect((await call(U3, { op: 'timeout', matchId })).status).toBe(404);
    expect((await row(matchId)).status).toBe('active');
  });
});
