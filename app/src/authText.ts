// Textos e validações do login. Sem React Native, para testar no Node.
// O Supabase devolve erros com `code` (texto estável) e `message` (inglês); aqui viram frases em português.

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Checagem simples (formato `algo@algo.algo`); quem confirma de verdade é o código enviado ao e-mail. */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(raw));
}

/** O código do e-mail tem 6 dígitos por padrão no Supabase (configurável até 10). */
export function isValidCode(raw: string): boolean {
  return /^\d{6,10}$/.test(raw.trim());
}

/** Só dígitos, para colar o código com espaços ou traços. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export type AuthContext = 'upgrade' | 'signin' | 'verify';

interface AuthErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

export function describeAuthError(error: AuthErrorLike, context: AuthContext): string {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();

  if (code === 'email_exists' || message.includes('already been registered') || message.includes('already registered')) {
    return 'Esse e-mail já tem uma conta. Se ela é sua, use "Já tenho conta" para entrar nela (as cartas deste aparelho ficam na conta de convidado).';
  }
  if (code === 'over_email_send_rate_limit' || message.includes('email rate limit')) {
    return 'O servidor já mandou e-mails demais por agora. Espere uns minutos e tente de novo.';
  }
  if (code === 'over_request_rate_limit' || (error.status === 429 && context === 'verify')) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  }
  if (code === 'email_address_not_authorized') {
    return 'O envio de e-mail do servidor ainda não está liberado para esse endereço (falta configurar o SMTP no Supabase).';
  }
  if (code === 'otp_expired' || message.includes('expired') || message.includes('invalid')) {
    return context === 'verify' ? 'Código errado ou vencido. Confira o e-mail ou peça um novo.' : 'Esse e-mail não parece válido.';
  }
  if (code === 'otp_disabled' || code === 'signup_disabled' || code === 'user_not_found' || message.includes('signups not allowed')) {
    return 'Não existe conta com esse e-mail. No aparelho onde você jogava, abra "Minha conta" e toque em "Criar conta".';
  }
  if (code === 'anonymous_provider_disabled') {
    return 'O login de convidado está desligado no servidor (Authentication → Sign In / Providers → Allow anonymous sign-ins).';
  }
  if (message.includes('network') || message.includes('fetch') || message.includes('failed to')) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  return 'Não deu certo. Tente de novo em instantes.';
}
