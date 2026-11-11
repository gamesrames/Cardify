// Simulador de melhorias (fase 5): quanto as melhorias de carta mudam a taxa de vitória?
//
// Pergunta: um baralho melhorado até o teto de 110 de poder (o limite do baralho) ganha demais de um baralho
// sem melhorias? As cartas fixas não são melhoráveis no jogo (só as de foto), mas aqui tratamos todas como
// melhoráveis para medir o efeito PURO da regra de melhoria nas 3 estratégias: só ataque, só vida, misto.
//
// Uso: npm run sim:upgrades -- --games 5000 --seed 1

import {
  CARDS,
  DEFAULT_PROGRESSION,
  DEFAULT_RULES,
  Rng,
  UPGRADE_POWER,
  applyAction,
  applyUpgrade,
  checkUpgrade,
  createGame,
  deckPower,
  greedyBot,
  upgradeCost,
  validateDeck,
  type CardDef,
  type UpgradableCard,
  type UpgradeStat,
} from '../src/index';

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  const raw = i >= 0 ? process.argv[i + 1] : undefined;
  return raw !== undefined ? Number(raw) : fallback;
}

const GAMES = arg('games', 5000);
const rng = new Rng(arg('seed', 1));
const rules = DEFAULT_RULES;

function randomDeck(): CardDef[] {
  for (let tries = 0; tries < 10_000; tries++) {
    const deck = rng.shuffle(CARDS).slice(0, rules.deckSize);
    if (validateDeck(deck, rules).length === 0) return deck;
  }
  throw new Error('Não achei baralho válido');
}

type Strategy = 'ataque' | 'vida' | 'misto';

/** Gasta melhorias (aleatórias entre as cartas) até o baralho bater o limite de poder ou não caber mais nada. */
function upgradeDeck(deck: readonly CardDef[], strategy: Strategy): { deck: CardDef[]; essence: number } {
  let cards: UpgradableCard[] = deck.map((c) => ({ rarity: c.rarity, attack: c.attack, health: c.health, upgradeAttack: 0, upgradeHealth: 0 }));
  let essence = 0;
  for (;;) {
    const power = cards.reduce((s, c) => s + c.attack * 2 + c.health, 0);
    const options: { index: number; stat: UpgradeStat }[] = [];
    cards.forEach((c, index) => {
      const stats: UpgradeStat[] = strategy === 'ataque' ? ['attack'] : strategy === 'vida' ? ['health'] : ['attack', 'health'];
      for (const stat of stats) {
        if (power + UPGRADE_POWER[stat] > rules.deckPowerLimit) continue;
        if (checkUpgrade(c, stat, Infinity, rules).ok) options.push({ index, stat });
      }
    });
    if (options.length === 0) break;
    const pick = options[rng.int(options.length)] as { index: number; stat: UpgradeStat };
    essence += upgradeCost((cards[pick.index] as UpgradableCard).rarity, pick.stat);
    cards = cards.map((c, i) => (i === pick.index ? applyUpgrade(c, pick.stat) : c));
  }
  const upgraded = deck.map((c, i) => ({ ...c, attack: (cards[i] as UpgradableCard).attack, health: (cards[i] as UpgradableCard).health }));
  essenceSpent += essence;
  return { deck: upgraded, essence };
}

/** Baralho aleatório sem melhoria e já perto do limite (poder mínimo `min`): o "melhor baralho que dá para ter sem melhorar". */
function strongDeck(min: number): CardDef[] {
  for (let tries = 0; tries < 200_000; tries++) {
    const deck = randomDeck();
    if (deckPower(deck) >= min) return deck;
  }
  throw new Error('Não achei baralho forte');
}

/** Taxa de vitória do baralho A contra o B (a ordem de quem começa é sorteada pelo motor). */
let essenceSpent = 0;

