import { describe, expect, it } from 'vitest';
import { cleanCode, describeAuthError, isValidCode, isValidEmail, normalizeEmail } from '../src/authText';

describe('e-mail e código', () => {
  it('normaliza e valida o e-mail', () => {
    expect(normalizeEmail('  Rames@Exemplo.COM ')).toBe('rames@exemplo.com');
    expect(isValidEmail('a@b.co')).toBe(true);
    for (const ruim of ['', 'a@b', 'a b@c.com', '@c.com', 'a@.com']) expect(isValidEmail(ruim)).toBe(false);
  });

  it('o código aceita 6 a 10 dígitos e ignora espaços e traços ao colar', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('123-456')).toBe('123456');
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
  });
});

describe('mensagens de erro do login', () => {
  it('e-mail que já tem conta ensina o caminho', () => {
    expect(describeAuthError({ code: 'email_exists' }, 'upgrade')).toMatch(/Já tenho conta/);
    expect(describeAuthError({ message: 'A user with this email address has already been registered' }, 'upgrade')).toMatch(/já tem uma conta/);
  });

  it('entrar com e-mail sem conta explica onde criar', () => {
    expect(describeAuthError({ code: 'otp_disabled', message: 'Signups not allowed for otp' }, 'signin')).toMatch(/Criar conta/);
  });

  it('limite de e-mails e SMTP não configurado ficam claros', () => {
    expect(describeAuthError({ code: 'over_email_send_rate_limit' }, 'signin')).toMatch(/e-mails demais/);
    expect(describeAuthError({ code: 'email_address_not_authorized' }, 'signin')).toMatch(/SMTP/);
  });

  it('código errado ou vencido', () => {
    expect(describeAuthError({ code: 'otp_expired' }, 'verify')).toMatch(/errado ou vencido/);
  });

  it('erro desconhecido ainda devolve uma frase em português', () => {
    expect(describeAuthError({}, 'verify')).toMatch(/Tente de novo/);
  });
});
