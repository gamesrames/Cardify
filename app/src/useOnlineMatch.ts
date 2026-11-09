import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { MatchError, newerRow } from './matchApi';
import type { MatchRequest, MatchViewRow } from './matchApi';
import { fetchMatchRow, sendMatch } from './matchClient';
import { requireClient } from './supabase';

/** Intervalo da consulta de reserva (o Realtime é o caminho principal; isto cobre queda de conexão). */
const POLL_WAITING_MS = 3000;
const POLL_ACTIVE_MS = 5000;

export interface OnlineMatch {
  row: MatchViewRow | null;
  /** Hora do aparelho em que a visão atual chegou (para corrigir a diferença de relógio com o servidor). */
  receivedAt: number;
  loading: boolean;
  /** Último erro para mostrar ao jogador (limpa na próxima ação bem-sucedida). */
  error: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
  /** Manda uma ação ao servidor. `silent` = não mostra erro (usado no pedido automático de estouro). */
  act: (request: MatchRequest, options?: { silent?: boolean }) => Promise<boolean>;
}

/**
 * Mantém a visão da partida atualizada: Realtime (mudança na minha linha de `match_views`), consulta
 * periódica de reserva e consulta ao voltar para o app. Quem escreve é sempre o servidor; aqui só se pede.
 */
export function useOnlineMatch(matchId: string): OnlineMatch {
  const [row, setRow] = useState<MatchViewRow | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const rowRef = useRef<MatchViewRow | null>(null);

  const accept = useCallback((incoming: MatchViewRow | null) => {
    if (!incoming || !mounted.current) return;
    const current = rowRef.current;
    // Mesma versão e mesmo estado (consulta repetida): ignora, senão o relógio de `receivedAt` andaria à toa.
    if (current && current.version === incoming.version && current.status === incoming.status) return;
    const next = newerRow(current, incoming);
    if (next === current) return;
    rowRef.current = next;
    setRow(next);
    setReceivedAt(Date.now());
  }, []);

  const refresh = useCallback(async () => {
    try {
      accept(await fetchMatchRow(matchId));
      if (mounted.current) setError(null);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Falha ao atualizar a partida.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [matchId, accept]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const client = requireClient();
    // O evento só diz "mudou"; a visão em si vem da consulta (passa pela RLS e é sempre completa).
    const channel = client
      .channel(`partida-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_views', filter: `match_id=eq.${matchId}` }, () => void refresh())
      .subscribe();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && void refresh());
    return () => {
      mounted.current = false;
      appState.remove();
      void client.removeChannel(channel);
    };
  }, [matchId, refresh]);

  const status = row?.status;
  useEffect(() => {
    if (status === 'finished') return;
    const timer = setInterval(() => void refresh(), status === 'waiting' ? POLL_WAITING_MS : POLL_ACTIVE_MS);
    return () => clearInterval(timer);
  }, [status, refresh]);

  const act = useCallback(
    async (request: MatchRequest, options?: { silent?: boolean }) => {
      setBusy(true);
      try {
        const res = await sendMatch(request);
        if (res.view && mounted.current) {
          accept({
            match_id: res.matchId,
            version: res.view.kind === 'game' ? res.view.version : 0,
            status: res.view.kind === 'game' && res.view.game.winner !== null ? 'finished' : res.view.kind === 'game' ? 'active' : 'waiting',
            view: res.view,
            updated_at: new Date().toISOString(),
          });
          setError(null);
        } else if (!res.view) {
          await refresh(); // cancelar convite: a visão passou a "finished"
        }
        return true;
      } catch (e) {
        const stale = e instanceof MatchError && (e.code === 'stale_state' || e.code === 'match_finished' || e.code === 'not_your_turn');
        if (stale) await refresh(); // a tela estava velha: mostra o estado de verdade
        if (!options?.silent && mounted.current) setError(e instanceof Error ? e.message : 'Algo deu errado.');
        return false;
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [accept, refresh],
  );

  return { row, receivedAt, loading, error, busy, refresh, act };
}