function duel(makeA: () => CardDef[], makeB: () => CardDef[]): { rate: number; powerA: number; powerB: number } {
  let wins = 0;
  let decided = 0;
  let powerA = 0;
  let powerB = 0;
  for (let g = 0; g < GAMES; g++) {
    const a = makeA();
    const b = makeB();
    const problems = validateDeck(a, rules).concat(validateDeck(b, rules));
    if (problems.length > 0) throw new Error(problems.join(' '));
    powerA += deckPower(a);
    powerB += deckPower(b);
    let s = createGame(a, b, rng.int(2 ** 31), rules).state;
    while (s.winner === null) s = applyAction(s, greedyBot(s)).state;
    if (s.winner === 'draw') continue;
    decided++;
    if (s.winner === 0) wins++;
  }
  return { rate: wins / decided, powerA: powerA / GAMES, powerB: powerB / GAMES };
}

console.log(`\nMelhorias até o limite de ${rules.deckPowerLimit} de poder (${GAMES} partidas por linha, bot guloso)`);
console.log('A = baralho aleatório melhorado até o limite; B = outro baralho aleatório SEM melhorias.\n');
console.log('estratégia   poder A  poder B  vitória de A');
const control = duel(randomDeck, randomDeck);
console.log(`${'controle'.padEnd(11)}  ${control.powerA.toFixed(1).padStart(6)}  ${control.powerB.toFixed(1).padStart(6)}   ${(control.rate * 100).toFixed(1)}%  (sem melhoria: deve ficar perto de 50%)`);
for (const strategy of ['ataque', 'vida', 'misto'] as const) {
  essenceSpent = 0;
  const r = duel(() => upgradeDeck(randomDeck(), strategy).deck, randomDeck);
  console.log(`${strategy.padEnd(11)}  ${r.powerA.toFixed(1).padStart(6)}  ${r.powerB.toFixed(1).padStart(6)}   ${(r.rate * 100).toFixed(1)}%   (Essência média gasta para melhorar: ${(essenceSpent / GAMES).toFixed(0)})`);
}
const heavy = duel(() => strongDeck(108), randomDeck);
console.log(`${'pesado'.padEnd(11)}  ${heavy.powerA.toFixed(1).padStart(6)}  ${heavy.powerB.toFixed(1).padStart(6)}   ${(heavy.rate * 100).toFixed(1)}%  (sem melhoria, poder 108+ em cartas caras contra ~100: quase nada. Mais poder por RARIDADE custa energia, e por MELHORIA não custa)`);
const strong = duel(() => upgradeDeck(randomDeck(), 'misto').deck, () => strongDeck(108));
console.log(`${'vs forte'.padEnd(11)}  ${strong.powerA.toFixed(1).padStart(6)}  ${strong.powerB.toFixed(1).padStart(6)}   ${(strong.rate * 100).toFixed(1)}%  (B sem melhoria e com poder 108+: A ainda ganha bem mais, porque a melhoria não custa energia)`);

// Espelho: os dois melhorados (a melhoria não deve quebrar o equilíbrio entre os lados).
const mirror = duel(() => upgradeDeck(randomDeck(), 'misto').deck, () => upgradeDeck(randomDeck(), 'misto').deck);
console.log(`${'espelho'.padEnd(11)}  ${mirror.powerA.toFixed(1).padStart(6)}  ${mirror.powerB.toFixed(1).padStart(6)}   ${(mirror.rate * 100).toFixed(1)}%  (os dois melhorados: perto de 50%)`);

// Economia: quanto custa e quantas partidas leva.
console.log('\nCusto em Essência para esgotar a melhoria de UMA carta (e partidas para pagar, a 50% de vitória)');
const perMatch = (DEFAULT_PROGRESSION.rewardWin + DEFAULT_PROGRESSION.rewardLoss) / 2;
for (const rarity of ['comum', 'incomum', 'rara', 'epica', 'lendaria'] as const) {
  const cap = Math.floor(rules.powerBudget[rarity] * rules.upgradeRatio);
  const total = cap * DEFAULT_PROGRESSION.upgradeCostPerPower[rarity];
  console.log(`  ${rarity.padEnd(9)} +${cap} de poder  ${String(total).padStart(4)} Essência  ~${(total / perMatch).toFixed(1)} partidas`);
}
console.log(`  (média de ${perMatch} Essência por partida a 50% de vitória)`);
