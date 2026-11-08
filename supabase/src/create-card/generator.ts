import { DEFAULT_RULES, Rng, RARITIES } from '../motor';
import type { Rarity, Rules } from '../motor';
import type { Category, GeneratedCard } from './types';

// Regras do gerador de cartas (fase 2). Os orçamentos de poder, custos e a
// fórmula Poder = Ataque×2 + Vida vêm do motor (DEFAULT_RULES); aqui ficam
// só os números que o motor não conhece. Documentados em docs/geracao-cartas.md.

/** Chance de cada raridade ao sortear uma carta (soma 100). */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  comum: 60,
  incomum: 25,
  rara: 10,
  epica: 4,
  lendaria: 1,
};

/** Teto do bônus de categoria, em % do orçamento da raridade (decisão do usuário). */
export const MAX_CATEGORY_BONUS_PCT = 10;

/**
 * Fatia do poder gasta em ataque (2×ataque ÷ poder total). As 30 cartas fixas
 * vão de ~0,22 a ~0,89; este intervalo evita os extremos (cartas de vidro).
 */
export const ATTACK_SHARE = { min: 0.3, max: 0.75 };

export function rollRarity(rng: Rng): Rarity {
  const total = RARITIES.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0);
  let roll = rng.next() * total;
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll < 0) return rarity;
  }
  return 'comum'; // só por segurança contra arredondamento
}

/** Pontos de poder extras que a categoria dá. Arredonda para baixo: o teto de 10% nunca é passado. */
export function categoryBonusPoints(budget: number, bonusPct: number): number {
  const pct = Math.min(Math.max(bonusPct, 0), MAX_CATEGORY_BONUS_PCT);
  return Math.floor((budget * pct) / 100);
}

/**
 * Gera a carta a partir da semente: a mesma semente e categoria dão sempre a
 * mesma carta (dá para auditar). Gasta exatamente o orçamento da raridade mais o bônus.
 */
export function generateCard(
  input: { seed: number; category: Category },
  rules: Rules = DEFAULT_RULES,
): GeneratedCard {
  const rng = new Rng(input.seed);
  const rarity = rollRarity(rng);
  const budget = rules.powerBudget[rarity];
  const bonusPoints = categoryBonusPoints(budget, input.category.bonusPct);
  const total = budget + bonusPoints;

  const share = ATTACK_SHARE.min + rng.next() * (ATTACK_SHARE.max - ATTACK_SHARE.min);
  const maxAttack = Math.floor((total - 1) / 2); // sobra pelo menos 1 de vida
  const attack = Math.min(Math.max(Math.round((share * total) / 2), 1), maxAttack);
  const health = total - attack * 2;

  return {
    name: input.category.nome,
    category: input.category.slug,
    element: input.category.element,
    rarity,
    attack,
    health,
    seed: input.seed >>> 0, // sem sinal: é o número que fica gravado no banco
    bonusPoints,
  };
}
