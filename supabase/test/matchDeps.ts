import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { Deps } from '../src/match/handler';
import { CODE_ALPHABET } from '../src/match/handler';

const read = (f: string) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8');

export const U1 = '11111111-1111-1111-1111-111111111111';
export const U2 = '22222222-2222-2222-2222-222222222222';
export const U3 = '33333333-3333-3333-3333-333333333333';

// O que o Supabase fornece e a migração usa: papéis, schema auth, Storage e a publicação do Realtime.
export const SKELETON = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  -- No Supabase, auth.uid() lê o JWT; aqui lê uma variável que o teste define.
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated;
  grant select on storage.objects to authenticated;
  create publication supabase_realtime;
`;

/** Banco em memória com TODAS as migrações reais, como no projeto do Supabase. */
export async function newMatchDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SKELETON);
  await db.exec(read('20261108000001_cartas.sql'));
  await db.exec(read('20261108000002_fotos_storage.sql'));
  await db.exec(`insert into auth.users (id) values ('${U1}'), ('${U2}'), ('${U3}')`);
  await db.exec(read('20261109000001_perfis_e_baralhos.sql'));
  await db.exec(read('20261109000002_partidas_online.sql'));
  return db;
}

/** Executa `fn` como um jogador logado (RLS valendo). Sempre volta ao papel de administrador. */
export async function as<T>(db: PGlite, uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('test.uid', '${uid ?? ''}', false)`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('test.uid', '', false)`);
  }
}

// Tipos dos parâmetros das funções SQL (o PGlite precisa deles para converter os valores).
const SIGNATURES: Record<string, Record<string, string>> = {
  match_load_deck: { p_user: 'uuid' },
  match_config: {},
  match_create: { p_match: 'uuid', p_host: 'uuid', p_code: 'text', p_deck: 'jsonb', p_photos: 'jsonb', p_views: 'jsonb' },
  match_by_code: { p_code: 'text' },
  match_get: { p_match: 'uuid' },
  match_current: { p_user: 'uuid' },
  match_cancel_waiting: { p_host: 'uuid' },
  match_join: { p_match: 'uuid', p_guest: 'uuid', p_state: 'jsonb', p_events: 'jsonb', p_deadline: 'timestamptz', p_views: 'jsonb' },
  match_apply: {
    p_match: 'uuid', p_expected: 'int', p_state: 'jsonb', p_new_events: 'jsonb', p_status: 'text', p_cause: 'text',
    p_deadline: 'timestamptz', p_missed: 'int[]', p_views: 'jsonb',
  },
};

/** Equivale a `admin.rpc(fn, args)` do supabase-js: chama a função SQL e devolve o resultado (ou lança o erro do banco). */
export function rpcOn(db: PGlite) {
  return async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const sig = SIGNATURES[fn];
    if (!sig) throw new Error(`função desconhecida no teste: ${fn}`);
    const names = Object.keys(sig);
    const values = names.map((n) => {
      const v = args[n];
      if (sig[n] === 'jsonb') return JSON.stringify(v);
      if (sig[n] === 'int[]') return `{${(v as number[]).join(',')}}`;
      return v;
    });
    const call = names.map((n, i) => `${n} => $${i + 1}::${sig[n]}`).join(', ');
    const { rows } = await db.query<{ r: unknown }>(`select public.${fn}(${call}) as r`, values);
    return rows[0]?.r ?? null;
  };
}

export interface Clock {
  ms: number;
  advance(seconds: number): void;
}

/** Dependências reais do handler, trocando só a rede: o banco é o PGlite e o relógio é do teste. */
export function matchDepsOn(db: PGlite, clock: Clock = { ms: Date.parse('2026-11-10T12:00:00Z'), advance() {} }) {
  let seed = 1000;
  let id = 0;
  let code = 0;
  const caller = { user: U1 as string | null };
  const deps: Deps = {
    getUserId: async (req) => (req.headers.get('authorization') === 'Bearer ok' ? caller.user : null),
    rpc: rpcOn(db),
    now: () => new Date(clock.ms),
    randomSeed: () => ++seed,
    newId: () => `aaaaaaaa-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    // Códigos previsíveis nos testes: AAAAA2, AAAAA3, ...
    newCode: () => `AAAAA${CODE_ALPHABET[(++code + 25) % CODE_ALPHABET.length]}`,
  };
  return { deps, caller };
}

export function post(body: Record<string, unknown>, auth = 'Bearer ok'): Request {
  return new Request('http://local/match', {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const HOST_DECK = ['fogo-formiga', 'fogo-lagartixa', 'fogo-raposa', 'fogo-tigre', 'fogo-leao', 'terra-tatu', 'ar-pardal'];
export const GUEST_DECK = ['planta-joaninha', 'planta-lesma', 'planta-coelho', 'planta-cervo', 'planta-urso', 'agua-peixe', 'agua-sapo'];

export async function saveDeck(db: PGlite, owner: string, cardIds: string[], name = 'Meu baralho') {
  await db.query(`insert into decks (owner_id, name, card_ids) values ($1, $2, $3::text[])`, [owner, name, `{${cardIds.join(',')}}`]);
}

/** Carta de foto de um jogador direto no banco (sem passar pela função create-card). */
export async function addPhotoCard(db: PGlite, id: string, owner: string, attack = 3, health = 6) {
  await db.query(
    `insert into cards (id, owner_id, name, photo_path, photo_hash, category, element, rarity, attack, health, seed)
     values ($1::uuid, $2::uuid, 'Galinha', $3, $4::bit(64), 'galinha', 'terra', 'comum', $5, $6, 1)`,
    [id, owner, `${owner}/${id}.jpg`, id.replace(/\D/g, '').padEnd(64, '1').slice(0, 64).replace(/[2-9]/g, '1'), attack, health],
  );
}
