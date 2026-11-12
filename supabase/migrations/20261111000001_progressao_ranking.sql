-- Fase 5: progressão (melhorar cartas com Essência) e ranking (rating Elo das partidas online).
-- Regra de ouro (igual às fases anteriores): o cliente só LÊ. Quem decide recompensa, rating e melhoria é o banco:
--   * Fim de partida online: um TRIGGER em `matches` calcula rating e Essência dos dois jogadores na mesma
--     transação em que a partida é marcada como terminada. Não depende de a Edge Function `match` ser republicada.
--   * Melhoria de carta: a função `upgrade_card` (o app a chama com o login do jogador) confere dono, teto e saldo.
-- As regras (números e fórmulas) são as de engine/src/progression.ts; supabase/test/progressao.test.ts confere que
-- o SQL daqui e o TypeScript do motor dão os mesmos resultados. Fórmulas em docs/game-design.md.
-- Nada aqui altera o que as fases 2 a 4 já fazem: sem esta migração o app antigo segue funcionando.

-- ---------------------------------------------------------------------------------------------
-- Cartas de foto: quantos passos de melhoria já foram comprados (ataque/vida já incluem as melhorias)
-- ---------------------------------------------------------------------------------------------
alter table public.cards
  add column upgrade_attack int not null default 0 check (upgrade_attack >= 0),
  add column upgrade_health int not null default 0 check (upgrade_health >= 0);

-- Regras de melhoria por raridade. max_power = teto de poder ganho com melhorias (25% do orçamento, para baixo);
-- cost_per_power = Essência por ponto de poder (+1 vida = 1 ponto, +1 ataque = 2 pontos).
create table public.upgrade_rules (
  rarity text primary key check (rarity in ('comum', 'incomum', 'rara', 'epica', 'lendaria')),
  max_power int not null check (max_power >= 0),
  cost_per_power int not null check (cost_per_power > 0)
);
insert into public.upgrade_rules (rarity, max_power, cost_per_power) values
  ('comum', 2, 10), ('incomum', 3, 15), ('rara', 4, 20), ('epica', 6, 30), ('lendaria', 7, 40);

-- Parâmetros de ranking e recompensa, ajustáveis com UPDATE em app_config (sem republicar nada).
insert into public.app_config (key, value) values
  ('elo_k', 32),             -- quanto o rating se mexe por partida
  ('rating_floor', 0),       -- rating nunca fica abaixo disto
  ('reward_win', 30),        -- Essência por vitória
  ('reward_draw', 20),       -- Essência por empate
  ('reward_loss', 10),       -- Essência por derrota "lutada até o fim" (quem desiste/estoura o tempo/some ganha 0)
  ('reward_min_turns', 6),   -- partida mais curta que isto (turnos totais) não rende Essência
  ('rated_pair_daily', 10)   -- partidas pontuadas por dia entre os MESMOS dois jogadores (10 nos testes; 3 no jogo final)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Placar de cada jogador. Nasce sozinho na primeira partida pontuada (ou na primeira melhoria).
-- ---------------------------------------------------------------------------------------------
create table public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rating int not null default 1000 check (rating >= 0),
  rated_matches int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  essence int not null default 0 check (essence >= 0),
  essence_earned int not null default 0,   -- total já ganho (o saldo é `essence`, depois dos gastos)
  updated_at timestamptz not null default now()
);

-- Uma linha por partida online pontuada ou amistosa que terminou: serve de histórico e de trava do limite diário do par.
create table public.match_results (
  match_id uuid primary key references public.matches (id) on delete cascade,
  finished_at timestamptz not null default now(),
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid not null references auth.users (id) on delete cascade,
  winner_seat int check (winner_seat in (0, 1)),   -- null = empate
  cause text not null,
  turns int not null,
  rated boolean not null,                          -- false = amistosa (o par passou do limite do dia): nada mudou
  host_rating_before int not null,
  guest_rating_before int not null,
  host_delta int not null default 0,
  guest_delta int not null default 0,
  host_essence int not null default 0,
  guest_essence int not null default 0
);
create index match_results_pair_idx on public.match_results (host_id, guest_id, finished_at);
create index match_results_host_idx on public.match_results (host_id, finished_at desc);
create index match_results_guest_idx on public.match_results (guest_id, finished_at desc);

alter table public.upgrade_rules enable row level security;
alter table public.player_stats enable row level security;
alter table public.match_results enable row level security;

revoke all on public.upgrade_rules, public.player_stats, public.match_results from anon, authenticated;
grant select on public.upgrade_rules, public.player_stats, public.match_results to authenticated;
create policy "regras de melhoria visíveis a quem está logado" on public.upgrade_rules
  for select to authenticated using (true);
create policy "cada um lê o próprio placar" on public.player_stats
  for select to authenticated using (user_id = auth.uid());
create policy "cada um lê os resultados das próprias partidas" on public.match_results
  for select to authenticated using (auth.uid() in (host_id, guest_id));
-- Sem policy de escrita: só o trigger e as funções abaixo (security definer) escrevem.

