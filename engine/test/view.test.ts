import { describe, expect, it } from 'vitest';
import {
  CARDS,
  applyAction,
  createGame,
  greedyBot,
  redactEvents,
  viewFor,
  type CardDef,
  type GameState,
  type PlayerIndex,
} from '../src/index';

// Dois baralhos SEM nenhuma carta em comum (ids com prefixo), para ver vazamento pelo id.
const base = ['fogo-formiga', 'fogo-lagartixa', 'fogo-raposa', 'fogo-tigre', 'fogo-leao', 'terra-tatu', 'ar-pardal'];
const mark = (prefix: string): CardDef[] =>
  base.map((id) => ({ ...CARDS.find((c) => c.id === id)!, id: `${prefix}-${id}`, name: `${prefix}:${id}` }));

function start(seed = 7) {
  return createGame(mark('A'), mark('B'), seed);
}

const handIds = (s: GameState, p: PlayerIndex) => s.players[p].hand.map((c) => c.id);

describe('viewFor', () => {
  it('mostra a própria mão e só a quantidade da mão do adversário', () => {
    const { state } = start();
    const v = viewFor(state, 0);
    expect(v.me.hand.map((c) => c.id)).toEqual(handIds(state, 0));
    expect(v.foe.handCount).toBe(state.players[1].hand.length);
    expect('hand' in v.foe).toBe(false);
  });

  it('não vaza a mão do adversário, o monte dele nem o estado do sorteio (nenhum id do outro baralho aparece)', () => {
    const { state } = start();
    for (const seat of [0, 1] as const) {
      const text = JSON.stringify(viewFor(state, seat));
      const foePrefix = seat === 0 ? 'B-' : 'A-';
      expect(text).not.toContain(foePrefix); // nenhuma carta do outro baralho, pois nada foi jogado ainda
      expect(text).not.toContain('rngState');
      expect(text).not.toContain('drawPile');
    }
  });

  it('cartas do adversário só aparecem depois de jogadas em campo', () => {
    let { state } = start();
    // joga até o adversário (de quem estamos olhando) colocar algo em campo
    let guard = 0;
    while (state.winner === null && guard++ < 200 && state.players[1].field.every((c) => c === null)) {
      state = applyAction(state, greedyBot(state)).state;
    }
    const v = viewFor(state, 0);
    const onField = state.players[1].field.filter((c) => c !== null).map((c) => c!.card.id);
    expect(onField.length).toBeGreaterThan(0);
    expect(v.foe.field.filter((c) => c !== null).map((c) => c!.card.id)).toEqual(onField);
    // mas as cartas que seguem na mão ou no monte dele continuam fora da visão
    const secret = [...state.players[1].hand, ...state.players[1].drawPile].map((c) => c.id);
    const text = JSON.stringify(v);
    for (const id of secret) expect(text).not.toContain(`"${id}"`);
  });

  it('legal lista as ações só para o jogador da vez', () => {
    const { state } = start();
    const active = state.active;
    expect(viewFor(state, active).legal.length).toBeGreaterThan(0);
    expect(viewFor(state, active === 0 ? 1 : 0).legal).toEqual([]);
  });

  it('é JSON puro (sobrevive ao ir e voltar do banco) e não muda o estado original', () => {
    const { state } = start();
    const before = JSON.stringify(state);
    const v = viewFor(state, 1);
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('a visão de quem perdeu por desistência mostra o motivo e nenhuma ação legal', () => {
    const { state } = start();
    const done = applyAction(state, { type: 'forfeit', player: 0 }).state;
    const v = viewFor(done, 1);
    expect(v.winner).toBe(1);
    expect(v.endReason).toBe('forfeit');
    expect(v.legal).toEqual([]);
  });
});

describe('redactEvents', () => {
  it('esconde as compras do adversário e mantém as próprias e as públicas', () => {
    const { events } = start();
    const draws = events.filter((e) => e.type === 'draw');
    expect(draws.length).toBeGreaterThan(0);
    const forSeat0 = redactEvents(events, 0);
    expect(forSeat0.some((e) => e.type === 'draw' && e.player === 1)).toBe(false);
    expect(forSeat0.some((e) => e.type === 'turn_start')).toBe(true);
    const mine = events.filter((e) => e.type === 'draw' && e.player === 0).length;
    expect(forSeat0.filter((e) => e.type === 'draw').length).toBe(mine);
  });
});
