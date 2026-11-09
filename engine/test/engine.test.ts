import { describe, expect, it } from 'vitest';
import {
  CARDS,
  DEFAULT_RULES,
  PREBUILT_DECKS,
  applyAction,
  cardPower,
  createGame,
  damageAgainst,
  deckPower,
  elementMultiplier,
  getCard,
  getCards,
  greedyBot,
  legalActions,
  maxCardPower,
  photoBonusCap,
  upgradeCap,
  validateDeck,
  type CardDef,
  type Action,
  type GameState,
} from '../src/index';

function playOut(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.winner === null && guard++ < 10_000) {
    s = applyAction(s, greedyBot(s)).state;
  }
  return s;
}

describe('cartas', () => {
  it('cada carta gasta exatamente o orçamento da sua raridade', () => {
    for (const card of CARDS) {
      expect(cardPower(card), card.id).toBe(DEFAULT_RULES.powerBudget[card.rarity]);
    }
  });
  it('ids são únicos e há 6 cartas por elemento', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const el of ['fogo', 'planta', 'terra', 'ar', 'agua']) {
      expect(CARDS.filter((c) => c.element === el)).toHaveLength(6);
    }
  });
});

describe('elementos', () => {
  it('ciclo de vantagens e desvantagens', () => {
    const r = DEFAULT_RULES;
    expect(elementMultiplier('fogo', 'planta', r)).toBe(1.5);
    expect(elementMultiplier('planta', 'fogo', r)).toBe(0.75);
    expect(elementMultiplier('agua', 'fogo', r)).toBe(1.5);
    expect(elementMultiplier('fogo', 'fogo', r)).toBe(1);
    expect(elementMultiplier('fogo', 'terra', r)).toBe(1);
  });
  it('dano arredonda para baixo e é no mínimo 1', () => {
    expect(damageAgainst(getCard('fogo-raposa'), getCard('planta-lesma'), DEFAULT_RULES)).toBe(7); // 5 × 1,5
    expect(damageAgainst(getCard('planta-lesma'), getCard('fogo-raposa'), DEFAULT_RULES)).toBe(1); // 1 × 0,75 → mínimo 1
  });
});

describe('baralhos', () => {
  it('baralhos prontos são válidos', () => {
    for (const [name, ids] of Object.entries(PREBUILT_DECKS)) {
      expect(validateDeck(getCards(ids), DEFAULT_RULES), name).toEqual([]);
    }
  });
  it('rejeita tamanho errado, repetidas e excesso de poder', () => {
    const lendarias = getCards(['fogo-fenix', 'planta-ent', 'terra-golem', 'ar-condor', 'agua-baleia', 'fogo-leao', 'terra-elefante']);
    expect(validateDeck(lendarias, DEFAULT_RULES).join(' ')).toMatch(/limite/);
    expect(validateDeck(getCards(['fogo-formiga']), DEFAULT_RULES).join(' ')).toMatch(/precisa ter/);
    const repetido = getCards(['fogo-formiga', 'fogo-formiga', 'fogo-lagartixa', 'fogo-raposa', 'fogo-tigre', 'terra-tatu', 'ar-pardal']);
    expect(validateDeck(repetido, DEFAULT_RULES).join(' ')).toMatch(/repetidas/);
  });
});