-- ---------------------------------------------------------------------------------------------
-- Fim de partida: rating (Elo) e Essência
-- ---------------------------------------------------------------------------------------------
create function public.matches_settle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg jsonb := (select jsonb_object_agg(key, value) from app_config);
  v_winner_text text := new.state ->> 'winner';           -- '0', '1' ou 'draw'
  v_winner int := case v_winner_text when '0' then 0 when '1' then 1 else null end;
  v_turns int := coalesce((new.state ->> 'turn')::int, 0);
  v_today_start timestamptz :=
    date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_quitter boolean := new.end_cause in ('forfeit', 'timeout', 'abandoned');
  v_long boolean := v_turns >= (v_cfg ->> 'reward_min_turns')::int;
  v_rated boolean;
  v_r0 int; v_r1 int;
  v_e0 numeric; v_s0 numeric;
  v_d0 int; v_after0 int; v_after1 int; v_floor int := (v_cfg ->> 'rating_floor')::int;
  v_ess0 int := 0; v_ess1 int := 0;
  v_inserted int;
begin
  -- Convite cancelado, ou partida sem os dois jogadores: nada a pontuar.
  if new.guest_id is null or new.state is null or new.end_cause = 'cancelled' or v_winner_text is null then
    return new;
  end if;
  begin
    -- Cria os placares que faltam e trava os dois (sempre na mesma ordem, para duas partidas não se travarem).
    insert into player_stats (user_id) values (new.host_id), (new.guest_id) on conflict (user_id) do nothing;
    perform 1 from player_stats where user_id in (new.host_id, new.guest_id) order by user_id for update;
    select rating into v_r0 from player_stats where user_id = new.host_id;
    select rating into v_r1 from player_stats where user_id = new.guest_id;

    -- Limite diário do mesmo par: depois dele a partida é amistosa (anti-farm entre duas contas combinadas).
    v_rated := (
      select count(*) from match_results r
      where r.rated and r.finished_at >= v_today_start
        and ((r.host_id = new.host_id and r.guest_id = new.guest_id)
          or (r.host_id = new.guest_id and r.guest_id = new.host_id))
    ) < (v_cfg ->> 'rated_pair_daily')::int;

    if v_rated then
      -- Elo: chance esperada do lado 0, K fixo, soma zero; `round(numeric)` arredonda metades para longe do zero.
      v_e0 := 1 / (1 + power(10::numeric, (v_r1 - v_r0)::numeric / 400));
      v_s0 := case when v_winner is null then 0.5 when v_winner = 0 then 1 else 0 end;
      v_d0 := round((v_cfg ->> 'elo_k')::numeric * (v_s0 - v_e0));
      v_after0 := greatest(v_floor, v_r0 + v_d0);
      v_after1 := greatest(v_floor, v_r1 - v_d0);
      if v_long then
        -- Vitória e empate pagam; derrota paga só a quem lutou até o fim.
        v_ess0 := case when v_winner is null then (v_cfg ->> 'reward_draw')::int
                       when v_winner = 0 then (v_cfg ->> 'reward_win')::int
                       when v_quitter then 0 else (v_cfg ->> 'reward_loss')::int end;
        v_ess1 := case when v_winner is null then (v_cfg ->> 'reward_draw')::int
                       when v_winner = 1 then (v_cfg ->> 'reward_win')::int
                       when v_quitter then 0 else (v_cfg ->> 'reward_loss')::int end;
      end if;
    else
      v_after0 := v_r0;
      v_after1 := v_r1;
    end if;

    insert into match_results (match_id, host_id, guest_id, winner_seat, cause, turns, rated,
                               host_rating_before, guest_rating_before, host_delta, guest_delta, host_essence, guest_essence)
    values (new.id, new.host_id, new.guest_id, v_winner, new.end_cause, v_turns, v_rated,
            v_r0, v_r1, v_after0 - v_r0, v_after1 - v_r1, v_ess0, v_ess1)
    on conflict (match_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 or not v_rated then
      return new;
    end if;

    update player_stats set
      rating = v_after0, rated_matches = rated_matches + 1,
      wins = wins + (case when v_winner = 0 then 1 else 0 end),
      losses = losses + (case when v_winner = 1 then 1 else 0 end),
      draws = draws + (case when v_winner is null then 1 else 0 end),
      essence = essence + v_ess0, essence_earned = essence_earned + v_ess0, updated_at = now()
    where user_id = new.host_id;
    update player_stats set
      rating = v_after1, rated_matches = rated_matches + 1,
      wins = wins + (case when v_winner = 1 then 1 else 0 end),
      losses = losses + (case when v_winner = 0 then 1 else 0 end),
      draws = draws + (case when v_winner is null then 1 else 0 end),
      essence = essence + v_ess1, essence_earned = essence_earned + v_ess1, updated_at = now()
    where user_id = new.guest_id;
  exception when others then
    -- Um erro aqui NUNCA pode impedir a partida de terminar: desfaz só a pontuação e segue.
    raise warning 'matches_settle falhou na partida %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function public.matches_settle() from public, anon, authenticated;

create trigger matches_settle_after_finish
  after update of status on public.matches
  for each row
  when (old.status is distinct from 'finished' and new.status = 'finished')
  execute function public.matches_settle();

-- ---------------------------------------------------------------------------------------------
-- Melhorar uma carta de foto (cartas fixas não são melhoráveis)
-- ---------------------------------------------------------------------------------------------
-- p_stat = 'attack' (+1 ataque = 2 pontos de poder) ou 'health' (+1 vida = 1 ponto). O custo e o teto vêm de
-- `upgrade_rules`. Quem chama é o próprio jogador (auth.uid()); não dá para melhorar carta de outro.
-- Erros (mensagem = código): unauthorized, invalid_stat, card_not_found, upgrade_cap, not_enough_essence.
create function public.upgrade_card(p_card uuid, p_stat text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_card cards;
  v_rule upgrade_rules;
  v_power int;
  v_cost int;
  v_essence int;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if p_stat not in ('attack', 'health') then
    raise exception 'invalid_stat' using errcode = 'P0001';
  end if;
  v_power := case p_stat when 'attack' then 2 else 1 end;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 2));
  select * into v_card from cards where id = p_card and owner_id = v_uid for update;
  if not found then
    raise exception 'card_not_found' using errcode = 'P0001';
  end if;
  select * into v_rule from upgrade_rules where rarity = v_card.rarity;
  if v_card.upgrade_attack * 2 + v_card.upgrade_health + v_power > v_rule.max_power then
    raise exception 'upgrade_cap' using errcode = 'P0001';
  end if;

  v_cost := v_rule.cost_per_power * v_power;
  insert into player_stats (user_id) values (v_uid) on conflict (user_id) do nothing;
  select essence into v_essence from player_stats where user_id = v_uid for update;
  if v_essence < v_cost then
    raise exception 'not_enough_essence' using errcode = 'P0001';
  end if;

  update player_stats set essence = essence - v_cost, updated_at = now() where user_id = v_uid;
  update cards set
    attack = attack + (case when p_stat = 'attack' then 1 else 0 end),
    health = health + (case when p_stat = 'health' then 1 else 0 end),
    upgrade_attack = upgrade_attack + (case when p_stat = 'attack' then 1 else 0 end),
    upgrade_health = upgrade_health + (case when p_stat = 'health' then 1 else 0 end)
  where id = p_card
  returning * into v_card;

  return jsonb_build_object(
    'card_id', v_card.id, 'attack', v_card.attack, 'health', v_card.health,
    'upgrade_attack', v_card.upgrade_attack, 'upgrade_health', v_card.upgrade_health,
    'cost', v_cost, 'essence', v_essence - v_cost);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Ranking e histórico (só o que é público: apelido, rating e vitórias/derrotas)
