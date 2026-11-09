import { nextRandom } from './rng';
import { damageAgainst, elementMultiplier, energyCostOf } from './rules';
import { DEFAULT_RULES } from './rules';
import { validateDeck } from './deck';
import type {
  Action,
  CardDef,
  GameEvent,
  GameState,
  PlayerIndex,
  PlayerState,
  Rules,
} from './types';

// O motor é puro: nada de tela, relógio, rede ou Math.random.
// createGame e applyAction recebem um estado e devolvem um estado NOVO (o antigo não muda).
// Isso permite rodar o mesmo código no celular e no servidor e repetir qualquer partida pela semente.

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

/** Cópia profunda. O estado é JSON puro, então isto funciona em qualquer ambiente (inclusive no celular). */
function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

function other(p: PlayerIndex): PlayerIndex {
  return p === 0 ? 1 : 0;
}

/** Sorteia usando (e atualizando) o estado do RNG do jogo. Só mexe em estados já clonados. */
function rand(state: GameState): number {
  const r = nextRandom(state.rngState);
  state.rngState = r.next;
  return r.value;
}

function shuffleInPlace<T>(state: GameState, items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand(state) * (i + 1));
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
}

function newPlayer(deck: readonly CardDef[], rules: Rules): PlayerState {
  return {
    hp: rules.playerHp,
    drawPile: deck.slice(),
    discard: [],
    hand: [],
    field: Array.from({ length: rules.slots }, () => null),
  };
}

export function createGame(
  deckA: readonly CardDef[],
  deckB: readonly CardDef[],
  seed: number,
  rules: Rules = DEFAULT_RULES,
): StepResult {
  for (const deck of [deckA, deckB]) {
    const problems = validateDeck(deck, rules);
    if (problems.length > 0) throw new Error(`Baralho inválido: ${problems.join(' ')}`);
  }
  const state: GameState = {
    rules,
    players: [newPlayer(deckA, rules), newPlayer(deckB, rules)],
    turn: 0,
    active: 0,
    firstPlayer: 0,
    energy: 0,
    rngState: seed | 0,
    winner: null,
    endReason: null,
  };
  shuffleInPlace(state, state.players[0].drawPile);
  shuffleInPlace(state, state.players[1].drawPile);
  state.active = rand(state) < 0.5 ? 0 : 1;
  state.firstPlayer = state.active;
  const events: GameEvent[] = [];
  startTurn(state, events);
  return { state, events };
}

function drawCard(state: GameState, p: PlayerIndex, events: GameEvent[]): void {
  const player = state.players[p];
  if (player.drawPile.length === 0) {
    if (player.discard.length === 0) return;
    player.drawPile = player.discard;
    player.discard = [];
    shuffleInPlace(state, player.drawPile);
  }
  const card = player.drawPile.pop();
  if (card) {
    player.hand.push(card);
    events.push({ type: 'draw', player: p, card });
  }
}

function startTurn(state: GameState, events: GameEvent[]): void {
  state.turn += 1;
  state.energy = state.rules.energyPerTurn;
  // O segundo jogador ganha energia extra no primeiro turno dele (turno 2 da partida).
  if (state.turn === 2) state.energy += state.rules.secondPlayerBonusEnergy;
  events.push({ type: 'turn_start', player: state.active, turn: state.turn });
  const player = state.players[state.active];
  while (player.hand.length < state.rules.handSize) {
    const before = player.hand.length;
    drawCard(state, state.active, events);
    if (player.hand.length === before) break; // sem mais cartas para comprar
  }
}

export function legalActions(state: GameState): Action[] {
  if (state.winner !== null) return [];
  const actions: Action[] = [];
  const player = state.players[state.active];
  player.hand.forEach((card, handIndex) => {
    if (energyCostOf(card, state.rules) > state.energy) return;
    player.field.forEach((occupant, slot) => {
      if (occupant === null) actions.push({ type: 'play', handIndex, slot });
    });
  });
  actions.push({ type: 'end' });
  return actions;
}

