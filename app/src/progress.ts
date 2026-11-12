// Fase 5 no app: tipos e textos da progressão e do ranking. Sem React Native: testável no Node.
// Quem DECIDE custo, teto, saldo e rating é o servidor (docs/progressao.md); aqui só se mostra o que o motor
// prevê (`checkUpgrade`) e se traduzem as respostas do servidor.
import { DEFAULT_PROGRESSION, DEFAULT_RULES, checkUpgrade, upgradeCap, upgradePowerSpent } from './motor';
import type { CardDef, Element, Rarity, UpgradableCard, UpgradeStat } from './motor';

/** Carta de foto do jogador, como a tabela `cards` devolve (atributos já incluem as melhorias). */
export interface PhotoCardRow {
  id: string;
  name: string;
  element: Element;
  rarity: Rarity;
  attack: number;
  health: number;
  photo_path: string;
  upgrade_attack: number;
  upgrade_health: number;
}

export interface PlayerStats {
  rating: number;
  essence: number;
  wins: number;
  losses: number;
  draws: number;
  rated_matches: number;
}

/** Quem ainda não jogou nenhuma partida pontuada não tem linha em `player_stats`: vale isto. */
export const EMPTY_STATS: PlayerStats = {
  rating: DEFAULT_PROGRESSION.startRating,
  essence: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  rated_matches: 0,
};

export interface LeaderboardRow {
  rank: number;
  display_name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  is_me: boolean;
}

export interface HistoryRow {
  match_id: string;
  finished_at: string;
  result: 'win' | 'loss' | 'draw';
  cause: string;
  rated: boolean;
  rating_delta: number;
  essence: number;
  foe_name: string;
}

/** Linha de `match_results` (resultado de uma partida, visível aos dois jogadores). */
export interface MatchResultRow {
  rated: boolean;
  host_delta: number;
  guest_delta: number;
  host_essence: number;
  guest_essence: number;
}

export function rowToCardDef(row: PhotoCardRow): CardDef {
  return { id: row.id, name: row.name, element: row.element, rarity: row.rarity, attack: row.attack, health: row.health };
}

export function toUpgradable(row: PhotoCardRow): UpgradableCard {
  return {
    rarity: row.rarity,
    attack: row.attack,
    health: row.health,
    upgradeAttack: row.upgrade_attack,
    upgradeHealth: row.upgrade_health,
  };
}

export interface UpgradeOption {
  stat: UpgradeStat;
  label: string;
  cost: number;
  /** `ok`: dá para comprar; `cap`: a carta não comporta este passo; `essence`: falta saldo. */
  state: 'ok' | 'cap' | 'essence';
}

/** As duas compras possíveis de uma carta (+1 vida, +1 ataque), com custo e se cabem agora. */
export function upgradeOptions(row: PhotoCardRow, essence: number): UpgradeOption[] {
  const card = toUpgradable(row);
  return (['health', 'attack'] as const).map((stat) => {
    const check = checkUpgrade(card, stat, essence, DEFAULT_RULES);
    return {
      stat,
      label: stat === 'health' ? '+1 vida' : '+1 ataque',
      cost: check.cost,
      state: check.ok ? 'ok' : check.reason,
    };
  });
}

/** "1/2": pontos de poder de melhoria já usados / teto da carta. */
export function upgradeProgress(row: PhotoCardRow): { used: number; cap: number } {
  return { used: upgradePowerSpent(toUpgradable(row)), cap: upgradeCap(row.rarity, DEFAULT_RULES) };
}

/** Cartas na mesma ordem em que o jogador as vê: as que ainda têm o que melhorar primeiro. */
export function sortForUpgrade(rows: readonly PhotoCardRow[]): PhotoCardRow[] {
  const room = (r: PhotoCardRow) => {
    const p = upgradeProgress(r);
    return p.cap - p.used;
  };
  return [...rows].sort((a, b) => Number(room(b) > 0) - Number(room(a) > 0));
}

// ---- Erros do servidor ----

export class ProgressError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProgressError';
  }
}

const UPGRADE_ERRORS: Record<string, string> = {
  upgrade_cap: 'Esta carta já está no limite de melhorias.',
  not_enough_essence: 'Essência insuficiente. Jogue partidas online para ganhar mais.',
  card_not_found: 'Não achei essa carta na sua coleção.',
  invalid_stat: 'Melhoria inválida.',
  unauthorized: 'Entre no app para melhorar cartas.',
};

/** Erro do Supabase (PostgREST) → erro com texto em português. Funções e tabelas ausentes = migração não aplicada. */
export function progressErrorFrom(error: { code?: string; message?: string }, fallback: string): ProgressError {
  const message = error.message ?? '';
  const known = Object.keys(UPGRADE_ERRORS).find((code) => message.includes(code));
  if (known) return new ProgressError(known, UPGRADE_ERRORS[known] as string);
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '')) {
    return new ProgressError('not_deployed', 'O servidor ainda não tem a progressão (aplique a migração da fase 5 no Supabase).');
  }
  return new ProgressError('unexpected', fallback);
}

// ---- Textos ----

/** "+16", "−16" (sinal de menos de verdade) ou "0". */
export function formatDelta(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

const CAUSES: Record<string, string> = {
  hp_zero: 'vida zerada',
  turn_limit: 'limite de turnos',
  forfeit: 'desistência',
  timeout: 'tempo esgotado',
  abandoned: 'abandono',
};

export function describeCause(cause: string): string {
  return CAUSES[cause] ?? cause;
}

export interface RewardInfo {
  rated: boolean;
  /** Variação de rating de quem olha. */
  rating: number;
  essence: number;
}

/** O ganho da partida do ponto de vista do lado `seat` (0 = quem criou, 1 = quem entrou). */
export function rewardFor(result: MatchResultRow, seat: 0 | 1): RewardInfo {
  return {
    rated: result.rated,
    rating: seat === 0 ? result.host_delta : result.guest_delta,
    essence: seat === 0 ? result.host_essence : result.guest_essence,
  };
}
