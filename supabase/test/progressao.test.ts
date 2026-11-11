import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { handleMatch } from '../src/match/handler';
import {
  DEFAULT_PROGRESSION,
  DEFAULT_RULES,
  RARITIES,
  applyUpgrade,
  checkUpgrade,
  settleMatch,
  upgradeCap,
  type SettleCause,
  type UpgradableCard,
} from '../../engine/src';
import { addPhotoCard, as, GUEST_DECK, HOST_DECK, matchDepsOn, newMatchDb, post, rpcOn, saveDeck, U1, U2, U3 } from './matchDeps';

// Fase 5 contra o banco REAL (todas as migrações em memória): o trigger de fim de partida, a melhoria de cartas
// e o ranking, sempre conferindo se o SQL dá o MESMO resultado que as regras do motor (engine/src/progression.ts).
const migration = readFileSync(new URL('../migrations/20261111000001_progressao_ranking.sql', import.meta.url), 'utf8');

let db: PGlite;
let rpc: ReturnType<typeof rpcOn>;
let n = 0;

beforeEach(async () => {
  db = await newMatchDb();
  await db.exec(migration);
  rpc = rpcOn(db);
  n = 0;
});

interface Result {
  rated: boolean;
  winner_seat: number | null;
  host_delta: number;
  guest_delta: number;
  host_essence: number;
  guest_essence: number;
  host_rating_before: number;
  guest_rating_before: number;
}

async function setStats(user: string, rating: number) {
  await db.query(
    `insert into player_stats (user_id, rating) values ($1, $2)
     on conflict (user_id) do update set rating = $2, essence = 0, essence_earned = 0, rated_matches = 0, wins = 0, losses = 0, draws = 0`,
    [user, rating],
  );
}

