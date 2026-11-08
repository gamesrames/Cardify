// ÚNICO ponto onde o servidor importa o motor de combate (mesma ideia do
// app/src/motor.ts). O motor fica em engine/; aqui só reexportamos o que o
// gerador de cartas usa. O build (build.mjs) empacota o motor junto com a
// função, porque o Deno das Edge Functions não aceita os imports sem extensão
// do motor.
export { DEFAULT_RULES, Rng, RARITIES, ELEMENTS, cardPower } from '../../engine/src';
export type { CardDef, Element, Rarity, Rules } from '../../engine/src';
