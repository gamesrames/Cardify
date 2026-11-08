import { legalActions } from './game';
import { Rng } from './rng';
import { cardPower, damageAgainst, energyCostOf } from './rules';
import type { Action, CardDef, GameState } from './types';

/** Um bot escolhe UMA ação por chamada; quem joga chama de novo até ele devolver { type: 'end' }. */
export type Bot = (state: GameState) => Action;

/** Joga ações legais ao acaso. Serve de piso para comparar com o bot guloso. */
export function makeRandomBot(rng: Rng): Bot {
  return (state) => {
    const actions = legalActions(state);
    // Dá 1/3 de chance de encerrar o turno cedo, para o bot não ser sempre "joga tudo".
    const plays = actions.filter((a) => a.type === 'play');
    if (plays.length === 0 || rng.next() < 0.1) return { type: 'end' };
    return plays[rng.int(plays.length)] as Action;
  };
}

/** Quanto vale colocar `card` na posição `slot`? Maior = melhor. */
function scorePlay(state: GameState, card: CardDef, slot: number): number {
  const foe = state.players[state.active === 0 ? 1 : 0];
  const target = foe.field[slot];
  if (!target) {
    // Posição vazia: o ataque vai direto na vida do jogador.
    return card.attack * 1.0 + card.health * 0.1;
  }
  const dealt = damageAgainst(card, target.card, state.rules);
  const taken = damageAgainst(target.card, card, state.rules);
  const kills = dealt >= target.health;
  const survives = taken < card.health;
  let score = Math.min(dealt, target.health) * 1.0;
  if (kills) score += cardPower(target.card) * 0.5;
  if (!survives) score -= cardPower(card) * 0.3;
  return score;
}

/**
 * Bot "guloso": usa toda a energia que consegue, escolhendo a combinação carta+posição
 * de maior valor (prefere dano direto em posição vazia e elemento com vantagem).
 * Determinístico: o mesmo estado sempre gera a mesma ação.
 */
export const greedyBot: Bot = (state) => {
  const player = state.players[state.active];
  let best: Action = { type: 'end' };
  let bestScore = -Infinity;
  for (const action of legalActions(state)) {
    if (action.type !== 'play') continue;
    const card = player.hand[action.handIndex];
    if (!card) continue;
    // Divide pelo custo de energia só levemente, para não desperdiçar energia com cartas caras.
    const score = scorePlay(state, card, action.slot) / Math.sqrt(energyCostOf(card, state.rules));
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
};
