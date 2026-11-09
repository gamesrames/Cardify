import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

// Roda as migrações de verdade num Postgres em memória (PGlite) e testa as regras de acesso
// da fase 3 PELOS PAPÉIS do Supabase: `set role authenticated` liga a RLS como no app.
const read = (f: string) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8');

const SKELETON = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  -- No Supabase, auth.uid() lê o JWT; aqui lê uma variável que o teste define.
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  -- O Supabase concede tudo nas tabelas novas de public; a migração é quem fecha.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`;

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

/** Executa `fn` como um jogador logado (RLS valendo). Sempre volta ao papel de administrador. */
async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('test.uid', '${uid ?? ''}', false)`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('test.uid', '', false)`);
  }
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SKELETON);
  await db.exec(read('20261108000001_cartas.sql'));
  await db.exec(read('20261108000002_fotos_storage.sql'));
  // Um login anônimo que já existia antes da fase 3:
  await db.exec(`insert into auth.users (id) values ('${U1}')`);
  await db.exec(read('20261109000001_perfis_e_baralhos.sql'));
  await db.exec(`insert into auth.users (id) values ('${U2}')`);
});

describe('perfis', () => {
  it('quem já existia antes da migração ganhou perfil, e login novo ganha pelo trigger', async () => {
    const { rows } = await db.query<{ id: string }>(`select id from profiles order by id`);
    expect(rows.map((r) => r.id)).toEqual([U1, U2]);
  });

  it('cada um lê só o próprio perfil', async () => {
    const mine = await as(U1, () => db.query<{ id: string }>(`select id from profiles`));
    expect(mine.rows.map((r) => r.id)).toEqual([U1]);
  });

  it('o jogador troca o próprio nome, mas não o de outro nem o id', async () => {
    await as(U1, () => db.exec(`update profiles set display_name = 'Rames' where id = '${U1}'`));
    expect(((await db.query<{ n: string }>(`select display_name n from profiles where id = '${U1}'`)).rows[0] as { n: string }).n).toBe('Rames');

    // tentar editar o perfil do outro não acha linha nenhuma (a RLS esconde), então nada muda
    await as(U1, () => db.exec(`update profiles set display_name = 'Invasor' where id = '${U2}'`));
    expect(((await db.query<{ n: string | null }>(`select display_name n from profiles where id = '${U2}'`)).rows[0] as { n: string | null }).n).toBeNull();

    await expect(as(U1, () => db.exec(`update profiles set id = '${U2}' where id = '${U1}'`))).rejects.toThrow(/permission denied/);
  });

  it('nome muito curto ou longo é recusado', async () => {
    await expect(as(U1, () => db.exec(`update profiles set display_name = 'A' where id = '${U1}'`))).rejects.toThrow();
    await expect(as(U1, () => db.exec(`update profiles set display_name = '${'x'.repeat(21)}' where id = '${U1}'`))).rejects.toThrow();
  });

  it('o cliente não cria nem apaga perfis', async () => {
    await expect(as(U1, () => db.exec(`insert into profiles (id) values (gen_random_uuid())`))).rejects.toThrow(/permission denied/);
    await expect(as(U1, () => db.exec(`delete from profiles`))).rejects.toThrow(/permission denied/);
  });

  it('sem login (papel anon) não lê nada', async () => {
    await expect(as(null, () => db.query(`select * from profiles`))).rejects.toThrow(/permission denied/);
    await expect(as(null, () => db.query(`select * from decks`))).rejects.toThrow(/permission denied/);
  });

  it('apagar o login apaga o perfil e os baralhos', async () => {
    await db.exec(`insert into decks (owner_id, name, card_ids) values ('${U2}', 'Meu baralho', '{a,b}')`);
    await db.exec(`delete from auth.users where id = '${U2}'`);
    expect((await db.query(`select 1 from profiles where id = '${U2}'`)).rows).toHaveLength(0);
    expect((await db.query(`select 1 from decks where owner_id = '${U2}'`)).rows).toHaveLength(0);
  });
});

describe('baralhos', () => {
  const ids = ['carta-fixa-1', '33333333-3333-3333-3333-333333333333'];

  it('o dono salva e lê o próprio baralho (ids de cartas fixas e de foto juntos)', async () => {
    await as(U1, () => db.query(`insert into decks (owner_id, name, card_ids) values ($1, 'Meu baralho', $2)`, [U1, ids]));
    const { rows } = await as(U1, () => db.query<{ card_ids: string[] }>(`select card_ids from decks`));
    expect(rows).toHaveLength(1);
    expect((rows[0] as { card_ids: string[] }).card_ids).toEqual(ids);
  });

  it('salvar de novo o mesmo nome atualiza (upsert), mantendo a ordem das cartas', async () => {
    const save = (cards: string[]) =>
      as(U1, () =>
        db.query(
          `insert into decks (owner_id, name, card_ids) values ($1, 'Meu baralho', $2)
           on conflict (owner_id, name) do update set card_ids = excluded.card_ids`,
          [U1, cards],
        ),
      );
    await save(['a', 'b', 'c']);
    await save(['c', 'b']);
    const { rows } = await as(U1, () => db.query<{ card_ids: string[] }>(`select card_ids from decks`));
    expect(rows).toHaveLength(1);
    expect((rows[0] as { card_ids: string[] }).card_ids).toEqual(['c', 'b']);
  });

  it('um jogador não enxerga, altera, apaga nem cria baralho no nome de outro', async () => {
    await db.exec(`insert into decks (owner_id, name, card_ids) values ('${U2}', 'Segredo', '{x}')`);
    expect((await as(U1, () => db.query(`select * from decks`))).rows).toHaveLength(0);

    await as(U1, () => db.exec(`update decks set card_ids = '{hack}' where owner_id = '${U2}'`));
    await as(U1, () => db.exec(`delete from decks where owner_id = '${U2}'`));
    const intact = (await db.query<{ card_ids: string[] }>(`select card_ids from decks where owner_id = '${U2}'`)).rows;
    expect((intact[0] as { card_ids: string[] }).card_ids).toEqual(['x']);

    await expect(
      as(U1, () => db.exec(`insert into decks (owner_id, name) values ('${U2}', 'Enxerto')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it('não dá para passar o baralho para outro dono editando owner_id', async () => {
    await db.exec(`insert into decks (owner_id, name) values ('${U1}', 'Meu baralho')`);
    await expect(as(U1, () => db.exec(`update decks set owner_id = '${U2}'`))).rejects.toThrow(/row-level security/);
  });

  it('recusa lista absurda de cartas e nome vazio', async () => {
    const many = Array.from({ length: 21 }, (_, i) => `c${i}`);
    await expect(as(U1, () => db.query(`insert into decks (owner_id, name, card_ids) values ($1, 'x', $2)`, [U1, many]))).rejects.toThrow();
    await expect(as(U1, () => db.exec(`insert into decks (owner_id, name) values ('${U1}', '   ')`))).rejects.toThrow();
  });

  it('updated_at anda quando o baralho muda', async () => {
    await db.exec(`insert into decks (owner_id, name, updated_at) values ('${U1}', 'Meu baralho', now() - interval '1 day')`);
    await as(U1, () => db.exec(`update decks set card_ids = '{a}'`));
    const { rows } = await db.query<{ fresh: boolean }>(`select updated_at > now() - interval '1 minute' as fresh from decks`);
    expect((rows[0] as { fresh: boolean }).fresh).toBe(true);
  });
});

describe('cartas continuam do dono depois da fase 3', () => {
  it('as policies da fase 2 seguem valendo: cada um lê só as próprias cartas e não escreve', async () => {
    await db.exec(`
      insert into cards (owner_id, name, photo_path, photo_hash, category, element, rarity, attack, health, seed)
      values ('${U1}', 'Galinha', 'p1.jpg', B'${'1'.repeat(64)}', 'galinha', 'terra', 'comum', 3, 6, 1),
             ('${U2}', 'Gato', 'p2.jpg', B'${'0'.repeat(64)}', 'gato', 'fogo', 'comum', 3, 6, 2)`);
    const mine = await as(U1, () => db.query<{ name: string }>(`select name from cards`));
    expect(mine.rows.map((r) => r.name)).toEqual(['Galinha']);
    // escrever em cards é proibido ao cliente, mesmo na própria carta
    await expect(as(U1, () => db.exec(`delete from cards`))).rejects.toThrow(/permission denied/);
    await expect(as(U1, () => db.exec(`update cards set attack = 99`))).rejects.toThrow(/permission denied/);
    expect(((await db.query<{ n: number }>(`select count(*)::int n from cards`)).rows[0] as { n: number }).n).toBe(2);
  });
});
