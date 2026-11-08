import type { CardDef, Element, Rarity } from './types';

// 30 cartas fixas da fase 1: 6 por elemento (2 comuns, 1 incomum, 1 rara, 1 épica, 1 lendária).
// Cada carta gasta exatamente o orçamento de poder da sua raridade (Ataque×2 + Vida);
// o que muda é a divisão entre ataque e vida. Há um teste que garante isso.

function c(id: string, name: string, element: Element, rarity: Rarity, attack: number, health: number): CardDef {
  return { id, name, element, rarity, attack, health };
}

export const CARDS: readonly CardDef[] = [
  // Fogo
  c('fogo-formiga', 'Formiga-de-fogo', 'fogo', 'comum', 3, 3),
  c('fogo-lagartixa', 'Lagartixa', 'fogo', 'comum', 2, 5),
  c('fogo-raposa', 'Raposa', 'fogo', 'incomum', 5, 5),
  c('fogo-tigre', 'Tigre', 'fogo', 'rara', 6, 6),
  c('fogo-leao', 'Leão', 'fogo', 'epica', 8, 8),
  c('fogo-fenix', 'Fênix', 'fogo', 'lendaria', 10, 8),
  // Planta
  c('planta-joaninha', 'Joaninha', 'planta', 'comum', 2, 5),
  c('planta-lesma', 'Lesma', 'planta', 'comum', 1, 7),
  c('planta-coelho', 'Coelho', 'planta', 'incomum', 4, 7),
  c('planta-cervo', 'Cervo', 'planta', 'rara', 5, 8),
  c('planta-urso', 'Urso', 'planta', 'epica', 7, 10),
  c('planta-ent', 'Ent', 'planta', 'lendaria', 8, 12),
  // Terra
  c('terra-minhoca', 'Minhoca', 'terra', 'comum', 1, 7),
  c('terra-tatu', 'Tatu', 'terra', 'comum', 3, 3),
  c('terra-texugo', 'Texugo', 'terra', 'incomum', 5, 5),
  c('terra-javali', 'Javali', 'terra', 'rara', 7, 4),
  c('terra-elefante', 'Elefante', 'terra', 'epica', 6, 12),
  c('terra-golem', 'Golem', 'terra', 'lendaria', 9, 10),
  // Ar
  c('ar-mosquito', 'Mosquito', 'ar', 'comum', 4, 1),
  c('ar-pardal', 'Pardal', 'ar', 'comum', 3, 3),
  c('ar-gaivota', 'Gaivota', 'ar', 'incomum', 6, 3),
  c('ar-falcao', 'Falcão', 'ar', 'rara', 7, 4),
  c('ar-aguia', 'Águia', 'ar', 'epica', 9, 6),
  c('ar-condor', 'Condor', 'ar', 'lendaria', 11, 6),
  // Água
  c('agua-sapo', 'Sapo', 'agua', 'comum', 2, 5),
  c('agua-peixe', 'Peixe', 'agua', 'comum', 3, 3),
  c('agua-tartaruga', 'Tartaruga', 'agua', 'incomum', 3, 9),
  c('agua-foca', 'Foca', 'agua', 'rara', 4, 10),
  c('agua-tubarao', 'Tubarão', 'agua', 'epica', 8, 8),
  c('agua-baleia', 'Baleia', 'agua', 'lendaria', 8, 12),
];

const BY_ID = new Map(CARDS.map((card) => [card.id, card]));

export function getCard(id: string): CardDef {
  const card = BY_ID.get(id);
  if (!card) throw new Error(`Carta desconhecida: ${id}`);
  return card;
}

export function getCards(ids: readonly string[]): CardDef[] {
  return ids.map(getCard);
}
