// Login por apelido + senha (opção B da fase 3; decisões.md). Tudo que fala com o login do Supabase está AQUI:
// para voltar ao e-mail de verdade (código por e-mail, Google...) no lançamento, troque este arquivo e os
// formulários, sem mexer em cartas, baralho nem perfil.
//
// O convidado (login anônimo) vira conta ligando um e-mail fictício e uma senha ao MESMO usuário: o id não
// muda, então as cartas, o baralho e o perfil dele continuam dele.
import type { Session } from '@supabase/supabase-js';
import { DEFAULT_LOGIN_DOMAIN, describeAuthError, handleToEmail, normalizeHandle } from './authText';
import type { AuthContext } from './authText';
import { requireClient, saveDisplayName } from './supabase';

export class AuthFlowError extends Error {}

const loginDomain = process.env.EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN || DEFAULT_LOGIN_DOMAIN;

function fail(error: { code?: string; message?: string; status?: number }, context: AuthContext): never {
  throw new AuthFlowError(describeAuthError(error, context));
}

/**
 * Convidado → conta. Dois passos (o Supabase só aceita senha depois que o e-mail está confirmado):
 * 1) liga o e-mail fictício; 2) define a senha. Se o passo 2 falhar, repetir o pedido continua de onde parou.
 */
export async function createAccount(handle: string, password: string): Promise<void> {
  const auth = requireClient().auth;
  const email = handleToEmail(handle, loginDomain);

  const { data: current } = await auth.getUser();
  if (current.user?.email !== email) {
    const { data, error } = await auth.updateUser({ email });
    if (error) fail(error, 'create');
    if (data.user?.email !== email) {
      // "Confirm email" ainda ligado no painel: o servidor tentou mandar um e-mail e a conta continua de convidado.
      throw new AuthFlowError(
        'O servidor ainda exige confirmar e-mail. No painel do Supabase, desligue Authentication → Sign In / Providers → Email → "Confirm email".',
      );
    }
  }
  const { error: passwordError } = await auth.updateUser({ password });
  if (passwordError) fail(passwordError, 'create');

  // O apelido vira o nome de jogador inicial (dá para mudar depois). Falhar aqui não atrapalha a conta.
  await saveDisplayName(normalizeHandle(handle)).catch(() => undefined);
}

/** Entrar numa conta que já existe (outro aparelho, app reinstalado). Não cria conta nova. */
export async function signIn(handle: string, password: string): Promise<Session> {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: handleToEmail(handle, loginDomain),
    password,
  });
  if (error || !data.session) fail(error ?? { code: 'invalid_credentials' }, 'signin');
  return data.session;
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) fail(error, 'password');
}

export async function signOut(): Promise<void> {
  await requireClient().auth.signOut();
}
