// ÚNICO ponto onde o servidor importa o motor de combate (mesma ideia do
// app/src/motor.ts). O motor fica em engine/; aqui só reexportamos o que o
// gerador de cartas e as partidas online usam. O build (build.mjs) empacota o
// motor junto com a função, porque o Deno das Edge Functions não aceita os
// imports sem extensão do motor.
export {
  DEFAULT_RULES,
  Rng,
  RARITIES,
  ELEMENTS,
  cardPower,
  maxCardPower,
  photoBonusCap,
  // partidas online (fase 4)
  createGame,
  applyAction,
  getCard,
  validateDeck,
  viewFor,
  redactEvents,
} from '../../engine/src';
export type {
  Action,
  CardDef,
  Element,
  GameEvent,
  GameState,
  PlayerIndex,
  PlayerView,
  Rarity,
  Rules,
} from '../../engine/src';