/** Cria e termina uma partida direto pelas funções do servidor (sem jogar): host = lado 0 (U1), convidado = lado 1 (U2). */
async function finish(winner: 0 | 1 | 'draw', cause: SettleCause | 'cancelled', turn: number): Promise<string> {
  const id = `dddddddd-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const code = `ZZZZ${String(n).padStart(2, '0')}`.replace(/[01]/g, '2');
  await rpc('match_create', { p_match: id, p_host: U1, p_code: code, p_deck: [], p_photos: {}, p_views: [{ player_id: U1, seat: 0, status: 'waiting', view: {}, photo_paths: [] }] });
  await rpc('match_join', {
    p_match: id, p_guest: U2, p_state: { winner: null, turn: 1 }, p_events: [], p_deadline: '2026-11-10T12:01:00Z',
    p_views: [U1, U2].map((u, seat) => ({ player_id: u, seat, status: 'active', view: {}, photo_paths: [] })),
  });
  await rpc('match_apply', {
    p_match: id, p_expected: 1, p_state: { winner, turn }, p_new_events: [], p_status: 'finished', p_cause: cause,
    p_deadline: '2026-11-10T12:01:00Z', p_missed: [0, 0],
    p_views: [U1, U2].map((u, seat) => ({ player_id: u, seat, status: 'finished', view: {}, photo_paths: [] })),
  });
  return id;
}

const resultOf = async (id: string) =>
  (await db.query<Result>(`select * from match_results where match_id = $1`, [id])).rows[0];
const stats = async (u: string) =>
  (await db.query<Record<string, number>>(`select * from player_stats where user_id = $1`, [u])).rows[0];

describe('regras no banco = regras do motor', () => {
  it('as tabelas de melhoria e os parâmetros copiam o motor', async () => {
    const rules = (await db.query<{ rarity: string; max_power: number; cost_per_power: number }>(`select * from upgrade_rules`)).rows;
    for (const r of RARITIES) {
      const row = rules.find((x) => x.rarity === r)!;
      expect(row.max_power).toBe(upgradeCap(r, DEFAULT_RULES));
      expect(row.cost_per_power).toBe(DEFAULT_PROGRESSION.upgradeCostPerPower[r]);
    }
    const cfg = Object.fromEntries((await db.query<{ key: string; value: number }>(`select * from app_config`)).rows.map((r) => [r.key, r.value]));
    expect(cfg).toMatchObject({
      elo_k: DEFAULT_PROGRESSION.eloK,
      rating_floor: DEFAULT_PROGRESSION.ratingFloor,
      reward_win: DEFAULT_PROGRESSION.rewardWin,
      reward_draw: DEFAULT_PROGRESSION.rewardDraw,
      reward_loss: DEFAULT_PROGRESSION.rewardLoss,
      reward_min_turns: DEFAULT_PROGRESSION.rewardMinTurns,
    });
    await db.query(`insert into player_stats (user_id) values ($1)`, [U3]);
    expect((await stats(U3)).rating).toBe(DEFAULT_PROGRESSION.startRating);
  });

  it('o fim de partida dá o mesmo rating e a mesma Essência que settleMatch, em todos os casos', async () => {
    const ratingPairs: [number, number][] = [[1000, 1000], [1000, 1400], [1400, 1000], [5, 1000], [10, 10], [1337, 1338], [2500, 900]];
    const outcomes: [0 | 1 | 'draw', SettleCause, number][] = [
      [0, 'hp_zero', 20], [1, 'hp_zero', 20], ['draw', 'turn_limit', 60], [0, 'forfeit', 3], [1, 'forfeit', 12],
      [0, 'timeout', 30], [1, 'abandoned', 8], [0, 'hp_zero', 5], [1, 'hp_zero', 6],
    ];
    for (const [r0, r1] of ratingPairs) {
      for (const [winner, cause, turns] of outcomes) {
        await setStats(U1, r0);
        await setStats(U2, r1);
        await db.exec(`delete from match_results`);
        const res = await resultOf(await finish(winner, cause, turns));
        const expected = settleMatch({ ratings: [r0, r1], winner, cause, turns, rated: true });
        const label = `${r0} x ${r1}, ${String(winner)}, ${cause}, turno ${turns}`;
        expect({ label, rated: res!.rated, delta: [res!.host_delta, res!.guest_delta], essence: [res!.host_essence, res!.guest_essence] }).toEqual({
          label, rated: true, delta: expected.ratingDelta, essence: expected.essence,
        });
        expect([(await stats(U1)).rating, (await stats(U2)).rating]).toEqual(expected.ratingAfter);
        expect([(await stats(U1)).essence, (await stats(U2)).essence]).toEqual(expected.essence);
      }
    }
  });

  it('melhorar: o banco aceita e recusa nos mesmos casos que checkUpgrade, em todas as raridades', async () => {
    for (const rarity of RARITIES) {
      const id = `eeeeeeee-0000-4000-8000-${String(RARITIES.indexOf(rarity) + 1).padStart(12, '0')}`;
      await db.query(
        `insert into cards (id, owner_id, name, photo_path, photo_hash, category, element, rarity, attack, health, seed)
         values ($1::uuid, $2::uuid, 'X', $3, $4::bit(64), 'galinha', 'terra', $5, 3, 6, 1)`,
        [id, U1, `${U1}/${id}.jpg`, String(RARITIES.indexOf(rarity)).repeat(64).replace(/[2-9]/g, '1'), rarity],
      );
      await setStats(U1, 1000);
      let card: UpgradableCard = { rarity, attack: 3, health: 6, upgradeAttack: 0, upgradeHealth: 0 };
      let essence = 0;
      // sequência fixa de tentativas que bate no teto e no saldo
      for (const stat of ['health', 'attack', 'health', 'attack', 'health', 'health', 'attack', 'health', 'health', 'health'] as const) {
        essence += 25; // dá um pouco de saldo a cada tentativa
        await db.query(`update player_stats set essence = essence + 25 where user_id = $1`, [U1]);
        const check = checkUpgrade(card, stat, essence, DEFAULT_RULES);
        const attempt = as(db, U1, () => db.query<{ r: any }>(`select upgrade_card($1::uuid, $2) r`, [id, stat]));
        if (check.ok) {
          const out = (await attempt).rows[0]!.r;
          card = applyUpgrade(card, stat);
          essence -= check.cost;
          expect(out).toMatchObject({ attack: card.attack, health: card.health, upgrade_attack: card.upgradeAttack, upgrade_health: card.upgradeHealth, essence });
        } else {
          await expect(attempt).rejects.toThrow(check.reason === 'cap' ? /upgrade_cap/ : /not_enough_essence/);
        }
        expect((await stats(U1)).essence).toBe(essence);
      }
    }
  });
});

describe('fim de partida', () => {
  beforeEach(async () => {
    await setStats(U1, 1000);
    await setStats(U2, 1000);
  });

  it('atualiza vitórias, derrotas, empates e o total de Essência ganho', async () => {
    await finish(0, 'hp_zero', 20);
    await finish(1, 'hp_zero', 20);
    await finish(1, 'hp_zero', 20);
    await finish('draw', 'turn_limit', 60);
    expect(await stats(U1)).toMatchObject({ rated_matches: 4, wins: 1, losses: 2, draws: 1, essence: 30 + 10 + 10 + 20, essence_earned: 70 });
    expect(await stats(U2)).toMatchObject({ rated_matches: 4, wins: 2, losses: 1, draws: 1, essence: 10 + 30 + 30 + 20 });
  });

  it('convite cancelado e partida sem segundo jogador não pontuam', async () => {
    await rpc('match_create', { p_match: 'ffffffff-0000-4000-8000-000000000001', p_host: U1, p_code: 'CANCEL', p_deck: [], p_photos: {}, p_views: [{ player_id: U1, seat: 0, status: 'waiting', view: {}, photo_paths: [] }] });
    await rpc('match_cancel_waiting', { p_host: U1 });
    expect((await db.query(`select 1 from match_results`)).rows).toHaveLength(0);
    expect((await stats(U1)).rated_matches).toBe(0);
  });

  it('o mesmo par só pontua `rated_pair_daily` partidas por dia; depois é amistosa (nada muda)', async () => {
    await db.exec(`update app_config set value = 2 where key = 'rated_pair_daily'`);
    await finish(0, 'hp_zero', 20);
    await finish(0, 'hp_zero', 20);
    const third = await resultOf(await finish(0, 'hp_zero', 20));
    expect(third).toMatchObject({ rated: false, host_delta: 0, guest_delta: 0, host_essence: 0, guest_essence: 0 });
    expect((await stats(U1)).rated_matches).toBe(2);
    expect((await stats(U1)).essence).toBe(60);
    // inverter quem criou a partida não dribla o limite: é o mesmo par (U2 x U1). Testado pelo `or` da consulta.
    expect((await db.query(`select 1 from match_results where rated`)).rows).toHaveLength(2);
  });

  it('um erro na pontuação nunca impede a partida de terminar', async () => {
    await db.exec(`alter table player_stats rename to player_stats_off`);
    const id = await finish(0, 'hp_zero', 20);
    expect((await db.query<{ status: string }>(`select status from matches where id = $1`, [id])).rows[0]!.status).toBe('finished');
    expect(await resultOf(id)).toBeUndefined(); // a pontuação foi desfeita junto
  });

  it('pelo handler real: desistir no 1º turno mexe no rating, mas não paga Essência', async () => {
    await saveDeck(db, U1, HOST_DECK);
    await saveDeck(db, U2, GUEST_DECK);
    const ctx = matchDepsOn(db);
    const call = async (user: string, body: Record<string, unknown>) => {
      ctx.caller.user = user;
      return (await handleMatch(post(body), ctx.deps)).json() as Promise<any>;
    };
    const created = await call(U1, { op: 'create' });
    await call(U2, { op: 'join', code: created.view.code });
    await call(U2, { op: 'forfeit', matchId: created.matchId });
    const res = await resultOf(created.matchId);
    expect(res).toMatchObject({ rated: true, winner_seat: 0, host_delta: 16, guest_delta: -16, host_essence: 0, guest_essence: 0 });
  });
});

describe('acesso', () => {
  it('cada um lê só o próprio placar e os resultados das próprias partidas; ninguém escreve', async () => {
    await finish(0, 'hp_zero', 20);
    expect((await as(db, U1, () => db.query(`select user_id from player_stats`))).rows).toEqual([{ user_id: U1 }]);
    expect((await as(db, U3, () => db.query(`select 1 from player_stats`))).rows).toHaveLength(0);
    expect((await as(db, U3, () => db.query(`select 1 from match_results`))).rows).toHaveLength(0);
    expect((await as(db, U2, () => db.query(`select 1 from match_results`))).rows).toHaveLength(1);
    for (const sql of [
      `update player_stats set essence = 9999`, `insert into player_stats (user_id) values ('${U3}')`, `delete from match_results`,
      `update upgrade_rules set cost_per_power = 1`, `update cards set attack = 99`, `update match_results set host_delta = 99`,
    ]) {
      await expect(as(db, U1, () => db.exec(sql))).rejects.toThrow(/permission denied/);
    }
    await expect(as(db, null, () => db.query(`select 1 from player_stats`))).rejects.toThrow(/permission denied/);
    await expect(as(db, null, () => db.query(`select * from leaderboard(5)`))).rejects.toThrow(/permission denied/);
    await expect(as(db, null, () => db.query(`select upgrade_card('${U1}', 'health')`))).rejects.toThrow(/permission denied/);
  });

  it('não dá para melhorar carta de outro, carta que não existe nem com atributo inválido', async () => {
    const card = 'bbbbbbbb-0000-4000-8000-000000000009';
    await addPhotoCard(db, card, U1);
    await setStats(U2, 1000);
    await db.query(`update player_stats set essence = 500 where user_id = $1`, [U2]);
    await expect(as(db, U2, () => db.query(`select upgrade_card($1::uuid, 'health')`, [card]))).rejects.toThrow(/card_not_found/);
    await expect(as(db, U2, () => db.query(`select upgrade_card(gen_random_uuid(), 'health')`))).rejects.toThrow(/card_not_found/);
    await expect(as(db, U1, () => db.query(`select upgrade_card($1::uuid, 'defense')`, [card]))).rejects.toThrow(/invalid_stat/);
    expect((await stats(U2)).essence).toBe(500);
  });

  it('o ranking mostra apelido, rating e vitórias; põe o jogador mesmo fora do top; só quem jogou aparece', async () => {
    await db.exec(`update profiles set display_name = 'Rames' where id = '${U1}'; update profiles set display_name = 'Amigo' where id = '${U2}'`);
    await finish(0, 'hp_zero', 20);
    const top = await as(db, U2, () => db.query<any>(`select * from leaderboard(1)`));
    expect(top.rows.map((r) => [Number(r.rank), r.display_name, r.rating, r.is_me])).toEqual([
      [1, 'Rames', 1016, false],
      [2, 'Amigo', 984, true], // fora do top 1, mas a própria linha vem junto
    ]);
    const mine = await as(db, U3, () => db.query<any>(`select * from leaderboard(10)`));
    expect(mine.rows).toHaveLength(2); // U3 nunca jogou: não aparece
    expect(mine.rows.every((r) => r.is_me === false)).toBe(true);
    const history = await as(db, U2, () => db.query<any>(`select * from my_match_history(5)`));
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0]).toMatchObject({ result: 'loss', cause: 'hp_zero', rated: true, rating_delta: -16, essence: 10, foe_name: 'Rames' });
  });
});

describe('melhoria e baralho', () => {
  it('a carta melhorada vai para a partida online já com os atributos novos e o baralho continua válido', async () => {
    const card = 'bbbbbbbb-0000-4000-8000-000000000002';
    await addPhotoCard(db, card, U1, 3, 6); // depois ajustada abaixo para uma comum sem bônus
    await setStats(U1, 1000);
    await db.query(`update player_stats set essence = 100 where user_id = $1`, [U1]);
    await db.query(`update cards set attack = 2, health = 5 where id = $1`, [card]); // poder 9, sem bônus
    await as(db, U1, () => db.query(`select upgrade_card($1::uuid, 'health')`, [card]));
    await as(db, U1, () => db.query(`select upgrade_card($1::uuid, 'health')`, [card]));
    await saveDeck(db, U1, [...HOST_DECK.slice(0, 6), card]);
    await saveDeck(db, U2, GUEST_DECK);
    const loaded = (await rpc('match_load_deck', { p_user: U1 })) as { photo_cards: { attack: number; health: number }[] };
    expect(loaded.photo_cards[0]).toMatchObject({ attack: 2, health: 7 });
    const ctx = matchDepsOn(db);
    ctx.caller.user = U1;
    const created = await (await handleMatch(post({ op: 'create' }), ctx.deps)).json();
    expect(created.view.kind).toBe('waiting'); // baralho aceito pelo servidor
  });
});