describe('bônus de foto e melhorias', () => {
  const r = DEFAULT_RULES;

  it('tetos por raridade: bônus 10% (mínimo +1) e melhoria 25%', () => {
    expect(photoBonusCap('comum', r)).toBe(1); // 10% de 9 = 0,9 → mínimo 1
    expect(photoBonusCap('incomum', r)).toBe(1);
    expect(photoBonusCap('rara', r)).toBe(1);
    expect(photoBonusCap('epica', r)).toBe(2);
    expect(photoBonusCap('lendaria', r)).toBe(2);
    expect(upgradeCap('comum', r)).toBe(2);
    expect(upgradeCap('epica', r)).toBe(6);
    expect(maxCardPower('comum', r)).toBe(12); // 9 + 1 + 2
    expect(maxCardPower('lendaria', r)).toBe(37); // 28 + 2 + 7
  });

  /** Variante da carta com `extra` de poder a mais, todo na vida (simula bônus de foto ou melhoria). */
  function withPower(card: CardDef, extra: number): CardDef {
    return { ...card, health: card.health + extra };
  }

  it('baralho aceita carta com bônus de foto acima do orçamento da raridade', () => {
    const deck = getCards(PREBUILT_DECKS['Brasa e Ferro']!);
    const comum = deck.find((c) => c.rarity === 'comum')!;
    const boosted = deck.map((c) => (c.id === comum.id ? withPower(c, photoBonusCap('comum', r)) : c));
    expect(cardPower(boosted.find((c) => c.id === comum.id)!)).toBe(r.powerBudget.comum + 1);
    expect(validateDeck(boosted, r)).toEqual([]);
  });

  it('aceita até o teto (orçamento + bônus + melhoria) e recusa acima dele', () => {
    const deck = getCards(PREBUILT_DECKS['Brasa e Ferro']!);
    const comum = deck.find((c) => c.rarity === 'comum')!;
    const swap = (extra: number) => deck.map((c) => (c.id === comum.id ? withPower(c, extra) : c));
    const room = maxCardPower('comum', r) - r.powerBudget.comum; // 3
    expect(validateDeck(swap(room), r)).toEqual([]);
    expect(validateDeck(swap(room + 1), r).join(' ')).toMatch(/acima do máximo 12/);
  });

  it('o limite de poder do baralho conta o poder real, incluindo bônus', () => {
    // 4 comuns (36) + 1 rara (18) + 2 lendárias (56) = 110, exatamente o limite.
    const ids = ['fogo-formiga', 'terra-tatu', 'ar-pardal', 'agua-peixe', 'fogo-tigre', 'planta-ent', 'terra-golem'];
    const deck = getCards(ids);
    expect(deckPower(deck)).toBe(r.deckPowerLimit);
    expect(validateDeck(deck, r)).toEqual([]);

    // Um +1 de bônus de foto numa das cartas leva o baralho a 111: recusado pelo limite, não pela carta.
    const boosted = deck.map((c) => (c.id === 'fogo-formiga' ? withPower(c, 1) : c));
    const problems = validateDeck(boosted, r);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/limite 110/);
  });
});

describe('partida', () => {
  const deckA = getCards(PREBUILT_DECKS['Brasa e Ferro']!);
  const deckB = getCards(PREBUILT_DECKS['Maré Alta']!);

  it('mesma semente gera a mesma partida', () => {
    const a = playOut(createGame(deckA, deckB, 123).state);
    const b = playOut(createGame(deckA, deckB, 123).state);
    expect(a).toEqual(b);
  });

  it('sementes diferentes costumam gerar partidas diferentes', () => {
    const turns = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) turns.add(playOut(createGame(deckA, deckB, seed).state).turn);
    expect(turns.size).toBeGreaterThan(1);
  });

  it('applyAction não altera o estado anterior', () => {
    const { state } = createGame(deckA, deckB, 7);
    const snapshot = structuredClone(state);
    applyAction(state, legalActions(state)[0] as Action);
    expect(state).toEqual(snapshot);
  });

  it('começa com a mão cheia e 3 de energia', () => {
    const { state } = createGame(deckA, deckB, 7);
    expect(state.players[state.active].hand).toHaveLength(3);
    expect(state.energy).toBe(3);
  });

  it('não deixa gastar mais energia do que tem nem usar posição ocupada', () => {
    let s = createGame(deckA, deckB, 7).state;
    const before = s.energy;
    const first = legalActions(s).find((a) => a.type === 'play')!;
    s = applyAction(s, first).state;
    expect(s.energy).toBeLessThan(before);
    if (first.type === 'play') {
      expect(legalActions(s).some((a) => a.type === 'play' && a.slot === first.slot)).toBe(false);
    }
    expect(() => applyAction(s, { type: 'play', handIndex: 99, slot: 0 })).toThrow();
  });

  it('criatura sem oposição bate direto na vida do jogador', () => {
    let s = createGame(deckA, deckB, 5).state;
    const attacker = s.active;
    const defender = attacker === 0 ? 1 : 0;
    const play = legalActions(s).find((a) => a.type === 'play')!;
    s = applyAction(s, play).state;
    const played = s.players[attacker].field.find((f) => f !== null)!;
    s = applyAction(s, { type: 'end' }).state;
    expect(s.players[defender].hp).toBe(DEFAULT_RULES.playerHp - played.card.attack);
  });

  it('toda partida termina com vencedor ou empate', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const end = playOut(createGame(deckA, deckB, seed).state);
      expect(end.winner, `semente ${seed}`).not.toBeNull();
      expect(end.turn).toBeLessThanOrEqual(DEFAULT_RULES.maxTurns);
    }
  });

  it('conserva as cartas: nenhuma some nem se duplica', () => {
    const end = playOut(createGame(deckA, deckB, 99).state);
    for (const p of end.players) {
      const total = p.drawPile.length + p.discard.length + p.hand.length + p.field.filter((f) => f !== null).length;
      expect(total).toBe(DEFAULT_RULES.deckSize);
    }
  });
});

