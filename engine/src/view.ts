import { legalActions } from './game';
import type { Action, CardDef, Creature, GameEndReason, GameEvent, GameState, PlayerIndex, Rules } from './types';

// Visão de um jogador sobre a partida (fase 4, 1x1 online).
// O GameState completo tem segredos: a mão do adversário, a ORDEM dos montes e o estado do sorteio
// (`rngState`, que permitiria prever as próximas compras). O servidor guarda o estado inteiro e manda a
// cada jogador só esta visão. É função pura e JSON puro, como o resto do motor.

/** O que os dois jogadores podem ver de qualquer um deles. */
export interface PublicPlayerView {
  hp: number;
  field: (Creature | null)[];
  /** Criaturas que morreram: ficam à vista, porque já foram jogadas em campo. */
  discard: CardDef[];
  /** Só a quantidade; quais cartas são é segredo. */
  handCount: number;
  drawCount: number;
}

/** O que o dono vê de si mesmo: inclui a mão. */
export interface OwnPlayerView extends PublicPlayerView {
  hand: CardDef[];
}

export interface PlayerView {
  rules: Rules;
  /** Em qual lado do motor (0 ou 1) este jogador está. */
  seat: PlayerIndex;
  turn: number;
  active: PlayerIndex;
  firstPlayer: PlayerIndex;
  /** Energia do turno atual (de quem é a vez). */
  energy: number;
  winner: PlayerIndex | 'draw' | null;
  endReason: GameEndReason | null;
  me: OwnPlayerView;
  foe: PublicPlayerView;
  /**
   * Ações que o motor permite agora a ESTE jogador (jogadas e fim de turno). Vazio se não é a vez dele
   * ou a partida acabou. Desistir não entra aqui, como em `legalActions`. Assim a tela não precisa
   * recalcular regra nenhuma.
   */
  legal: Action[];
}

function publicPart(state: GameState, seat: PlayerIndex) {
  const p = state.players[seat];
  return {
    hp: p.hp,
    field: p.field,
    discard: p.discard,
    handCount: p.hand.length,
    drawCount: p.drawPile.length,
  };
}

/** Visão do jogador `seat`. Não inclui a mão nem o monte do adversário, nem `rngState`. */
export function viewFor(state: GameState, seat: PlayerIndex): PlayerView {
  const foeSeat: PlayerIndex = seat === 0 ? 1 : 0;
  return {
    rules: state.rules,
    seat,
    turn: state.turn,
    active: state.active,
    firstPlayer: state.firstPlayer,
    energy: state.energy,
    winner: state.winner,
    endReason: state.endReason,
    me: { ...publicPart(state, seat), hand: state.players[seat].hand },
    foe: publicPart(state, foeSeat),
    legal: state.active === seat ? legalActions(state) : [],
  };
}

/**
 * Eventos que `seat` pode ver: as compras do adversário somem (quais cartas ele comprou é segredo).
 * Todo o resto (jogadas, ataques, mortes, fim) é público.
 */
export function redactEvents(events: readonly GameEvent[], seat: PlayerIndex): GameEvent[] {
  return events.filter((e) => !(e.type === 'draw' && e.player !== seat));
}
