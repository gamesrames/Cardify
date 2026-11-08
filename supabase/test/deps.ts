import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { ManualClassifier } from '../src/create-card/classifiers';
import { InsertRejected } from '../src/create-card/handler';
import type { Deps } from '../src/create-card/handler';
import { decodePhoto } from '../src/create-card/image';

const migration = readFileSync(new URL('../migrations/20261108000001_cartas.sql', import.meta.url), 'utf8');

export const USER = '11111111-1111-1111-1111-111111111111';

/** Banco em memória com a migração real aplicada. */
export async function newDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  `);
  await db.exec(migration);
  await db.exec(`insert into auth.users (id) values ('${USER}')`);
  return db;
}

/** Dependências reais do handler, trocando só a rede: banco = PGlite, storage = Map em memória. */
export function depsOn(db: PGlite, overrides: Partial<Deps> = {}) {
  const storage = new Map<string, Uint8Array>();
  let seedCounter = 1000;
  const deps: Deps = {
    getUserId: async (req) => (req.headers.get('authorization') === 'Bearer ok' ? USER : null),
    listCategories: async () =>
      (await db.query<{ slug: string; nome: string; element: never; bonus_pct: number }>(
        `select slug, nome, element, bonus_pct from categories where ativa`,
      )).rows.map((r) => ({ slug: r.slug, nome: r.nome, element: r.element, bonusPct: r.bonus_pct })),
    checkPhoto: async (u, h) =>
      ((await db.query<{ r: 'ok' | 'quota_exceeded' | 'duplicate' }>(`select photo_check($1::uuid, $2::bit(64)) as r`, [u, h])).rows[0]!).r,
    insertCard: async (c) => {
      try {
        const { rows } = await db.query<Record<string, string | number>>(
          `select * from insert_card($1::uuid,$2::uuid,$3,$4::bit(64),$5,$6,$7,$8,$9,$10,$11,$12)`,
          [c.id, c.ownerId, c.photoPath, c.photoHash, c.name, c.category, c.element, c.rarity, c.attack, c.health, c.seed >>> 0, c.bonusPoints],
        );
        const r = rows[0]!;
        return {
          id: String(r.id), name: String(r.name), category: String(r.category), element: String(r.element),
          rarity: String(r.rarity), attack: Number(r.attack), health: Number(r.health),
          bonusPoints: Number(r.bonus_points), photoPath: String(r.photo_path), createdAt: String(r.created_at),
        };
      } catch (e) {
        const m = String((e as Error).message);
        if (m.includes('quota_exceeded')) throw new InsertRejected('quota_exceeded');
        if (m.includes('duplicate')) throw new InsertRejected('duplicate');
        throw e;
      }
    },
    uploadPhoto: async (p, bytes) => void storage.set(p, bytes),
    removePhoto: async (p) => void storage.delete(p),
    decodePhoto,
    classifier: new ManualClassifier(),
    randomSeed: () => ++seedCounter,
    newId: () => crypto.randomUUID(),
    ...overrides,
  };
  return { deps, storage };
}

export function request(photo: Uint8Array, extra: Record<string, unknown> = {}, auth = 'Bearer ok'): Request {
  return new Request('http://local/create-card', {
    method: 'POST',
    headers: { authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ photo: Buffer.from(photo).toString('base64'), mime: 'image/jpeg', category: 'galinha', ...extra }),
  });
}