describe('desistência', () => {
  const deckA = getCards(PREBUILT_DECKS['Brasa e Ferro']!);
  const deckB = getCards(PREBUILT_DECKS['Maré Alta']!);

  it('o adversário vence na hora, com motivo "forfeit" e evento game_over', () => {
    const { state } = createGame(deckA, deckB, 7);
    const r = applyAction(state, { type: 'forfeit', player: 0 });
    expect(r.state.winner).toBe(1);
    expect(r.state.endReason).toBe('forfeit');
    expect(r.events).toEqual([{ type: 'game_over', winner: 1, reason: 'forfeit' }]);
    const r2 = applyAction(state, { type: 'forfeit', player: 1 });
    expect(r2.state.winner).toBe(0);
  });

  it('vale também fora da vez do jogador (necessário no 1x1 online)', () => {
    const { state } = createGame(deckA, deckB, 7);
    const idle = state.active === 0 ? 1 : 0;
    const r = applyAction(state, { type: 'forfeit', player: idle });
    expect(r.state.winner).toBe(state.active);
  });

  it('vale no meio da partida, sem alterar vida, campo nem mãos', () => {
    let s = createGame(deckA, deckB, 5).state;
    s = applyAction(s, legalActions(s).find((a) => a.type === 'play')!).state;
    s = applyAction(s, { type: 'end' }).state;
    const after = applyAction(s, { type: 'forfeit', player: 0 }).state;
    expect(after.players).toEqual(s.players);
    expect(after.turn).toBe(s.turn);
    expect(after.winner).toBe(1);
  });

  it('depois de desistir não há mais ações legais e nada mais é aceito', () => {
    const { state } = createGame(deckA, deckB, 7);
    const over = applyAction(state, { type: 'forfeit', player: 0 }).state;
    expect(legalActions(over)).toEqual([]);
    expect(() => applyAction(over, { type: 'end' })).toThrow();
    expect(() => applyAction(over, { type: 'forfeit', player: 1 })).toThrow(/já terminou/);
  });

  it('não permite desistir de partida que já acabou por vida zerada', () => {
    const end = playOut(createGame(deckA, deckB, 3).state);
    expect(() => applyAction(end, { type: 'forfeit', player: 0 })).toThrow();
  });

  it('não altera o estado anterior e recusa jogador inválido', () => {
    const { state } = createGame(deckA, deckB, 7);
    const snapshot = structuredClone(state);
    applyAction(state, { type: 'forfeit', player: 0 });
    expect(state).toEqual(snapshot);
    expect(() => applyAction(state, { type: 'forfeit', player: 2 as 0 })).toThrow();
  });

  it('partidas normais registram o motivo: vida zerada ou limite de turnos', () => {
    const reasons = new Set<string | null>();
    for (let seed = 1; seed <= 50; seed++) reasons.add(playOut(createGame(deckA, deckB, seed).state).endReason);
    expect(reasons.has(null)).toBe(false);
    expect(reasons.has('forfeit')).toBe(false);
    const rules = { ...DEFAULT_RULES, maxTurns: 2 };
    const capped = playOut(createGame(deckA, deckB, 1, rules).state);
    expect(capped.endReason).toBe('turn_limit');
  });

  it('createGame começa sem motivo de fim', () => {
    expect(createGame(deckA, deckB, 7).state.endReason).toBeNull();
  });
});
