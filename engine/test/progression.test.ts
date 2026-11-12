import { describe, expect, it } from 'vitest';
import {
  CARDS,
  DEFAULT_PROGRESSION,
  DEFAULT_RULES,
  RARITIES,
  UPGRADE_POWER,
  applyUpgrade,
  checkUpgrade,
  deckPower,
  expectedScore,
  maxCardPower,
  photoBonusCap,
  ratingDelta,
  settleMatch,
  upgradeCap,
  upgradeCost,
  upgradePowerSpent,
  upgradeRoom,
  validateDeck,
  type UpgradableCard,
  type SettleInput,
} from '../src/index';

const fresh = (rarity: UpgradableCard['rarity'], attack = 3, health = 6): UpgradableCard => ({
  rarity,
  attack,
  health,
  upgradeAttack: 0,
  upgradeHealth: 0,
});

describe('melhoria de cartas', () => {
  it('o teto por raridade é o combinado: comum +2, incomum +3, rara +4, épica +6, lendária +7', () => {
    const caps = RARITIES.map((r) => upgradeCap(r, DEFAULT_RULES));
    expect(caps).toEqual([2, 3, 4, 6, 7]);
  });

  it('+1 de ataque consome 2 pontos de poder e +1 de vida consome 1', () => {
    expect(UPGRADE_POWER).toEqual({ attack: 2, health: 1 });
    let card = fresh('rara');
    card = applyUpgrade(card, 'attack');
    card = applyUpgrade(card, 'health');
    expect(card).toMatchObject({ attack: 4, health: 7, upgradeAttack: 1, upgradeHealth: 1 });
    expect(upgradePowerSpent(card)).toBe(3);
    expect(upgradeRoom(card, DEFAULT_RULES)).toBe(1); // 4 - 3
  });

  it('o custo é por ponto de poder: ataque custa o dobro da vida e sobe com a raridade', () => {
    expect(upgradeCost('comum', 'health')).toBe(10);
    expect(upgradeCost('comum', 'attack')).toBe(20);
    expect(upgradeCost('lendaria', 'health')).toBe(40);
    const costs = RARITIES.map((r) => upgradeCost(r, 'health'));
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
  });

  it('recusa quando passa do teto ou falta Essência, e diz o motivo', () => {
    let card = fresh('comum'); // teto 2
    expect(checkUpgrade(card, 'attack', 100, DEFAULT_RULES)).toEqual({ ok: true, cost: 20 });
    card = applyUpgrade(card, 'health'); // gastou 1 de 2
    expect(checkUpgrade(card, 'attack', 100, DEFAULT_RULES)).toEqual({ ok: false, reason: 'cap', cost: 20 }); // ataque pede 2, sobra 1
    expect(checkUpgrade(card, 'health', 5, DEFAULT_RULES)).toEqual({ ok: false, reason: 'essence', cost: 10 });
    card = applyUpgrade(card, 'health');
    expect(checkUpgrade(card, 'health', 100, DEFAULT_RULES)).toMatchObject({ ok: false, reason: 'cap' });
  });

  it('foto com o bônus máximo e melhorada até o teto fica exatamente no teto de poder que o baralho aceita', () => {
    for (const rarity of RARITIES) {
      const bonusPower = DEFAULT_RULES.powerBudget[rarity] + photoBonusCap(rarity, DEFAULT_RULES);
      let card = fresh(rarity, 1, bonusPower - 2);
      while (checkUpgrade(card, 'health', Infinity, DEFAULT_RULES).ok) card = applyUpgrade(card, 'health');
      expect(card.attack * 2 + card.health).toBe(maxCardPower(rarity, DEFAULT_RULES));
    }
  });

  it('um baralho com cartas fixas melhoradas até o teto continua válido enquanto couber no limite de 110', () => {
    const deck = CARDS.filter((c) => c.rarity === 'comum').slice(0, 7);
    const upgraded = deck.map((c) => {
      let u: UpgradableCard = { rarity: c.rarity, attack: c.attack, health: c.health, upgradeAttack: 0, upgradeHealth: 0 };
      while (checkUpgrade(u, 'health', Infinity, DEFAULT_RULES).ok) u = applyUpgrade(u, 'health');
      return { ...c, attack: u.attack, health: u.health };
    });
    expect(validateDeck(upgraded, DEFAULT_RULES)).toEqual([]);
    expect(deckPower(upgraded)).toBe(deckPower(deck) + 7 * 2);
  });
});

