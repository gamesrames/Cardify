import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, cardPower } from '../src/motor';
import { ClassifierError } from '../src/create-card/types';
import { handleCreateCard } from '../src/create-card/handler';
import { depsOn, newDb, request, USER } from './deps';
import { makePhoto } from './fixtures';

let db: PGlite;
beforeEach(async () => {
  db = await newDb();
});

const bodyOf = async (res: Response) => (await res.json()) as Record<string, any>;

describe('create-card (fluxo completo, banco real em memória)', () => {
  it('foto vira carta válida, grava no banco e guarda a foto limpa', async () => {
    const { deps, storage } = depsOn(db);
    const started = performance.now();
    const res = await handleCreateCard(request(await makePhoto(1)), deps);
    const elapsed = performance.now() - started;
    expect(res.status).toBe(201);
    const { card } = await bodyOf(res);
    expect(card.name).toBe('Galinha');
    expect(card.element).toBe('terra');
    expect(cardPower(card)).toBe(DEFAULT_RULES.powerBudget[card.rarity as 'comum'] + card.bonusPoints);
    expect(card.photoPath).toBe(`${USER}/${card.id}.jpg`);
    expect(storage.has(card.photoPath)).toBe(true);
    const { rows } = await db.query(`select seed from cards where id = $1`, [card.id]);
    expect(rows).toHaveLength(1);
    expect(elapsed).toBeLessThan(10_000); // critério da fase 2 (aqui sem rede, só dá para ver o piso)
  });

  it('a mesma foto duas vezes é recusada (409), mesmo repetida com outro tamanho e ruído', async () => {
    const { deps, storage } = depsOn(db);
    expect((await handleCreateCard(request(await makePhoto(2, { size: 192 })), deps)).status).toBe(201);
    const again = await handleCreateCard(request(await makePhoto(2, { size: 320, noise: 12 })), deps);
    expect(again.status).toBe(409);
    expect((await bodyOf(again)).error).toBe('duplicate_photo');
    expect(storage.size).toBe(1); // a segunda foto nem chegou ao storage
  });

  it('a 15ª foto do dia é bloqueada (429) e fotos diferentes passam até a 14ª', async () => {
    const { deps } = depsOn(db);
    for (let i = 1; i <= 14; i++) {
      const res = await handleCreateCard(request(await makePhoto(100 + i)), deps);
      expect(res.status, `foto ${i}`).toBe(201);
    }
    const blocked = await handleCreateCard(request(await makePhoto(999)), deps);
    expect(blocked.status).toBe(429);
    expect((await bodyOf(blocked)).error).toBe('quota_exceeded');
    expect((await db.query(`select 1 from cards`)).rows).toHaveLength(14);
  }, 60_000);

  it('o cliente não influencia raridade nem atributos: campos extras são ignorados', async () => {
    const { deps } = depsOn(db);
    const res = await handleCreateCard(request(await makePhoto(3), { rarity: 'lendaria', attack: 99, seed: 1 }), deps);
    const { card } = await bodyOf(res);
    expect(card.attack).toBeLessThan(20);
    const { rows } = await db.query<{ seed: string }>(`select seed from cards where id = $1`, [card.id]);
    expect(Number(rows[0]!.seed)).toBe(1001); // semente do servidor, não a do pedido
  });
});

describe('create-card (erros)', () => {
  it('sem login: 401', async () => {
    const { deps } = depsOn(db);
    expect((await handleCreateCard(request(await makePhoto(1), {}, 'Bearer errado'), deps)).status).toBe(401);
  });

  it('corpo inválido, mime errado, bytes que não são imagem: 400', async () => {
    const { deps } = depsOn(db);
    const bad = (body: string) =>
      handleCreateCard(new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer ok' }, body }), deps);
    expect((await bad('isso não é json')).status).toBe(400);
    expect((await bad(JSON.stringify({ photo: 'AAAA', mime: 'text/html' }))).status).toBe(400);
    expect((await bad(JSON.stringify({ photo: 'AAAA', mime: 'image/jpeg' }))).status).toBe(400);
  });

  it('categoria manual desconhecida: 422', async () => {
    const { deps } = depsOn(db);
    expect((await handleCreateCard(request(await makePhoto(4), { category: 'dragao' }), deps)).status).toBe(422);
  });

  it('classificador fora do ar: 502 e nada é gravado', async () => {
    const { deps, storage } = depsOn(db, {
      classifier: { classify: async () => { throw new ClassifierError('unavailable', 'x'); } },
    });
    expect((await handleCreateCard(request(await makePhoto(5)), deps)).status).toBe(502);
    expect(storage.size).toBe(0);
    expect((await db.query(`select 1 from cards`)).rows).toHaveLength(0);
  });

  it('se a transação recusar no fim (corrida), a foto enviada é apagada', async () => {
    // checkPhoto "mente" que está ok; quem barra é o insert_card, como numa corrida real.
    await db.exec(`update app_config set value = 0 where key = 'daily_photo_limit'`);
    const { deps, storage } = depsOn(db);
    deps.checkPhoto = async () => 'ok';
    const res = await handleCreateCard(request(await makePhoto(6)), deps);
    expect(res.status).toBe(429);
    expect(storage.size).toBe(0);
  });

  it('falha inesperada no banco: 500 e a foto enviada é apagada', async () => {
    const { deps, storage } = depsOn(db);
    deps.insertCard = async () => { throw new Error('banco caiu'); };
    const res = await handleCreateCard(request(await makePhoto(7)), deps);
    expect(res.status).toBe(500);
    expect(storage.size).toBe(0);
  });
});
