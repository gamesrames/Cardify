import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';

// Roda a migração de verdade num Postgres em memória (PGlite). O que o Supabase
// fornece (schema auth, papéis) entra como um esqueleto mínimo.
const migration = readFileSync(new URL('../migrations/20261108000001_cartas.sql', import.meta.url), 'utf8');

const SKELETON = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
`;

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const hashWith = (ones: number) => '1'.repeat(ones).padEnd(64, '0'); // distância entre hashWith(a) e hashWith(b) = |a-b|

// Hash "aleatório" determinístico: dois quaisquer ficam a ~32 bits de distância.
const rand64 = (i: number) => {
  let x = (i + 1) * 2654435761;
  let out = '';
  for (let b = 0; b < 64; b++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out += (x >>> 16) & 1;
  }
  return out;
};

let db: PGlite;
let n = 0;

async function insert(owner: string, hash: string) {
  n++;
  const id = `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  return db.query(
    `select * from insert_card($1::uuid, $2::uuid, $3, $4::bit(64), 'Galinha', 'galinha', 'terra', 'comum', 3, 6, 42, 0)`,
    [id, owner, `${owner}/${id}.jpg`, hash],
  );
}
const check = async (owner: string, hash: string) =>
  ((await db.query<{ r: string }>(`select photo_check($1::uuid, $2::bit(64)) as r`, [owner, hash])).rows[0] as { r: string }).r;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(SKELETON);
  await db.exec(migration);
  await db.exec(`insert into auth.users (id) values ('${U1}'), ('${U2}')`);
});

describe('migração de cartas', () => {
  it('cria as categorias iniciais com bônus dentro do teto e o elemento válido', async () => {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from categories`);
    expect((rows[0] as { n: number }).n).toBeGreaterThanOrEqual(20);
    await expect(
      db.exec(`insert into categories (slug, nome, element, bonus_pct) values ('x', 'X', 'fogo', 11)`),
    ).rejects.toThrow();
  });

  it('a 15ª foto do dia é bloqueada (limite 14)', async () => {
    for (let i = 0; i < 14; i++) await insert(U1, rand64(i));
    expect(await check(U1, rand64(100))).toBe('quota_exceeded');
    await expect(insert(U1, rand64(100))).rejects.toThrow(/quota_exceeded/);
    // outro usuário não é afetado pela cota do primeiro
    await expect(insert(U2, '1'.repeat(64))).resolves.toBeDefined();
  });

  it('o limite vem da configuração (3 no jogo final)', async () => {
    await db.exec(`update app_config set value = 3 where key = 'daily_photo_limit'`);
    for (let i = 0; i < 3; i++) await insert(U1, rand64(i));
    expect(await check(U1, rand64(100))).toBe('quota_exceeded');
  });

  it('cartas de ontem (São Paulo) não contam na cota de hoje', async () => {
    for (let i = 0; i < 14; i++) await insert(U1, rand64(i));
    await db.exec(`update cards set created_at = now() - interval '2 days'`);
    expect(await check(U1, rand64(100))).toBe('ok');
  });

  it('foto igual ou quase igual (até 10 bits) é duplicata, inclusive de outro usuário', async () => {
    await insert(U1, hashWith(32));
    expect(await check(U1, hashWith(32))).toBe('duplicate');
    expect(await check(U2, hashWith(32 + 10))).toBe('duplicate');
    expect(await check(U2, hashWith(32 + 11))).toBe('ok');
    await expect(insert(U2, hashWith(32))).rejects.toThrow(/duplicate/);
  });

  it('fotos concorrentes do mesmo usuário não furam a cota', async () => {
    await db.exec(`update app_config set value = 1 where key = 'daily_photo_limit'`);
    const results = await Promise.allSettled([insert(U1, rand64(1)), insert(U1, rand64(2))]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('o cliente não consegue chamar as funções nem escrever em cards (RLS e permissões)', async () => {
    await db.exec(`set role authenticated`);
    await expect(db.query(`select photo_check('${U1}', '${'0'.repeat(64)}'::bit(64))`)).rejects.toThrow(/permission denied/);
    await expect(
      db.exec(`insert into cards (owner_id, name, photo_path, photo_hash, category, element, rarity, attack, health, seed)
               values ('${U1}', 'x', 'p', B'${'0'.repeat(64)}', 'galinha', 'terra', 'lendaria', 99, 99, 1)`),
    ).rejects.toThrow();
    await expect(db.query(`select * from app_config`)).rejects.toThrow();
  });
});
