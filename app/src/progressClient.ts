// Liga o Supabase do app à progressão e ao ranking (fase 5). Só LÊ tabelas (a RLS devolve o que é do jogador)
// e chama as funções do servidor; nenhuma regra mora aqui (docs/progressao.md).
import { EMPTY_STATS, progressErrorFrom } from './progress';
import type { HistoryRow, LeaderboardRow, MatchResultRow, PhotoCardRow, PlayerStats } from './progress';
import type { UpgradeStat } from './motor';
import { ensureSession, requireClient } from './supabase';

/** Saldo e rating do jogador. Quem nunca jogou uma partida pontuada não tem linha: vale o padrão. */
export async function fetchStats(): Promise<PlayerStats> {
  const supabase = requireClient();
  await ensureSession();
  const { data, error } = await supabase
    .from('player_stats')
    .select('rating, essence, wins, losses, draws, rated_matches')
    .maybeSingle();
  if (error) throw progressErrorFrom(error, 'Não consegui carregar o seu saldo.');
  return (data as PlayerStats | null) ?? EMPTY_STATS;
}

/** Cartas de foto do jogador (as fixas não melhoram), mais novas primeiro. */
export async function fetchPhotoCards(): Promise<PhotoCardRow[]> {
  const supabase = requireClient();
  await ensureSession();
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, element, rarity, attack, health, photo_path, upgrade_attack, upgrade_health')
    .order('created_at', { ascending: false });
  if (error) throw progressErrorFrom(error, 'Não consegui carregar as suas cartas.');
  return (data ?? []) as PhotoCardRow[];
}

export interface UpgradeResult {
  attack: number;
  health: number;
  upgrade_attack: number;
  upgrade_health: number;
  essence: number;
}

/** Compra UM passo de melhoria. O servidor confere dono, teto e saldo. */
export async function upgradeCard(cardId: string, stat: UpgradeStat): Promise<UpgradeResult> {
  const supabase = requireClient();
  await ensureSession();
  const { data, error } = await supabase.rpc('upgrade_card', { p_card: cardId, p_stat: stat });
  if (error) throw progressErrorFrom(error, 'Não consegui melhorar a carta. Tente de novo.');
  return data as UpgradeResult;
}

export async function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await requireClient().rpc('leaderboard', { p_limit: limit });
  if (error) throw progressErrorFrom(error, 'Não consegui carregar o ranking.');
  return ((data ?? []) as LeaderboardRow[]).map((r) => ({ ...r, rank: Number(r.rank) }));
}

export async function fetchHistory(limit = 10): Promise<HistoryRow[]> {
  const { data, error } = await requireClient().rpc('my_match_history', { p_limit: limit });
  if (error) throw progressErrorFrom(error, 'Não consegui carregar o histórico.');
  return (data ?? []) as HistoryRow[];
}

/** Resultado de uma partida (some até o servidor terminar de pontuar; `null` = ainda não existe). */
export async function fetchMatchResult(matchId: string): Promise<MatchResultRow | null> {
  const { data, error } = await requireClient()
    .from('match_results')
    .select('rated, host_delta, guest_delta, host_essence, guest_essence')
    .eq('match_id', matchId)
    .maybeSingle();
  if (error) throw progressErrorFrom(error, 'Não consegui carregar o resultado.');
  return (data as MatchResultRow | null) ?? null;
}
