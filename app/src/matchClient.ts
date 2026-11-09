// Liga o Supabase do app às partidas online: pedidos à função `match` e leitura das visões (tabela
// `match_views`, em que a RLS só devolve a linha do próprio jogador).
import { callMatch } from './matchApi';
import type { MatchRequest, MatchViewRow } from './matchApi';
import { ensureSession, requireClient, supabaseKey, supabaseUrl } from './supabase';

export async function sendMatch(request: MatchRequest) {
  const session = await ensureSession();
  return callMatch({ baseUrl: supabaseUrl, apiKey: supabaseKey, accessToken: session.access_token, request });
}

const COLUMNS = 'match_id, version, status, view, updated_at';

/** A minha visão desta partida, ou `null` se não existe ou não é minha. */
export async function fetchMatchRow(matchId: string): Promise<MatchViewRow | null> {
  const { data, error } = await requireClient().from('match_views').select(COLUMNS).eq('match_id', matchId).maybeSingle();
  if (error) throw new Error('Não consegui carregar a partida.');
  return (data as MatchViewRow | null) ?? null;
}

/** Partida em aberto (esperando adversário ou em andamento) do jogador, a mais recente; `null` se não há. */
export async function fetchOpenMatch(): Promise<MatchViewRow | null> {
  const { data, error } = await requireClient()
    .from('match_views')
    .select(COLUMNS)
    .in('status', ['waiting', 'active'])
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error) throw new Error('Não consegui verificar se você tem uma partida em andamento.');
  return ((data ?? [])[0] as MatchViewRow | undefined) ?? null;
}
