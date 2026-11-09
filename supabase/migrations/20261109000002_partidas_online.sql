-- Fase 4: partidas online 1x1 por convite.
-- Regra de ouro (igual às fases 2 e 3): o cliente NUNCA escreve e NUNCA lê o estado completo da partida.
--   * `matches` guarda o estado inteiro (mãos, ordem dos montes, estado do sorteio). Ninguém além do
--     servidor tem acesso (sem grant e sem policy).
--   * `match_views` guarda, para cada jogador, só o que ele pode ver (a mão dele, a quantidade de cartas
--     da mão do outro). Cada um lê apenas a própria linha; o Realtime avisa quando ela muda.
--   * Quem escreve é a Edge Function `match`, com a chave de serviço, pelas funções abaixo.

-- Parâmetros ajustáveis sem redeploy (UPDATE em app_config).
insert into public.app_config (key, value) values
  ('turn_seconds', 60),      -- tempo de cada turno
  ('max_missed_turns', 2),   -- turnos seguidos sem jogar até perder por tempo
  ('abandon_seconds', 300),  -- turno vencido há mais que isto = jogador sumiu, perde
  ('invite_minutes', 15)     -- validade do código de convite
on conflict (key) do nothing;

create table public.matches (
  id uuid primary key,
  code text not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  -- O criador da partida é sempre o lado 0 do motor; quem entra é o lado 1. Quem COMEÇA o sorteio decide.
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid references auth.users (id) on delete cascade,
  host_deck jsonb not null,                  -- cartas do criador (CardDef[]), guardadas ao criar
  card_photos jsonb not null default '{}',   -- id da carta -> caminho da foto, dos dois baralhos
  state jsonb,                               -- GameState completo (SEGREDO: só o servidor lê)
  events jsonb not null default '[]',        -- todos os eventos da partida, na ordem (SEGREDO: tem as compras)
  version int not null default 0,            -- sobe a cada mudança; o app manda a que viu (evita jogada em tela velha)
  turn_deadline timestamptz,
  missed_turns int[] not null default '{0,0}', -- turnos seguidos estourados por lado
  end_cause text check (end_cause in ('hp_zero', 'turn_limit', 'forfeit', 'timeout', 'abandoned', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guest_id is null or guest_id <> host_id)
);
-- Só um convite aberto por código (códigos de partidas acabadas podem se repetir).
create unique index matches_code_waiting_idx on public.matches (code) where status = 'waiting';
create index matches_host_open_idx on public.matches (host_id) where status <> 'finished';
create index matches_guest_open_idx on public.matches (guest_id) where status <> 'finished';

create table public.match_views (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references auth.users (id) on delete cascade,
  seat int not null check (seat in (0, 1)),
  version int not null,
  status text not null check (status in ('waiting', 'active', 'finished')),
  view jsonb not null,
  -- Fotos das cartas do ADVERSÁRIO que já foram jogadas (a policy de Storage abaixo lê esta lista).
  photo_paths text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index match_views_player_idx on public.match_views (player_id, status);

alter table public.matches enable row level security;
alter table public.match_views enable row level security;

-- O Supabase concede tudo por padrão nas tabelas novas; fechamos ao mínimo.
revoke all on public.matches, public.match_views from anon, authenticated;
grant select on public.match_views to authenticated;
create policy "cada um lê a própria visão da partida" on public.match_views
  for select to authenticated using (player_id = auth.uid());
-- Sem nenhuma policy em matches: só a chave de serviço (que ignora a RLS) lê e escreve.

-- Fotos: o jogador vê as fotos das cartas do adversário que já foram jogadas em campo (decisão do projeto:
-- fotos são visíveis para os outros). Cartas ainda na mão ou no monte dele não entram na lista.
create policy "fotos reveladas numa partida" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'card-photos'
    and exists (
      select 1 from public.match_views v
      where v.player_id = auth.uid() and name = any (v.photo_paths)
    )
  );

-- Tempo real: o app escuta mudanças na própria visão. Só roda se a publicação existir (no Supabase existe).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.match_views;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Funções do servidor (só a chave de serviço executa). A lógica do jogo fica no motor (TypeScript);
-- aqui só persistência atômica e as travas que precisam do banco.
-- ---------------------------------------------------------------------------------------------

-- Grava as visões. `p_views` = [{ player_id, seat, status, view, photo_paths }, ...]. Uso interno.
create function public.match_write_views(p_match uuid, p_version int, p_views jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into match_views (match_id, player_id, seat, version, status, view, photo_paths, updated_at)
  select p_match, (v ->> 'player_id')::uuid, (v ->> 'seat')::int, p_version, v ->> 'status', v -> 'view',
         coalesce(array(select jsonb_array_elements_text(v -> 'photo_paths')), '{}'), now()
  from jsonb_array_elements(p_views) as v
  on conflict (match_id, player_id) do update
    set version = excluded.version, status = excluded.status, view = excluded.view,
        photo_paths = excluded.photo_paths, updated_at = excluded.updated_at;
$$;

-- Baralho salvo + nome + cartas de foto do jogador (só as que ele possui). Os ids das cartas fixas o servidor
-- resolve pelo motor. Devolve card_ids = null se o jogador não salvou baralho.
create function public.match_load_deck(p_user uuid, p_deck_name text default 'Meu baralho')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ids text[];
begin
  select card_ids into v_ids from decks where owner_id = p_user and name = p_deck_name;
  return jsonb_build_object(
    'display_name', (select display_name from profiles where id = p_user),
    'card_ids', to_jsonb(v_ids),
    'photo_cards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'element', c.element, 'rarity', c.rarity,
        'attack', c.attack, 'health', c.health, 'photo_path', c.photo_path))
      from cards c
      where c.owner_id = p_user and c.id::text = any (coalesce(v_ids, '{}'))
    ), '[]'::jsonb)
  );
