import { describe, expect, it } from 'vitest';
import { CARDS, DEFAULT_RULES, PREBUILT_DECKS } from '../src/motor';
import { buildPool, deckFromIds, deckStatus, rowToCardDef, toggleId } from '../src/myCards';
import type { CardRow } from '../src/myCards';
import { CUSTOM_DECK_NAME, getCustomDeck, setCustomDeck } from '../src/customDeck';

const photoCard: CardRow = {
  id: 'uuid-1', name: 'Galinha', element: 'terra', rarity: 'comum', attack: 3, health: 7, photo_path: 'u/uuid-1.jpg',
};

describe('coleção', () => {
  it('a coleção tem as cartas fixas e depois as de foto', () => {
    const pool = buildPool([photoCard]);
    expect(pool).toHaveLength(CARDS.length + 1);
    expect(pool[pool.length - 1]).toEqual(rowToCardDef(photoCard));
  });

  it('marcar e desmarcar cartas, sem passar do tamanho do baralho', () => {
    let ids: string[] = [];
    for (let i = 0; i < 10; i++) ids = toggleId(ids, `c${i}`);
    expect(ids).toHaveLength(DEFAULT_RULES.deckSize);
    expect(toggleId(ids, 'c0')).not.toContain('c0');
    expect(toggleId(ids, 'c9')).toEqual(ids); // cheio: ignora
  });

  it('ids que não existem mais na coleção são ignorados', () => {
    const pool = buildPool([photoCard]);
    expect(deckFromIds(pool, ['uuid-1', 'sumiu', 'fogo-leao']).map((c) => c.id)).toEqual(['uuid-1', 'fogo-leao']);
  });
});

describe('validação do baralho com cartas de foto', () => {
  const base = PREBUILT_DECKS['Brasa e Ferro'] as readonly string[];

  it('baralho pronto é válido', () => {
    const pool = buildPool([]);
    expect(deckStatus(deckFromIds(pool, base)).valid).toBe(true);
  });

  it('trocar uma carta por uma de foto (com bônus) continua válido', () => {
    const pool = buildPool([{ ...photoCard, attack: 3, health: 4 }]); // poder 10 = orçamento 9 + bônus 1 (o que o gerador do servidor produz)
    const ids = [...base.slice(0, 6), 'uuid-1'];
    const status = deckStatus(deckFromIds(pool, ids));
    expect(status.problems).toEqual([]);
  });

  it('carta de foto acima do teto da raridade é recusada', () => {
    const cheater = { ...photoCard, id: 'uuid-2', attack: 20, health: 20 };
    const status = deckStatus(deckFromIds(buildPool([cheater]), [...base.slice(0, 6), 'uuid-2']));
    expect(status.valid).toBe(false);
  });

  it('baralho incompleto não é válido', () => {
    expect(deckStatus(deckFromIds(buildPool([]), base.slice(0, 3))).valid).toBe(false);
  });
});

describe('baralho do jogador na partida', () => {
  it('só responde pelo nome "Meu baralho"', () => {
    const deck = deckFromIds(buildPool([]), PREBUILT_DECKS['Brasa e Ferro'] as readonly string[]);
    setCustomDeck(deck);
    expect(getCustomDeck(CUSTOM_DECK_NAME)).toEqual(deck);
    expect(getCustomDeck('Ventania')).toBeNull();
  });
});
