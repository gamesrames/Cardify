import type { CardDef } from './motor';

// Baralho montado pelo jogador, guardado em memória para a partida ler (o `useGame`
// resolve baralhos por nome). Quem inicia a partida chama setCustomDeck antes.
export const CUSTOM_DECK_NAME = 'Meu baralho';

let current: readonly CardDef[] | null = null;

export function setCustomDeck(cards: readonly CardDef[]): void {
  current = cards;
}

/** Devolve o baralho do jogador se `name` for o nome dele; senão `null` (baralhos prontos). */
export function getCustomDeck(name: string): readonly CardDef[] | null {
  return name === CUSTOM_DECK_NAME ? current : null;
}
