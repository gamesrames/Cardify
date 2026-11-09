import { describe, expect, it } from 'vitest';
import { describeEvent } from '../src/describeEvent';
import {
  callMatch,
  clockOffsetMs,
  describeOutcome,
  formatClock,
  MatchError,
  msLeft,
  newerRow,
  shouldClaimTimeout,
  TIMEOUT_GRACE_MS,
} from '../src/matchApi';
import type { GameViewData } from '../src/matchApi';

const base = { baseUrl: 'https://x.supabase.co', apiKey: 'pub', accessToken: 'tok' };

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe('callMatch', () => {
  it('manda o pedido com os cabeçalhos certos e devolve a resposta', async () => {
    const reply = { matchId: 'm1', view: { kind: 'waiting', matchId: 'm1', code: 'ABC234', serverNowMs: 1 } };
    const { fetchFn, calls } = fakeFetch(200, reply);
    await expect(callMatch({ ...base, request: { op: 'create' }, fetchFn })).resolves.toEqual(reply);
    expect(calls[0]!.url).toBe('https://x.supabase.co/functions/v1/match');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok');
    expect(headers.apikey).toBe('pub');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ op: 'create' });
  });

  it('erro do servidor vira MatchError com o código, a mensagem e os dados extras (matchId)', async () => {
    const { fetchFn } = fakeFetch(409, { error: 'already_in_match', message: 'Você já está numa partida.', matchId: 'm9' });
    const err = await callMatch({ ...base, request: { op: 'create' }, fetchFn }).catch((e) => e);
    expect(err).toBeInstanceOf(MatchError);
    expect(err).toMatchObject({ code: 'already_in_match', message: 'Você já está numa partida.', extra: { matchId: 'm9' } });
  });

  it('função ainda não publicada (404 do gateway) tem mensagem própria', async () => {
    const { fetchFn } = fakeFetch(404, 'Function not found');
    await expect(callMatch({ ...base, request: { op: 'create' }, fetchFn })).rejects.toMatchObject({ code: 'not_deployed' });
  });

  it('falha de rede vira "network"; resposta estranha vira "unexpected"', async () => {
    const boom = (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;
    await expect(callMatch({ ...base, request: { op: 'create' }, fetchFn: boom })).rejects.toMatchObject({ code: 'network' });
    const { fetchFn } = fakeFetch(401, 'Invalid JWT');
    await expect(callMatch({ ...base, request: { op: 'create' }, fetchFn })).rejects.toMatchObject({ code: 'unexpected' });
  });
});

describe('relógio do turno', () => {
  it('corrige a diferença entre o relógio do servidor e o do aparelho', () => {
    // o aparelho está 5 s ATRASADO em relação ao servidor
    const offset = clockOffsetMs(105_000, 100_000);
    expect(offset).toBe(5_000);
    // o prazo é 160 s (servidor) e o aparelho marca 110 s: faltam 160 - (110 + 5) = 45 s
    expect(msLeft(160_000, offset, 110_000)).toBe(45_000);
    expect(msLeft(null, offset, 0)).toBeNull();
  });

  it('mostra minutos e segundos, nunca negativo', () => {
    expect(formatClock(42_100)).toBe('0:43');
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(-5_000)).toBe('0:00');
  });
});

function game(over: Partial<GameViewData['game']> = {}, rest: Partial<GameViewData> = {}): GameViewData {
  return {
    kind: 'game', matchId: 'm', version: 3, serverNowMs: 1_000, deadlineMs: 61_000, turnSeconds: 60, maxMissedTurns: 2,
    missed: [0, 0], myName: 'Eu', foeName: 'Ana', endCause: null, photos: {}, log: [], logStart: 0,
    game: { seat: 0, active: 1, winner: null, endReason: null, turn: 4, firstPlayer: 0, energy: 3, legal: [], ...over } as GameViewData['game'],
    ...rest,
  };
}

describe('shouldClaimTimeout', () => {
  it('só pede quando a vez é do adversário e o prazo venceu há mais que a tolerância', () => {
    const v = game(); // vez do lado 1; eu sou o lado 0; prazo em 61 s
    expect(shouldClaimTimeout(v, 0, 61_000 + TIMEOUT_GRACE_MS - 1)).toBe(false); // venceu agora há pouco
    expect(shouldClaimTimeout(v, 0, 61_000 + TIMEOUT_GRACE_MS + 1)).toBe(true);
  });
  it('na minha vez nunca pede (quem voltou atrasado quer jogar) e partida acabada também não', () => {
    expect(shouldClaimTimeout(game({ active: 0 }), 0, 999_999)).toBe(false);
    expect(shouldClaimTimeout(game({ winner: 1 }), 0, 999_999)).toBe(false);
  });
  it('respeita a diferença de relógio: aparelho adiantado não dispara antes da hora', () => {
    const v = game();
    // o aparelho está 10 s ADIANTADO: offset = -10 s. No aparelho 70 s = servidor 60 s: ainda não venceu.
    expect(shouldClaimTimeout(v, -10_000, 70_000)).toBe(false);
  });
});

describe('newerRow', () => {
  it('não troca uma visão nova por uma velha que chegou atrasada', () => {
    const a = { version: 5, id: 'a' };
    const b = { version: 4, id: 'b' };
    expect(newerRow(a, b)).toBe(a);
    expect(newerRow(b, a)).toBe(a);
    expect(newerRow(null, b)).toBe(b);
  });
});

describe('describeOutcome', () => {
  it('desistência, tempo e ausência, de cada ponto de vista', () => {
    const won = (cause: GameViewData['endCause']) => describeOutcome(game({ winner: 0, endReason: 'forfeit' }, { endCause: cause }));
    const lost = (cause: GameViewData['endCause']) => describeOutcome(game({ winner: 1, endReason: 'forfeit' }, { endCause: cause }));
    expect(won('forfeit').detail).toBe('Ana desistiu.');
    expect(lost('forfeit').title).toMatch(/desistiu/);
    expect(won('timeout').detail).toMatch(/perdeu por tempo/);
    expect(lost('timeout').title).toMatch(/por tempo/);
    expect(won('abandoned').detail).toMatch(/sumiu/);
    expect(lost('abandoned').title).toMatch(/ausência/);
    expect(won('hp_zero').tone).toBe('good');
    expect(lost('hp_zero').tone).toBe('bad');
    expect(describeOutcome(game({ winner: 'draw' }, { endCause: 'turn_limit' })).title).toBe('Empate');
  });
});

describe('describeEvent com adversário online', () => {
  it('usa o nome do adversário no lugar de "bot" e explica o fim por tempo', () => {
    const o = { foeName: 'Ana' };
    expect(describeEvent({ type: 'turn_start', player: 1, turn: 2 }, 0, o)?.text).toBe('Turno 2: vez de Ana');
    expect(describeEvent({ type: 'game_over', winner: 0, reason: 'forfeit' }, 0, { ...o, endCause: 'timeout' })?.text).toMatch(/Ana perdeu por tempo/);
    expect(describeEvent({ type: 'game_over', winner: 1, reason: 'forfeit' }, 0, { ...o, endCause: 'abandoned' })?.text).toMatch(/ausente/);
    expect(describeEvent({ type: 'game_over', winner: 1, reason: 'hp_zero' }, 0, o)?.text).toBe('Fim de jogo: Ana venceu');
  });
  it('sem opções continua falando do bot', () => {
    expect(describeEvent({ type: 'turn_start', player: 1, turn: 2 }, 0)?.text).toBe('Turno 2: vez do bot');
  });
});
