// Login por apelido + senha: validações, o "e-mail de mentira" que o Supabase exige e as mensagens de erro.
// Sem React Native, para testar no Node. Quem fala com o servidor é `auth.ts`.
//
// O Supabase só sabe logar com e-mail + senha. Para o jogador usar um apelido, montamos um e-mail
// fictício a partir dele (`cardify.<apelido>@<domínio>`). Esse e-mail nunca recebe nada: o app não
// pede confirmação nem recuperação de senha. Para voltar ao e-mail de verdade no lançamento, só
// `auth.ts` e os formulários mudam (veja docs/backend.md).

/**
 * Domínio do e-mail fictício. Precisa ser um domínio que existe (o Supabase hospedado recusa domínios sem
 * servidor de e-mail). Dá para trocar com EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN no `.env.local`.
 */
export const DEFAULT_LOGIN_DOMAIN = 'gmail.com';

const EMAIL_PREFIX = 'cardify.';

/** Minúsculas, sem acento e sem espaços nas pontas: "  José_01 " vira "jose_01". */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

/** 3 a 20 caracteres: letras sem acento, números e "_". */
export function isValidHandle(raw: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(normalizeHandle(raw));
}

/** O Supabase exige no mínimo 6 caracteres; o limite de cima é o do bcrypt (72 bytes). */
export function isValidPassword(password: string): boolean {
  return password.length >= 6 && password.length <= 72;
}

export function handleToEmail(handle: string, domain: string = DEFAULT_LOGIN_DOMAIN): string {
  return `${EMAIL_PREFIX}${normalizeHandle(handle)}@${domain}`;
}

/** Volta ao apelido a partir do e-mail fictício; `null` se a conta tem um e-mail "de verdade". */
export function emailToHandle(email: string | null | undefined): string | null {
  const match = /^cardify\.([a-z0-9_]{3,20})@/.exec((email ?? '').toLowerCase());
  return match ? (match[1] as string) : null;
}

export type AuthContext = 'create' | 'signin' | 'password';

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

export function describeAuthError(error: AuthErrorLike, context: AuthContext): string {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Apelido ou senha errados. Não há recuperação de senha: se você esqueceu, peça para quem cuida do app redefinir.';
  }
  if (code === 'email_exists' || code === 'user_already_exists' || message.includes('already been registered') || message.includes('already registered')) {
    return 'Esse apelido já está em uso. Escolha outro.';
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return 'Senha fraca demais. Use 6 ou mais caracteres, misturando letras e números.';
  }
  if (code === 'same_password') return 'A nova senha precisa ser diferente da atual.';
  if (code === 'email_address_invalid' || message.includes('email address') && message.includes('invalid')) {
    return 'O servidor recusou o formato do login (domínio de e-mail fictício). Avise quem cuida do app: veja EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN em docs/backend.md.';
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error.status === 429) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }
  if (code === 'anonymous_provider_disabled') {
    return 'O login de convidado está desligado no servidor (Authentication → Sign In / Providers → Allow anonymous sign-ins).';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to')) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  return context === 'signin' ? 'Não consegui entrar. Tente de novo em instantes.' : 'Não deu certo. Tente de novo em instantes.';
}