-- ---------------------------------------------------------------------------------------------
-- Os `top` melhores por rating (empate: mais vitórias) + a linha do próprio jogador, mesmo fora do top.
-- Só entra quem já jogou ao menos uma partida pontuada.
create function public.leaderboard(p_limit int default 50)
returns table (rank bigint, display_name text, rating int, wins int, losses int, draws int, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select s.user_id, s.rating, s.wins, s.losses, s.draws,
           rank() over (order by s.rating desc, s.wins desc) as rank
    from player_stats s
    where s.rated_matches > 0
  )
  select r.rank,
         coalesce(p.display_name, 'Jogador ' || substr(r.user_id::text, 1, 4)),
         r.rating, r.wins, r.losses, r.draws,
         r.user_id = auth.uid()
  from ranked r
  left join profiles p on p.id = r.user_id
  where r.rank <= greatest(1, least(coalesce(p_limit, 50), 100)) or r.user_id = auth.uid()
  order by r.rank, 2;
$$;

-- Últimas partidas do jogador, do ponto de vista dele.
create function public.my_match_history(p_limit int default 20)
returns table (match_id uuid, finished_at timestamptz, result text, cause text, rated boolean,
               rating_delta int, essence int, foe_name text)
language sql
stable
security definer
set search_path = public
as $$
  select r.match_id, r.finished_at,
         case when r.winner_seat is null then 'draw'
              when (r.winner_seat = 0) = (r.host_id = auth.uid()) then 'win' else 'loss' end,
         r.cause, r.rated,
         case when r.host_id = auth.uid() then r.host_delta else r.guest_delta end,
         case when r.host_id = auth.uid() then r.host_essence else r.guest_essence end,
         coalesce(p.display_name, 'Jogador ' || substr(foe.id::text, 1, 4))
  from match_results r
  cross join lateral (select case when r.host_id = auth.uid() then r.guest_id else r.host_id end as id) foe
  left join profiles p on p.id = foe.id
  where auth.uid() in (r.host_id, r.guest_id)
  order by r.finished_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

-- Funções criadas em `public` ficam expostas à API por padrão: abrimos só o que o app usa, só a quem está logado.
revoke all on function public.upgrade_card(uuid, text) from public, anon, authenticated;
revoke all on function public.leaderboard(int) from public, anon, authenticated;
revoke all on function public.my_match_history(int) from public, anon, authenticated;
grant execute on function public.upgrade_card(uuid, text) to authenticated;
grant execute on function public.leaderboard(int) to authenticated;
grant execute on function public.my_match_history(int) to authenticated;
