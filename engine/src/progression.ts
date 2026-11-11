import { upgradeCap } from './rules';
import type { Rarity, Rules } from './types';

// Fase 5: progressão (melhorar cartas com Essência) e ranking (rating Elo das partidas online).
// Tudo aqui é função pura e a REFERÊNCIA das regras (fórmulas em docs/game-design.md, "Progressão e ranking").
// O servidor aplica as mesmas regras em SQL (supabase/migrations/20261111000001_progressao_ranking.sql, que
// copia estes números para as tabelas `upgrade_rules` e `app_config`); `supabase/test/progressao.test.ts`
// confere que o SQL e este arquivo dão os mesmos resultados. O app usa este arquivo só para MOSTRAR
// custos e previsões; quem decide é sempre o servidor.

// ---------------------------------------------------------------------------------------------
// Melhoria de cartas
// ---------------------------------------------------------------------------------------------

export type UpgradeStat = 'attack' | 'health';

/**
 * Poder que cada passo de melhoria consome do teto da carta. Poder = Ataque×2 + Vida, então +1 de ataque
 * vale 2 pontos de poder e +1 de vida vale 1. O jogador escolhe a cada passo; o teto (`upgradeCap`) é em poder.
 */
export const UPGRADE_POWER: Record<UpgradeStat, number> = { attack: 2, health: 1 };

export interface ProgressionRules {
  /** Essência gasta por ponto de poder ganho, por raridade (+1 vida custa 1×, +1 ataque custa 2×). */
  upgradeCostPerPower: Record<Rarity, number>;
  /** Essência por partida online, conforme o resultado. */
  rewardWin: number;
  rewardDraw: number;
  /** Derrota "normal" (vida zerada ou limite de turnos). Quem desistiu/estourou o tempo/sumiu ganha 0. */
  rewardLoss: number;
  /** Partida mais curta que isto (turnos totais) não rende Essência: desistir no 1º turno não paga. */
  rewardMinTurns: number;
  /** Fator K do Elo: quanto o rating se mexe por partida. */
  eloK: number;
  startRating: number;
  ratingFloor: number;
}

export const DEFAULT_PROGRESSION: ProgressionRules = {
  upgradeCostPerPower: { comum: 10, incomum: 15, rara: 20, epica: 30, lendaria: 40 },
  rewardWin: 30,
  rewardDraw: 20,
  rewardLoss: 10,
  rewardMinTurns: 6,
  eloK: 32,
  startRating: 1000,
  ratingFloor: 0,
};

/** O que importa de uma carta de foto para melhorá-la. `attack`/`health` já incluem as melhorias feitas. */
export interface UpgradableCard {
  rarity: Rarity;
  attack: number;
  health: number;
  /** Quantos passos de ataque/vida já foram comprados. */
  upgradeAttack: number;
  upgradeHealth: number;
}

/** Poder já gasto em melhorias (conta contra `upgradeCap`). */
export function upgradePowerSpent(card: Pick<UpgradableCard, 'upgradeAttack' | 'upgradeHealth'>): number {
  return card.upgradeAttack * UPGRADE_POWER.attack + card.upgradeHealth * UPGRADE_POWER.health;
}

/** Quanto poder ainda dá para ganhar com melhorias nesta carta. */
export function upgradeRoom(card: UpgradableCard, rules: Rules): number {
  return upgradeCap(card.rarity, rules) - upgradePowerSpent(card);
}

/** Custo em Essência de UM passo de melhoria (independe de quantas já foram feitas: custo fixo por passo). */
export function upgradeCost(rarity: Rarity, stat: UpgradeStat, progression: ProgressionRules = DEFAULT_PROGRESSION): number {
  return progression.upgradeCostPerPower[rarity] * UPGRADE_POWER[stat];
}

export type UpgradeCheck =
  | { ok: true; cost: number }
  /** `cap`: a carta já está no teto de melhoria; `essence`: saldo insuficiente (`cost` = o que custaria). */
  | { ok: false; reason: 'cap' | 'essence'; cost: number };

export function checkUpgrade(
  card: UpgradableCard,
  stat: UpgradeStat,
  essence: number,
  rules: Rules,
  progression: ProgressionRules = DEFAULT_PROGRESSION,
): UpgradeCheck {
  const cost = upgradeCost(card.rarity, stat, progression);
  if (UPGRADE_POWER[stat] > upgradeRoom(card, rules)) return { ok: false, reason: 'cap', cost };
  if (essence < cost) return { ok: false, reason: 'essence', cost };
  return { ok: true, cost };
}

