// Tipos do motor. Tudo aqui é dado simples (JSON-serializável), para poder
// trafegar entre app e servidor e ser salvo no banco sem conversão.

export type Element = 'fogo' | 'planta' | 'terra' | 'ar' | 'agua';
export type Rarity = 'comum' | 'incomum' | 'rara' | 'epica' | 'lendaria';

export const ELEMENTS: readonly Element[] = ['fogo', 'planta', 'terra', 'ar', 'agua'];
export const RARITIES: readonly Rarity[] = ['comum', 'incomum', 'rara', 'epica', 'lendaria'];

export interface CardDef {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  attack: number;
  health: number;
}

/** Carta em campo, com a vida atual (o dano persiste entre turnos). */
export interface Creature {
  card: CardDef;
  health: number;
  /** Turno em que entrou em campo. */
  playedOnTurn: number;
}

export interface PlayerState {
  hp: number;
  drawPile: CardDef[];
  discard: CardDef[];
  hand: CardDef[];
  /** Uma posição por índice; null = vazia. */
  field: (Creature | null)[];
}

export type PlayerIndex = 0 | 1;

/** Todas as regras ajustáveis ficam num lugar só, para o simulador variar. */
export interface Rules {
  playerHp: number;
  handSize: number;
  energyPerTurn: number;
  slots: number;
  deckSize: number;
  deckPowerLimit: number;
  /** Fim de jogo por limite de turnos (turnos totais, contando os dois jogadores). */
  maxTurns: number;
  /** Criatura recém-jogada só ataca a partir do próximo turno do dono. */
  summoningSickness: boolean;
  /** Energia extra do segundo jogador no primeiro turno dele (compensa jogar depois). */
  secondPlayerBonusEnergy: number;
  advantageMultiplier: number;
  disadvantageMultiplier: number;
  energyCost: Record<Rarity, number>;
  powerBudget: Record<Rarity, number>;
}

export interface GameState {
  rules: Rules;
  players: [PlayerState, PlayerState];
  /** Número do turno, começando em 1. */
  turn: number;
  active: PlayerIndex;
  /** Quem abriu a partida. */
  firstPlayer: PlayerIndex;
  energy: number;
  /** Estado do gerador de números aleatórios; faz parte do estado do jogo. */
  rngState: number;
  winner: PlayerIndex | 'draw' | null;
}

export type Action =
  | { type: 'play'; handIndex: number; slot: number }
  | { type: 'end' };

export type GameEvent =
  | { type: 'turn_start'; player: PlayerIndex; turn: number }
  | { type: 'draw'; player: PlayerIndex; card: CardDef }
  | { type: 'play'; player: PlayerIndex; card: CardDef; slot: number }
  | {
      type: 'attack_creature';
      player: PlayerIndex;
      slot: number;
      damage: number;
      multiplier: number;
      targetHealthAfter: number;
    }
  | { type: 'attack_player'; player: PlayerIndex; slot: number; damage: number; hpAfter: number }
  | { type: 'creature_died'; player: PlayerIndex; slot: number; card: CardDef }
  | { type: 'game_over'; winner: PlayerIndex | 'draw' };
