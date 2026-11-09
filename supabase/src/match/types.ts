import type { CardDef, GameEvent, GameState, PlayerView } from '../motor';

// Contrato entre a função `match` e o app. O app importa SÓ ESTE ARQUIVO (tipos puros).

/** Como a partida terminou. `forfeit` = desistiu; `timeout` = estourou o tempo; `abandoned` = sumiu. */
export type MatchEndCause = 'hp_zero' | 'turn_limit' | 'forfeit' | 'timeout' | 'abandoned' | 'cancelled';

/** Convite aguardando o segundo jogador. */
export interface WaitingView {
  kind: 'waiting';
  matchId: string;
  code: string;
  /** Relógio do servidor quando a linha foi gravada (para o app corrigir a diferença do relógio do aparelho). */
  serverNowMs: number;
}

/** Partida em andamento ou terminada, do ponto de vista de UM jogador. Sem segredos do adversário. */
export interface GameViewData {
  kind: 'game';
  matchId: string;
  version: number;
  serverNowMs: number;
  /** Fim do turno atual (ms desde 1970, relógio do servidor); null com a partida terminada. */
  deadlineMs: number | null;
  turnSeconds: number;
  maxMissedTurns: number;
  /** Turnos seguidos que cada lado deixou estourar: [eu, adversário]. */
  missed: [number, number];
  myName: string | null;
  foeName: string | null;
  endCause: MatchEndCause | null;
  game: PlayerView;
  /** id da carta -> caminho da foto no Storage (minhas cartas e as do adversário que já foram jogadas). */
  photos: Record<string, string>;
  /** Últimos eventos que este jogador pode ver; `logStart` é o índice do primeiro (ids estáveis no log). */
  log: GameEvent[];
  logStart: number;
}

export type MatchViewData = WaitingView | GameViewData;

/** Linha de `match_views` como o app a lê. */
export interface MatchViewRow {
  match_id: string;
  version: number;
  status: 'waiting' | 'active' | 'finished';
  view: MatchViewData;
  updated_at: string;
}

export type MatchRequest =
  | { op: 'create' }
  | { op: 'join'; code: string }
  | { op: 'play'; matchId: string; version: number; handIndex: number; slot: number }
  | { op: 'end'; matchId: string; version: number }
  | { op: 'forfeit'; matchId: string }
  | { op: 'timeout'; matchId: string }
  /** O criador desiste do convite antes de alguém entrar. */
  | { op: 'cancel'; matchId: string };

/** Resposta de sucesso: a visão nova do próprio jogador (o adversário recebe a dele pelo Realtime). */
export interface MatchResponse {
  matchId: string;
  /** null só em `cancel`. */
  view: MatchViewData | null;
}

/** Linha de `match_get` (só o servidor vê). */
export interface MatchRow {
  id: string;
  code: string;
  status: 'waiting' | 'active' | 'finished';
  host_id: string;
  guest_id: string | null;
  host_name: string | null;
  guest_name: string | null;
  host_deck: CardDef[];
  card_photos: Record<string, string>;
  state: GameState | null;
  events: GameEvent[];
  version: number;
  turn_deadline: string | null;
  missed_turns: [number, number];
  end_cause: MatchEndCause | null;
}
