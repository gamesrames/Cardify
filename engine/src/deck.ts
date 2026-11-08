import { cardPower } from './rules';
import type { CardDef, Rules } from './types';

export function deckPower(deck: readonly CardDef[]): number {
  return deck.reduce((sum, card) => sum + cardPower(card), 0);
}

/** Retorna a lista de problemas do baralho; vazia = baralho válido. */
export function validateDeck(deck: readonly CardDef[], rules: Rules): string[] {
  const problems: string[] = [];
  if (deck.length !== rules.deckSize) {
    problems.push(`O baralho precisa ter ${rules.deckSize} cartas (tem ${deck.length}).`);
  }
  const ids = new Set(deck.map((card) => card.id));
  if (ids.size !== deck.length) {
    problems.push('O baralho tem cartas repetidas.');
  }
  for (const card of deck) {
    const power = cardPower(card);
    const budget = rules.powerBudget[card.rarity];
    if (power > budget) {
      problems.push(`${card.name} tem poder ${power}, acima do orçamento ${budget} da raridade ${card.rarity}.`);
    }
  }
  const total = deckPower(deck);
  if (total > rules.deckPowerLimit) {
    problems.push(`Poder total ${total} passa do limite ${rules.deckPowerLimit}.`);
  }
  return problems;
}

/** Baralhos prontos para o bot (um por tema). Os testes garantem que são válidos. */
export const PREBUILT_DECKS: Record<string, readonly string[]> = {
  'Brasa e Ferro': ['fogo-formiga', 'fogo-lagartixa', 'fogo-raposa', 'fogo-tigre', 'fogo-leao', 'terra-tatu', 'ar-pardal'],
  'Floresta Viva': ['planta-joaninha', 'planta-lesma', 'planta-coelho', 'planta-cervo', 'planta-urso', 'agua-peixe', 'fogo-formiga'],
  'Rocha Firme': ['terra-minhoca', 'terra-tatu', 'terra-texugo', 'terra-javali', 'terra-elefante', 'ar-mosquito', 'planta-joaninha'],
  'Ventania': ['ar-mosquito', 'ar-pardal', 'ar-gaivota', 'ar-falcao', 'ar-aguia', 'fogo-formiga', 'terra-tatu'],
  'Maré Alta': ['agua-sapo', 'agua-peixe', 'agua-tartaruga', 'agua-foca', 'agua-tubarao', 'ar-pardal', 'terra-tatu'],
};