/** Ação de jogada ou de fim de turno é legal? (Desistência é tratada à parte em `applyAction`.) */
export function isLegal(state: GameState, action: Exclude<Action, { type: 'forfeit' }>): boolean {
  return legalActions(state).some(
    (a) =>
      a.type === action.type &&
      (a.type === 'end' || (action.type === 'play' && a.handIndex === action.handIndex && a.slot === action.slot)),
  );
}

export function applyAction(prev: GameState, action: Action): StepResult {
  if (action.type === 'forfeit') return forfeit(prev, action.player);
  if (!isLegal(prev, action)) {
    throw new Error(`Ação ilegal: ${JSON.stringify(action)}`);
  }
  const state = clone(prev);
  const events: GameEvent[] = [];

  if (action.type === 'play') {
    const player = state.players[state.active];
    const [card] = player.hand.splice(action.handIndex, 1);
    if (!card) throw new Error('Índice de mão inválido');
    state.energy -= energyCostOf(card, state.rules);
    player.field[action.slot] = { card, health: card.health, playedOnTurn: state.turn };
    events.push({ type: 'play', player: state.active, card, slot: action.slot });
    return { state, events };
  }

  resolveAttacks(state, events);
  if (state.winner === null && state.turn >= state.rules.maxTurns) {
    const a = state.players[0].hp;
    const b = state.players[1].hp;
    state.winner = a === b ? 'draw' : a > b ? 0 : 1;
    state.endReason = 'turn_limit';
    events.push({ type: 'game_over', winner: state.winner, reason: 'turn_limit' });
  }
  if (state.winner === null) {
    state.active = other(state.active);
    startTurn(state, events);
  }
  return { state, events };
}

/** Desistência: encerra na hora e dá a vitória ao adversário. Não mexe em vida, campo nem mãos. */
function forfeit(prev: GameState, player: PlayerIndex): StepResult {
  if (player !== 0 && player !== 1) throw new Error(`Jogador inválido: ${String(player)}`);
  if (prev.winner !== null) throw new Error('A partida já terminou: não dá para desistir.');
  const state = clone(prev);
  state.winner = other(player);
  state.endReason = 'forfeit';
  return { state, events: [{ type: 'game_over', winner: state.winner, reason: 'forfeit' }] };
}

/** No fim do turno, cada criatura do jogador ativo ataca a posição oposta, da esquerda para a direita. */
function resolveAttacks(state: GameState, events: GameEvent[]): void {
  const me = state.active;
  const foe = other(me);
  const mine = state.players[me];
  const theirs = state.players[foe];
  for (let slot = 0; slot < state.rules.slots; slot++) {
    const attacker = mine.field[slot];
    if (!attacker) continue;
    if (state.rules.summoningSickness && attacker.playedOnTurn === state.turn) continue;
    const target = theirs.field[slot];
    if (!target) {
      theirs.hp -= attacker.card.attack;
      events.push({ type: 'attack_player', player: me, slot, damage: attacker.card.attack, hpAfter: theirs.hp });
      if (theirs.hp <= 0) {
        state.winner = me;
        state.endReason = 'hp_zero';
        events.push({ type: 'game_over', winner: me, reason: 'hp_zero' });
        return;
      }
      continue;
    }
    const damage = damageAgainst(attacker.card, target.card, state.rules);
    target.health -= damage;
    events.push({
      type: 'attack_creature',
      player: me,
      slot,
      damage,
      multiplier: elementMultiplier(attacker.card.element, target.card.element, state.rules),
      targetHealthAfter: target.health,
    });
    if (target.health <= 0) {
      theirs.field[slot] = null;
      theirs.discard.push(target.card);
      events.push({ type: 'creature_died', player: foe, slot, card: target.card });
    }
  }
}
