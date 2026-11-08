import { describe, expect, it } from 'vitest';
import {
  CARDS,
  DEFAULT_RULES,
  PREBUILT_DECKS,
  applyAction,
  cardPower,
  createGame,
  damageAgainst,
  elementMultiplier,
  getCard,
  getCards,
  greedyBot,
  legalActions,
  validateDeck,
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
