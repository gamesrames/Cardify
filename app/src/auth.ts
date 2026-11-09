// Login por e-mail com código de 6 dígitos (sem senha, sem link: funciona no Expo Go e no navegador).
// O convidado (login anônimo) vira conta de verdade ligando um e-mail ao MESMO usuário: o id não muda,
// então as cartas, o baralho e o perfil dele continuam dele.
import type { Session } from '@supabase/supabase-js';
import { describeAuthError } from './authText';
import type { AuthContext } from './authText';
import { requireClient } from './supabase';

export class AuthFlowError extends Error {}

function fail(error: { code?: string; message?: string; status?: number }, context: AuthContext): never {
  throw new AuthFlowError(describeAuthError(error, context));
}

/** Convidado → conta: envia o código para o e-mail (template "Change Email Address" do Supabase). */
export async function sendUpgradeCode(email: string): Promise<void> {
  const { error } = await requireClient().auth.updateUser({ email });
  if (error) fail(error, 'upgrade');
}

export async function confirmUpgradeCode(email: string, code: string): Promise<void> {
  const { error } = await requireClient().auth.verifyOtp({ email, token: code, type: 'email_change' });
  if (error) fail(error, 'verify');
}

/** Entrar numa conta que já existe (outro aparelho, app reinstalado). Não cria conta nova. */
export async function sendSignInCode(email: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) fail(error, 'signin');
}

export async function confirmSignInCode(email: string, code: string): Promise<Session> {
  const { data, error } = await requireClient().auth.verifyOtp({ email, token: code, type: 'email' });
  if (error || !data.session) fail(error ?? { code: 'otp_expired' }, 'verify');
  return data.session;
}

export async function signOut(): Promise<void> {
  await requireClient().auth.signOut();
}