/** A carta depois de UM passo (não confere saldo nem teto: use `checkUpgrade` antes). */
export function applyUpgrade(card: UpgradableCard, stat: UpgradeStat): UpgradableCard {
  return stat === 'attack'
    ? { ...card, attack: card.attack + 1, upgradeAttack: card.upgradeAttack + 1 }
    : { ...card, health: card.health + 1, upgradeHealth: card.upgradeHealth + 1 };
}

// ---------------------------------------------------------------------------------------------
// Ranking (Elo) e recompensas de partida
// ---------------------------------------------------------------------------------------------

/** Como a partida online terminou (igual a `MatchEndCause` do servidor, sem `cancelled`, que nunca é pontuada). */
export type SettleCause = 'hp_zero' | 'turn_limit' | 'forfeit' | 'timeout' | 'abandoned';

/** Chance (0 a 1) de o jogador com `rating` vencer o adversário com `foeRating`. */
export function expectedScore(rating: number, foeRating: number): number {
  return 1 / (1 + Math.pow(10, (foeRating - rating) / 400));
}

/** Arredonda para o inteiro mais próximo, metades para longe do zero (igual ao `round(numeric)` do Postgres). */
function roundHalfAway(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x);
}

/** Variação de rating de quem fez `score` (1 vitória, 0,5 empate, 0 derrota). O adversário recebe o oposto. */
export function ratingDelta(
  rating: number,
  foeRating: number,
  score: 0 | 0.5 | 1,
  progression: ProgressionRules = DEFAULT_PROGRESSION,
): number {
  return roundHalfAway(progression.eloK * (score - expectedScore(rating, foeRating)));
}

export interface SettleInput {
  ratings: [number, number];
  /** Lado vencedor do motor (0 = criador da partida, 1 = quem entrou) ou 'draw'. */
  winner: 0 | 1 | 'draw';
  cause: SettleCause;
  /** Turno em que a partida terminou (`state.turn` do motor, contando os dois jogadores). */
  turns: number;
  /** `false` quando o par já jogou o máximo de partidas pontuadas hoje: a partida vira amistosa. */
  rated: boolean;
}

export interface SettleResult {
  rated: boolean;
  /** Variação de rating por lado. Soma zero, a não ser que o piso de rating corte uma derrota. */
  ratingDelta: [number, number];
  ratingAfter: [number, number];
  /** Essência ganha por lado. */
  essence: [number, number];
}

/**
 * Resultado de uma partida online para os dois lados.
 *  - Rating (só se `rated`): Elo com K fixo, zero-soma, com piso. Desistir, estourar o tempo ou sumir = derrota normal
 *    (senão desistir ao ver o adversário forte "fugiria" da derrota).
 *  - Essência (só se `rated` e a partida durou `rewardMinTurns` turnos ou mais): vitória e empate pagam;
 *    derrota paga só a quem lutou até o fim (vida zerada ou limite de turnos), não a quem desistiu, estourou o tempo ou sumiu.
 */
export function settleMatch(input: SettleInput, progression: ProgressionRules = DEFAULT_PROGRESSION): SettleResult {
  const [r0, r1] = input.ratings;
  const scores: [0 | 0.5 | 1, 0 | 0.5 | 1] = input.winner === 'draw' ? [0.5, 0.5] : input.winner === 0 ? [1, 0] : [0, 1];
  if (!input.rated) return { rated: false, ratingDelta: [0, 0], ratingAfter: [r0, r1], essence: [0, 0] };

  const d0 = ratingDelta(r0, r1, scores[0], progression);
  const after0 = Math.max(progression.ratingFloor, r0 + d0);
  const after1 = Math.max(progression.ratingFloor, r1 - d0);

  const quitter = input.cause === 'forfeit' || input.cause === 'timeout' || input.cause === 'abandoned';
  const long = input.turns >= progression.rewardMinTurns;
  const essenceFor = (seat: 0 | 1): number => {
    if (!long) return 0;
    if (input.winner === 'draw') return progression.rewardDraw;
    if (input.winner === seat) return progression.rewardWin;
    return quitter ? 0 : progression.rewardLoss;
  };
  return {
    rated: true,
    ratingDelta: [after0 - r0, after1 - r1],
    ratingAfter: [after0, after1],
    essence: [essenceFor(0), essenceFor(1)],
  };
}
