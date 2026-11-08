// Simulador: joga milhares de partidas bot guloso x bot guloso com baralhos aleatórios válidos
// e mostra quais cartas ganham demais ou de menos, e se quem começa tem vantagem.
//
// Uso:
//   npm run sim -- --games 10000 --seed 1
// Variações de regra (para testar ajustes):
//   --sick 1          criatura recém-jogada não ataca no mesmo turno
//   --bonus 1         energia extra do segundo jogador no primeiro turno dele
//   --limit 100       limite de poder do baralho
//   --hp 20  --energy 3  --adv 1.5  --dis 0.75
//   --quiet 1         mostra só o resumo (sem a tabela por carta)

import {
  CARDS,
  DEFAULT_RULES,
  Rng,
  applyAction,
  createGame,
  deckPower,
  greedyBot,
  validateDeck,
  type CardDef,
  type Rules,
} from '../src/index';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const raw = i >= 0 ? process.argv[i + 1] : undefined;
  return raw !== undefined ? Number(raw) : fallback;
}

const GAMES = arg('games', 10_000);
const SEED = arg('seed', 1);
const QUIET = arg('quiet', 0) === 1;

const rules: Rules = {
  ...DEFAULT_RULES,
  summoningSickness: arg('sick', DEFAULT_RULES.summoningSickness ? 1 : 0) === 1,
  secondPlayerBonusEnergy: arg('bonus', DEFAULT_RULES.secondPlayerBonusEnergy),
  deckPowerLimit: arg('limit', DEFAULT_RULES.deckPowerLimit),
  playerHp: arg('hp', DEFAULT_RULES.playerHp),
  energyPerTurn: arg('energy', DEFAULT_RULES.energyPerTurn),
  advantageMultiplier: arg('adv', DEFAULT_RULES.advantageMultiplier),
  disadvantageMultiplier: arg('dis', DEFAULT_RULES.disadvantageMultiplier),
};
const rng = new Rng(SEED);

/** Sorteia 7 cartas distintas até o baralho ser válido (poder dentro do limite). */
function randomDeck(): CardDef[] {
  for (let tries = 0; tries < 10_000; tries++) {
    const deck = rng.shuffle(CARDS).slice(0, rules.deckSize);
    if (validateDeck(deck, rules).length === 0) return deck;
  }
  throw new Error('Não achei baralho válido');
}

interface Stat {
  games: number;
  wins: number;
}
const cardStats = new Map<string, Stat>(CARDS.map((c) => [c.id, { games: 0, wins: 0 }]));
let firstPlayerWins = 0;
let draws = 0;
let timeouts = 0;
let totalTurns = 0;
let totalPower = 0;

for (let g = 0; g < GAMES; g++) {
  const deckA = randomDeck();
  const deckB = randomDeck();
  let s = createGame(deckA, deckB, rng.int(2 ** 31), rules).state;
  const first = s.firstPlayer;
  while (s.winner === null) s = applyAction(s, greedyBot(s)).state;

  totalTurns += s.turn;
  totalPower += deckPower(deckA) + deckPower(deckB);
  if (s.turn >= rules.maxTurns) timeouts++;
  if (s.winner === 'draw') {
    draws++;
    continue;
  }
  if (s.winner === first) firstPlayerWins++;
  const winnerDeck = s.winner === 0 ? deckA : deckB;
  const loserDeck = s.winner === 0 ? deckB : deckA;
  for (const card of winnerDeck) {
    const st = cardStats.get(card.id)!;
    st.games++;
    st.wins++;
  }
  for (const card of loserDeck) cardStats.get(card.id)!.games++;
}

const decided = GAMES - draws;
const rows = CARDS.map((c) => {
  const st = cardStats.get(c.id)!;
  return { card: c, games: st.games, rate: st.games ? st.wins / st.games : 0 };
}).sort((a, b) => b.rate - a.rate);

console.log(`\nRegras: sick=${rules.summoningSickness} bonus=${rules.secondPlayerBonusEnergy} limite=${rules.deckPowerLimit} vida=${rules.playerHp} energia=${rules.energyPerTurn} vant=${rules.advantageMultiplier} desv=${rules.disadvantageMultiplier}`);
console.log(`Partidas: ${GAMES} | empates: ${draws} | por tempo: ${timeouts}`);
console.log(`Quem começa vence: ${((firstPlayerWins / decided) * 100).toFixed(1)}%  (ideal: perto de 50%)`);
console.log(`Turnos médios: ${(totalTurns / GAMES).toFixed(1)} | poder médio do baralho: ${(totalPower / (GAMES * 2)).toFixed(1)}`);
const worst = rows.reduce((m, r) => Math.max(m, Math.abs(r.rate - 0.5)), 0);
console.log(`Pior desvio de carta: ${(worst * 100).toFixed(1)} pontos (meta: nenhuma acima de 60%)`);

if (!QUIET) {
  console.log('\nTaxa de vitória por carta (nos baralhos em que aparece)');
  console.log('carta                 raridade   elem    A/V    vitória   aparições');
  for (const r of rows) {
    const flag = r.rate > 0.6 ? '  <-- FORTE DEMAIS' : r.rate < 0.4 ? '  <-- FRACA DEMAIS' : '';
    console.log(
      `${r.card.name.padEnd(20)}  ${r.card.rarity.padEnd(9)}  ${r.card.element.padEnd(6)}  ${`${r.card.attack}/${r.card.health}`.padEnd(5)}  ${(r.rate * 100).toFixed(1).padStart(5)}%    ${r.games}${flag}`,
    );
  }
  const byRarity = new Map<string, { w: number; g: number }>();
  for (const r of rows) {
    const e = byRarity.get(r.card.rarity) ?? { w: 0, g: 0 };
    e.w += r.rate * r.games;
    e.g += r.games;
    byRarity.set(r.card.rarity, e);
  }
  console.log('\nPor raridade:');
  for (const [rar, e] of byRarity) console.log(`  ${rar.padEnd(9)} ${((e.w / e.g) * 100).toFixed(1)}%`);
}
