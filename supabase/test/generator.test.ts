import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, Rng, RARITIES, cardPower } from '../src/motor';
import { MAX_CATEGORY_BONUS_PCT, RARITY_WEIGHTS, categoryBonusPoints, generateCard, rollRarity } from '../src/create-card/generator';
import type { Category } from '../src/create-card/types';

const formiga: Category = { slug: 'formiga', nome: 'Formiga', element: 'terra', bonusPct: 0 };
const cavalo: Category = { slug: 'cavalo', nome: 'Cavalo', element: 'terra', bonusPct: 10 };

describe('gerador de cartas', () => {
  it('a mesma semente e categoria dão sempre a mesma carta', () => {
    expect(generateCard({ seed: 12345, category: cavalo })).toEqual(generateCard({ seed: 12345, category: cavalo }));
  });

  it('gasta exatamente orçamento + bônus e respeita o teto de 10%', () => {
    for (let seed = 1; seed <= 5000; seed++) {
      const card = generateCard({ seed, category: cavalo });
      const budget = DEFAULT_RULES.powerBudget[card.rarity];
      expect(cardPower(card)).toBe(budget + card.bonusPoints);
      expect(card.bonusPoints).toBeLessThanOrEqual(Math.floor(budget * 0.1));
      expect(card.attack).toBeGreaterThanOrEqual(1);
      expect(card.health).toBeGreaterThanOrEqual(1);
    }
  });

  it('categoria sem bônus gasta exatamente o orçamento da raridade', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const card = generateCard({ seed, category: formiga });
      expect(card.bonusPoints).toBe(0);
      expect(cardPower(card)).toBe(DEFAULT_RULES.powerBudget[card.rarity]);
    }
  });

  it('elemento e nome vêm da categoria', () => {
    const card = generateCard({ seed: 7, category: cavalo });
    expect(card.element).toBe('terra');
    expect(card.name).toBe('Cavalo');
    expect(card.category).toBe('cavalo');
  });

  it('distribui raridades perto de 60/25/10/4/1', () => {
    const rng = new Rng(2024);
    const n = 100_000;
    const count: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const r = rollRarity(rng);
      count[r] = (count[r] ?? 0) + 1;
    }
    for (const r of RARITIES) {
      expect(((count[r] ?? 0) / n) * 100).toBeCloseTo(RARITY_WEIGHTS[r], 0);
    }
  });

  it('pesos de raridade somam 100', () => {
    expect(RARITIES.reduce((s, r) => s + RARITY_WEIGHTS[r], 0)).toBe(100);
  });

  it('bônus de categoria nunca passa de 10% mesmo com valor absurdo', () => {
    expect(categoryBonusPoints(28, 500)).toBe(Math.floor((28 * MAX_CATEGORY_BONUS_PCT) / 100));
    expect(categoryBonusPoints(28, -5)).toBe(0);
  });
});
