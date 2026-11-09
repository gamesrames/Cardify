import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGIN_DOMAIN,
  describeAuthError,
  emailToHandle,
  handleToEmail,
  isValidHandle,
  isValidPassword,
  normalizeHandle,
} from '../src/authText';

describe('apelido e senha', () => {
  it('normaliza: minúsculas, sem acento, sem espaços nas pontas', () => {
    expect(normalizeHandle('  José_01 ')).toBe('jose_01');
    expect(normalizeHandle('Ação')).toBe('acao');
  });

  it('aceita 3 a 20 caracteres de letra, número e "_"', () => {
    for (const bom of ['abc', 'rames_01', 'João', 'a'.repeat(20)]) expect(isValidHandle(bom)).toBe(true);
    for (const ruim of ['', 'ab', 'a'.repeat(21), 'com espaço', 'a-b', 'a@b.com', 'a.b', '😀😀😀']) expect(isValidHandle(ruim)).toBe(false);
  });

  it('senha de 6 a 72 caracteres', () => {
    expect(isValidPassword('12345')).toBe(false);
    expect(isValidPassword('123456')).toBe(true);
    expect(isValidPassword('x'.repeat(72))).toBe(true);
    expect(isValidPassword('x'.repeat(73))).toBe(false);
  });
});

describe('e-mail fictício do login', () => {
  it('ida e volta: o mesmo apelido sempre dá o mesmo e-mail, e dele sai o apelido', () => {
    expect(handleToEmail('José_01')).toBe(`cardify.jose_01@${DEFAULT_LOGIN_DOMAIN}`);
    expect(handleToEmail('JOSE_01')).toBe(handleToEmail(' jose_01 '));
    expect(emailToHandle(handleToEmail('Rames_01'))).toBe('rames_01');
  });

  it('domínio configurável', () => {
    expect(handleToEmail('abc', 'meujogo.com.br')).toBe('cardify.abc@meujogo.com.br');
  });

  it('conta com e-mail de verdade não vira apelido', () => {
    expect(emailToHandle('alguem@exemplo.com')).toBeNull();
    expect(emailToHandle(null)).toBeNull();
    expect(emailToHandle(undefined)).toBeNull();
  });

  it('o e-mail fictício é um e-mail válido para o servidor (sem acento nem espaço)', () => {
    expect(handleToEmail('Ação_1')).toMatch(/^[a-z0-9_.]+@[a-z0-9.-]+\.[a-z]{2,}$/);
  });
});

describe('mensagens de erro do login', () => {
  it('senha ou apelido errados avisa que não há recuperação', () => {
    expect(describeAuthError({ code: 'invalid_credentials' }, 'signin')).toMatch(/Apelido ou senha errados/);
    expect(describeAuthError({ message: 'Invalid login credentials' }, 'signin')).toMatch(/recuperação/);
  });

  it('apelido que já existe', () => {
    expect(describeAuthError({ code: 'email_exists' }, 'create')).toMatch(/já está em uso/);
    expect(describeAuthError({ message: 'A user with this email address has already been registered' }, 'create')).toMatch(/em uso/);
  });

  it('senha fraca e senha repetida', () => {
    expect(describeAuthError({ code: 'weak_password' }, 'create')).toMatch(/Senha fraca/);
    expect(describeAuthError({ code: 'same_password' }, 'password')).toMatch(/diferente/);
  });

  it('domínio de e-mail fictício recusado aponta a configuração', () => {
    expect(describeAuthError({ code: 'email_address_invalid' }, 'create')).toMatch(/EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN/);
  });

  it('limite de tentativas e rede', () => {
    expect(describeAuthError({ status: 429 }, 'signin')).toMatch(/Muitas tentativas/);
    expect(describeAuthError({ message: 'Failed to fetch' }, 'signin')).toMatch(/Sem conexão/);
  });

  it('erro desconhecido ainda devolve uma frase em português', () => {
    expect(describeAuthError({}, 'signin')).toMatch(/Tente de novo/);
  });
});
