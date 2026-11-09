import type { PGlite } from '@electric-sql/pglite';
import { beforeEach, describe, expect, it } from 'vitest';
import { as, newMatchDb, rpcOn, U1, U2, U3 } from './matchDeps';

// Regras de acesso da fase 4 PELOS PAPÉIS do Supabase: `set role authenticated` liga a RLS como no app.
let db: PGlite;
let rpc: ReturnType<typeof rpcOn>;
const MATCH = 'cccccccc-0000-4000-8000-000000000001';
const SECRET = 'SEGREDO-NA-MAO-DO-ADVERSARIO';

const waitingView = (code: string) => [{ player_id: U1, seat: 0, status: 'waiting', view: { kind: 'waiting', code }, photo_paths: [] }];
const gameViews = (photoPathsForU2: string[] = []) => [
  { player_id: U1, seat: 0, status: 'active', view: { kind: 'game', hand: ['minha mão'] }, photo_paths: [] },
  { player_id: U2, seat: 1, status: 'active', view: { kind: 'game', hand: ['mão do U2'] }, photo_paths: photoPathsForU2 },
];

async function startedMatch(photoPathsForU2: string[] = []) {
  await rpc('match_create', { p_match: MATCH, p_host: U1, p_code: 'ABCDE2', p_deck: [], p_photos: {}, p_views: waitingView('ABCDE2') });
  await rpc('match_join', {
    p_match: MATCH, p_guest: U2, p_state: { segredo: SECRET }, p_events: [], p_deadline: '2026-11-10T12:01:00Z',
    p_views: gameViews(photoPathsForU2),
  });
}

beforeEach(async () => {
  db = await newMatchDb();
  rpc = rpcOn(db);
});

describe('quem lê o quê', () => {
  it('o jogador lê só a própria visão; a do adversário e o estado completo ficam fora do alcance', async () => {
    await startedMatch();
    const mine = await as(db, U1, () => db.query<{ player_id: string }>(`select player_id from match_views`));
    expect(mine.rows.map((r) => r.player_id)).toEqual([U1]);
    const theirs = await as(db, U2, () => db.query<{ player_id: string }>(`select player_id from match_views`));
    expect(theirs.rows.map((r) => r.player_id)).toEqual([U2]);
    // quem não joga a partida não vê nada
    expect((await as(db, U3, () => db.query(`select 1 from match_views`))).rows).toHaveLength(0);
    expect((await as(db, null, () => db.query(`select 1 from match_views`).catch(() => ({ rows: [] })))).rows).toHaveLength(0);
  });

  it('ninguém logado consegue ler `matches` (onde estão as mãos e a ordem dos montes)', async () => {
    await startedMatch();
    for (const u of [U1, U2, U3]) {
      await expect(as(db, u, () => db.query(`select state from matches`))).rejects.toThrow(/permission denied/);
      await expect(as(db, u, () => db.query(`select id from matches`))).rejects.toThrow(/permission denied/);
    }
  });

  it('o cliente não escreve em matches nem em match_views, e não chama as funções do servidor', async () => {
    await startedMatch();
    await expect(as(db, U1, () => db.exec(`update match_views set view = '{}'::jsonb`))).rejects.toThrow(/permission denied/);
    await expect(as(db, U1, () => db.exec(`delete from match_views`))).rejects.toThrow(/permission denied/);
    await expect(as(db, U1, () => db.exec(`insert into match_views (match_id, player_id, seat, version, status, view) values ('${MATCH}', '${U1}', 0, 9, 'active', '{}')`))).rejects.toThrow(/permission denied/);
    await expect(as(db, U1, () => db.exec(`update matches set status = 'finished'`))).rejects.toThrow(/permission denied/);
    for (const call of [
      `select match_get('${MATCH}')`,
      `select match_by_code('ABCDE2')`,
      `select match_load_deck('${U2}')`,
      `select match_config()`,
      `select match_current('${U2}')`,
    ]) {
      await expect(as(db, U1, () => db.query(call)), call).rejects.toThrow(/permission denied/);
    }
  });

  it('as configurações de tempo existem e o cliente não as lê', async () => {
    expect(await rpc('match_config', {})).toEqual({ turn_seconds: 60, max_missed_turns: 2, abandon_seconds: 300 });
    await expect(as(db, U1, () => db.query(`select * from app_config`))).rejects.toThrow(/permission denied/);
  });

  it('match_views está na publicação do Realtime', async () => {
    const { rows } = await db.query<{ tablename: string }>(`select tablename from pg_publication_tables where pubname = 'supabase_realtime'`);
    expect(rows.map((r) => r.tablename)).toContain('match_views');
  });
});

