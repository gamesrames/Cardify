import type { CardDef, Element, Rules } from './types';

/** Valores provisórios; o simulador existe para ajustá-los. */
export const DEFAULT_RULES: Rules = {
  playerHp: 20,
  handSize: 3,
  energyPerTurn: 3,
  slots: 3,
  deckSize: 7,
  deckPowerLimit: 110,
  maxTurns: 60,
  summoningSickness: false,
  secondPlayerBonusEnergy: 2,
  advantageMultiplier: 1.5,
  disadvantageMultiplier: 0.75,
  energyCost: { comum: 1, incomum: 2, rara: 2, epica: 3, lendaria: 3 },
  powerBudget: { comum: 9, incomum: 15, rara: 18, epica: 24, lendaria: 28 },
};

/** Ciclo de vantagens: cada elemento vence o próximo. */
const BEATS: Record<Element, Element> = {
  fogo: 'planta',
  planta: 'terra',
  terra: 'ar',
  ar: 'agua',
  agua: 'fogo',
};

export function hasAdvantage(attacker: Element, defender: Element): boolean {
  return BEATS[attacker] === defender;
}

export function elementMultiplier(attacker: Element, defender: Element, rules: Rules): number {
  if (hasAdvantage(attacker, defender)) return rules.advantageMultiplier;
  if (hasAdvantage(defender, attacker)) return rules.disadvantageMultiplier;
  return 1;
}

/** Dano de `attacker` contra uma criatura de `defender` (mínimo 1). */
export function damageAgainst(attacker: CardDef, defender: CardDef, rules: Rules): number {
  return Math.max(1, Math.floor(attacker.attack * elementMultiplier(attacker.element, defender.element, rules)));
}

/** Poder de uma carta: Ataque × 2 + Vida. */
export function cardPower(card: Pick<CardDef, 'attack' | 'health'>): number {
  return card.attack * 2 + card.health;
}

export function energyCostOf(card: CardDef, rules: Rules): number {
  return rules.energyCost[card.rarity];
}