describe('rating Elo', () => {
  it('iguais: vitória vale +16, derrota -16, empate 0', () => {
    expect(ratingDelta(1000, 1000, 1)).toBe(16);
    expect(ratingDelta(1000, 1000, 0)).toBe(-16);
    expect(ratingDelta(1000, 1000, 0.5)).toBe(0);
  });

  it('vencer um adversário muito mais forte rende quase o K inteiro; vencer um muito mais fraco rende quase nada', () => {
    expect(ratingDelta(1000, 1400, 1)).toBe(29);
    expect(ratingDelta(1400, 1000, 1)).toBe(3);
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 3);
  });

  it('a chance esperada dos dois lados soma 1', () => {
    expect(expectedScore(1234, 987) + expectedScore(987, 1234)).toBeCloseTo(1, 10);
  });
});

describe('resultado da partida', () => {
  const base: SettleInput = { ratings: [1000, 1000], winner: 0, cause: 'hp_zero', turns: 20, rated: true };

  it('vitória normal: +16/-16 de rating; Essência 30 para quem venceu e 10 para quem lutou até o fim', () => {
    const r = settleMatch(base);
    expect(r).toEqual({ rated: true, ratingDelta: [16, -16], ratingAfter: [1016, 984], essence: [30, 10] });
  });

  it('vale para os dois lados: o lado 1 vencendo', () => {
    expect(settleMatch({ ...base, winner: 1 })).toMatchObject({ ratingDelta: [-16, 16], essence: [10, 30] });
  });

  it('empate por limite de turnos: rating 0 entre iguais e 20 de Essência para cada um', () => {
    expect(settleMatch({ ...base, winner: 'draw', cause: 'turn_limit', turns: 60 })).toEqual({
      rated: true,
      ratingDelta: [0, 0],
      ratingAfter: [1000, 1000],
      essence: [20, 20],
    });
  });

  it('quem desiste, estoura o tempo ou some perde rating mas não ganha Essência; o vencedor ganha', () => {
    for (const cause of ['forfeit', 'timeout', 'abandoned'] as const) {
      const r = settleMatch({ ...base, cause });
      expect(r.ratingDelta).toEqual([16, -16]);
      expect(r.essence).toEqual([30, 0]);
    }
  });

  it('partida curta demais (desistiu cedo) mexe no rating mas não paga Essência a ninguém', () => {
    const r = settleMatch({ ...base, cause: 'forfeit', turns: DEFAULT_PROGRESSION.rewardMinTurns - 1 });
    expect(r.ratingDelta).toEqual([16, -16]);
    expect(r.essence).toEqual([0, 0]);
    expect(settleMatch({ ...base, turns: DEFAULT_PROGRESSION.rewardMinTurns }).essence).toEqual([30, 10]);
  });

  it('partida amistosa (limite diário do par): nada muda', () => {
    expect(settleMatch({ ...base, rated: false })).toEqual({ rated: false, ratingDelta: [0, 0], ratingAfter: [1000, 1000], essence: [0, 0] });
  });

  it('o rating não cai abaixo do piso', () => {
    const r = settleMatch({ ...base, ratings: [1000, 5], winner: 1 });
    expect(r.ratingAfter[0]).toBeGreaterThanOrEqual(DEFAULT_PROGRESSION.ratingFloor);
    const low = settleMatch({ ...base, ratings: [10, 10], winner: 1 });
    expect(low.ratingAfter).toEqual([0, 26]);
    expect(low.ratingDelta).toEqual([-10, 16]); // o piso corta a perda; quem ganhou leva o valor cheio
  });

  it('é soma zero fora do piso', () => {
    for (const [a, b] of [[1000, 1200], [1500, 900], [1337, 1338]] as const) {
      for (const winner of [0, 1, 'draw'] as const) {
        const r = settleMatch({ ...base, ratings: [a, b], winner });
        expect(r.ratingDelta[0] + r.ratingDelta[1]).toBe(0);
      }
    }
  });
});