describe('fotos no Storage', () => {
  const MINE = `${U1}/carta-minha.jpg`;
  const SHOWN = `${U1}/carta-jogada.jpg`;
  const HIDDEN = `${U1}/carta-na-mao.jpg`;

  beforeEach(async () => {
    await db.exec(`insert into storage.objects (bucket_id, name) values
      ('card-photos', '${MINE}'), ('card-photos', '${SHOWN}'), ('card-photos', '${HIDDEN}'), ('outro-bucket', '${SHOWN}')`);
  });
  const visibleTo = async (u: string) =>
    (await as(db, u, () => db.query<{ name: string; bucket_id: string }>(`select bucket_id, name from storage.objects order by name`))).rows;

  it('o adversário vê a foto da carta já jogada, e só ela; o dono continua vendo as dele', async () => {
    await startedMatch([SHOWN]);
    const guest = await visibleTo(U2);
    expect(guest).toEqual([{ bucket_id: 'card-photos', name: SHOWN }]);
    expect((await visibleTo(U1)).map((r) => r.name).sort()).toEqual([HIDDEN, MINE, SHOWN].sort());
  });

  it('sem partida, ou fora da lista, ninguém vê foto de outro jogador', async () => {
    expect(await visibleTo(U2)).toEqual([]);
    await startedMatch([]);
    expect(await visibleTo(U2)).toEqual([]);
    expect(await visibleTo(U3)).toEqual([]);
  });
});

describe('persistência', () => {
  it('match_apply recusa versão velha e partida que não está em andamento', async () => {
    await startedMatch();
    const args = (expected: number) => ({
      p_match: MATCH, p_expected: expected, p_state: { n: expected }, p_new_events: [{ e: expected }], p_status: 'active',
      p_cause: null, p_deadline: '2026-11-10T12:02:00Z', p_missed: [0, 0], p_views: gameViews(),
    });
    expect(await rpc('match_apply', args(1))).toBe(2);
    await expect(rpc('match_apply', args(1))).rejects.toThrow(/stale_state/);
    expect(await rpc('match_apply', { ...args(2), p_status: 'finished', p_cause: 'forfeit' })).toBe(3);
    await expect(rpc('match_apply', args(3))).rejects.toThrow(/match_not_active/);
    const m = (await rpc('match_get', { p_match: MATCH })) as any;
    expect(m).toMatchObject({ status: 'finished', end_cause: 'forfeit', turn_deadline: null, version: 3 });
    expect(m.events).toEqual([{ e: 1 }, { e: 2 }]); // os eventos se acumulam
    const v = (await as(db, U1, () => db.query<any>(`select version, status from match_views`))).rows[0];
    expect(v).toEqual({ version: 3, status: 'active' }); // o banco grava o status da visão como o servidor mandou (o TS manda 'finished' ao fim; veja match.test.ts)
  });

  it('um jogador não fica em duas partidas ao mesmo tempo', async () => {
    await startedMatch();
    await expect(rpc('match_create', { p_match: 'cccccccc-0000-4000-8000-000000000002', p_host: U2, p_code: 'ZZZZZ2', p_deck: [], p_photos: {}, p_views: [] })).rejects.toThrow(/already_in_match/);
    await rpc('match_create', { p_match: 'cccccccc-0000-4000-8000-000000000003', p_host: U3, p_code: 'ZZZZZ3', p_deck: [], p_photos: {}, p_views: [{ player_id: U3, seat: 0, status: 'waiting', view: {}, photo_paths: [] }] });
    await expect(rpc('match_join', { p_match: 'cccccccc-0000-4000-8000-000000000003', p_guest: U1, p_state: {}, p_events: [], p_deadline: '2026-11-10T12:01:00Z', p_views: [] })).rejects.toThrow(/already_in_match/);
    expect(await rpc('match_current', { p_user: U2 })).toBe(MATCH);
  });

  it('dois códigos iguais abertos ao mesmo tempo não existem (índice único)', async () => {
    await rpc('match_create', { p_match: MATCH, p_host: U1, p_code: 'ABCDE2', p_deck: [], p_photos: {}, p_views: waitingView('ABCDE2') });
    await expect(rpc('match_create', { p_match: 'cccccccc-0000-4000-8000-000000000002', p_host: U2, p_code: 'ABCDE2', p_deck: [], p_photos: {}, p_views: [] })).rejects.toThrow(/matches_code_waiting_idx|duplicate key/);
  });
});
