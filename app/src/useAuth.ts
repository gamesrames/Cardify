import { useEffect, useState } from 'react';
import { getStoredSession, isSupabaseConfigured, requireClient } from './supabase';

export interface AuthUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

/**
 * `off`: app sem servidor configurado (modo offline da fase 1). `loading`: lendo a sessão guardada.
 * `out`: ninguém entrou (mostra as boas-vindas). `in`: logado, como convidado ou com conta.
 */
export type AuthState = { status: 'off' | 'loading' | 'out' } | { status: 'in'; user: AuthUser };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: isSupabaseConfigured ? 'loading' : 'off' });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const toState = (session: { user: { id: string; email?: string; is_anonymous?: boolean } } | null): AuthState =>
      session
        ? {
            status: 'in',
            // Convidado = login anônimo SEM e-mail. (Depois de criar a conta o e-mail existe, mesmo que o
            // servidor demore a trocar a marca `is_anonymous`.)
            user: { id: session.user.id, email: session.user.email || null, isAnonymous: session.user.is_anonymous === true && !session.user.email },
          }
        : { status: 'out' };

    void getStoredSession().then((session) => active && setState(toState(session)));
    // Mudanças de sessão (entrar, sair, virar conta). O callback não pode esperar chamadas ao Supabase.
    const { data } = requireClient().auth.onAuthStateChange((_event, session) => {
      if (active) setState(toState(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
