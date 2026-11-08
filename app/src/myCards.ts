// Coleção do jogador: junta as cartas fixas com as criadas por foto e valida o baralho.
// Sem React Native: testável no Node. As regras (poder, limite, tamanho) vêm do motor.
import { CARDS, DEFAULT_RULES, deckPower, validateDeck } from './motor';
import type { CardDef, Element, Rarity } from './motor';

/** Linha da tabela `cards` do servidor, como o Supabase devolve. */
export interface CardRow {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  attack: number;
  health: number;
  photo_path: string;
}

export function rowToCardDef(row: CardRow): CardDef {
  return { id: row.id, name: row.name, element: row.element, rarity: row.rarity, attack: row.attack, health: row.health };
}

/** Todas as cartas que o jogador pode usar: as fixas e depois as dele (mais novas primeiro, como vêm do servidor). */
export function buildPool(rows: readonly CardRow[]): CardDef[] {
  return [...CARDS, ...rows.map(rowToCardDef)];
}

/** Marca ou desmarca uma carta, respeitando o tamanho do baralho. */
export function toggleId(ids: readonly string[], id: string, max: number = DEFAULT_RULES.deckSize): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return ids.length >= max ? [...ids] : [...ids, id];
}

/** Cartas do baralho na ordem escolhida; ids que não existem mais na coleção são ignorados. */
export function deckFromIds(pool: readonly CardDef[], ids: readonly string[]): CardDef[] {
  const byId = new Map(pool.map((c) => [c.id, c]));
  return ids.flatMap((id) => {
    const card = byId.get(id);
    return card ? [card] : [];
  });
}

export interface DeckStatus {
  power: number;
  problems: string[];
  valid: boolean;
}

export function deckStatus(deck: readonly CardDef[]): DeckStatus {
  const problems = validateDeck(deck, DEFAULT_RULES);
  return { power: deckPower(deck), problems, valid: problems.length === 0 };
}