end;
$$;

-- Cancela os convites abertos de um jogador (ele vai criar outro ou entrar em outra partida).
create function public.match_cancel_waiting(p_host uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    update matches set status = 'finished', end_cause = 'cancelled', turn_deadline = null, updated_at = now()
    where host_id = p_host and status = 'waiting'
    returning id
  loop
    update match_views set status = 'finished', updated_at = now() where match_id = v_id;
  end loop;
end;
$$;

-- Cria o convite. Um jogador não cria partida enquanto está numa em andamento; convite antigo dele é cancelado.
create function public.match_create(
  p_match uuid, p_host uuid, p_code text, p_deck jsonb, p_photos jsonb, p_views jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_host::text, 1));
  if exists (select 1 from matches where status = 'active' and (host_id = p_host or guest_id = p_host)) then
    raise exception 'already_in_match' using errcode = 'P0001';
  end if;
  perform match_cancel_waiting(p_host);
  insert into matches (id, code, host_id, host_deck, card_photos) values (p_match, p_code, p_host, p_deck, p_photos);
  perform match_write_views(p_match, 0, p_views);
end;
$$;

-- Convite aberto (e ainda dentro da validade) com este código.
create function public.match_by_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', m.id, 'host_id', m.host_id, 'host_deck', m.host_deck, 'card_photos', m.card_photos,
    'host_name', (select display_name from profiles where id = m.host_id))
  from matches m
  where m.code = p_code and m.status = 'waiting'
    and m.created_at > now() - make_interval(mins => (select value from app_config where key = 'invite_minutes'));
$$;

-- Partida completa (com o estado), para o servidor.
create function public.match_get(p_match uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(m)
    || jsonb_build_object(
      'host_name', (select display_name from profiles where id = m.host_id),
      'guest_name', (select display_name from profiles where id = m.guest_id))
  from matches m where m.id = p_match;
$$;

-- Parâmetros de tempo, lidos de app_config (que o cliente não enxerga).
create function public.match_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'turn_seconds', (select value from app_config where key = 'turn_seconds'),
    'max_missed_turns', (select value from app_config where key = 'max_missed_turns'),
    'abandon_seconds', (select value from app_config where key = 'abandon_seconds'));
$$;

-- Partida em aberto (esperando ou em andamento) do jogador, a mais recente; null se não há.
create function public.match_current(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from matches
  where status <> 'finished' and (host_id = p_user or guest_id = p_user)
  order by created_at desc limit 1;
$$;

-- Quem entra com o código: o servidor já montou o estado inicial (baralho validado, semente sorteada).
create function public.match_join(
  p_match uuid, p_guest uuid, p_state jsonb, p_events jsonb, p_deadline timestamptz, p_views jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_guest::text, 1));
  select host_id into v_host from matches where id = p_match and status = 'waiting' for update;
  if not found then
    raise exception 'match_not_waiting' using errcode = 'P0001';
  end if;
  if v_host = p_guest then
    raise exception 'own_match' using errcode = 'P0001';
  end if;
  if exists (select 1 from matches where status = 'active' and (host_id = p_guest or guest_id = p_guest)) then
    raise exception 'already_in_match' using errcode = 'P0001';
  end if;
  perform match_cancel_waiting(p_guest);
  update matches
    set guest_id = p_guest, status = 'active', state = p_state, events = p_events, version = 1,
        turn_deadline = p_deadline, missed_turns = '{0,0}', updated_at = now()
    where id = p_match;
  perform match_write_views(p_match, 1, p_views);
end;
$$;

-- Aplica o resultado de uma ação. `p_expected` é a versão que o servidor leu: se outra ação passou na frente,
-- recusa com stale_state (o servidor responde 409 e o app mostra o estado novo).
create function public.match_apply(
  p_match uuid, p_expected int, p_state jsonb, p_new_events jsonb, p_status text, p_cause text,
  p_deadline timestamptz, p_missed int[], p_views jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_version int;
begin
  select status, version into v_status, v_version from matches where id = p_match for update;
  if not found then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;
  if v_status <> 'active' then
    raise exception 'match_not_active' using errcode = 'P0001';
  end if;
  if v_version <> p_expected then
    raise exception 'stale_state' using errcode = 'P0001';
  end if;
  update matches
    set state = p_state, events = events || p_new_events, version = v_version + 1, status = p_status,
        end_cause = p_cause, turn_deadline = case when p_status = 'finished' then null else p_deadline end,
        missed_turns = p_missed, updated_at = now()
    where id = p_match;
  perform match_write_views(p_match, v_version + 1, p_views);
  return v_version + 1;
end;
$$;

-- Funções criadas em `public` ficam expostas à API por padrão; trancamos para só o servidor chamar.
revoke all on function public.match_write_views(uuid, int, jsonb) from public, anon, authenticated;
revoke all on function public.match_load_deck(uuid, text) from public, anon, authenticated;
revoke all on function public.match_cancel_waiting(uuid) from public, anon, authenticated;
revoke all on function public.match_create(uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.match_by_code(text) from public, anon, authenticated;
revoke all on function public.match_get(uuid) from public, anon, authenticated;
revoke all on function public.match_config() from public, anon, authenticated;
revoke all on function public.match_current(uuid) from public, anon, authenticated;
revoke all on function public.match_join(uuid, uuid, jsonb, jsonb, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.match_apply(uuid, int, jsonb, jsonb, text, text, timestamptz, int[], jsonb)
  from public, anon, authenticated;
grant execute on function public.match_load_deck(uuid, text) to service_role;
grant execute on function public.match_create(uuid, uuid, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.match_by_code(text) to service_role;
grant execute on function public.match_get(uuid) to service_role;
grant execute on function public.match_config() to service_role;
grant execute on function public.match_current(uuid) to service_role;
grant execute on function public.match_join(uuid, uuid, jsonb, jsonb, timestamptz, jsonb) to service_role;
grant execute on function public.match_apply(uuid, int, jsonb, jsonb, text, text, timestamptz, int[], jsonb)
  to service_role;
grant execute on function public.match_cancel_waiting(uuid) to service_role;
-- match_write_views é interna: nem a chave de serviço precisa chamá-la direto.
