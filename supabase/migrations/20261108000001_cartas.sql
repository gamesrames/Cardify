-- Fase 2: cartas geradas a partir de fotos.
-- Regra de ouro: o cliente só LÊ as próprias cartas. Quem escreve é a Edge
-- Function `create-card`, com a chave de serviço, chamando insert_card().

create table public.categories (
  slug text primary key,
  nome text not null,
  element text not null check (element in ('fogo', 'planta', 'terra', 'ar', 'agua')),
  -- bônus em % do orçamento de poder da raridade; teto de 10 (decisão do usuário)
  bonus_pct int not null default 0 check (bonus_pct between 0 and 10),
  ativa boolean not null default true
);

-- Parâmetros ajustáveis sem redeploy.
create table public.app_config (
  key text primary key,
  value int not null
);
insert into public.app_config (key, value) values
  ('daily_photo_limit', 14),    -- 14 nos testes, 3 no jogo final
  ('duplicate_max_distance', 10); -- bits de diferença (de 64) até a foto ser "a mesma"

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  photo_path text not null,
  photo_hash bit(64) not null,
  category text not null references public.categories (slug),
  element text not null check (element in ('fogo', 'planta', 'terra', 'ar', 'agua')),
  rarity text not null check (rarity in ('comum', 'incomum', 'rara', 'epica', 'lendaria')),
  attack int not null check (attack >= 1),
  health int not null check (health >= 1),
  seed bigint not null,
  bonus_points int not null default 0 check (bonus_points >= 0),
  created_at timestamptz not null default now()
);
create index cards_owner_created_idx on public.cards (owner_id, created_at);

alter table public.categories enable row level security;
alter table public.app_config enable row level security;
alter table public.cards enable row level security;

create policy "categorias visíveis a quem está logado" on public.categories
  for select to authenticated using (ativa);
create policy "cada um lê as próprias cartas" on public.cards
  for select to authenticated using (owner_id = auth.uid());
-- Sem policy de insert/update/delete: o cliente não escreve em cards.
-- app_config não tem policy nenhuma: só o servidor lê.

-- Confere cota diária e duplicata. "Dia" = dia em São Paulo (a cota zera à meia-noite daqui).
create function public.photo_check(p_user uuid, p_hash bit(64))
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int := (select value from app_config where key = 'daily_photo_limit');
  v_dist int := (select value from app_config where key = 'duplicate_max_distance');
  v_today_start timestamptz :=
    date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  if (select count(*) from cards where owner_id = p_user and created_at >= v_today_start) >= v_limit then
    return 'quota_exceeded';
  end if;
  -- `#` é o XOR de bits; bit_count conta quantos bits diferem (distância de Hamming).
  if exists (select 1 from cards where bit_count(photo_hash # p_hash) <= v_dist) then
    return 'duplicate';
  end if;
  return 'ok';
end;
$$;

-- Insere a carta de forma atômica: o lock por usuário impede que duas fotos
-- simultâneas passem juntas pela cota.
create function public.insert_card(
  p_id uuid, p_owner uuid, p_photo_path text, p_photo_hash bit(64), p_name text,
  p_category text, p_element text, p_rarity text, p_attack int, p_health int,
  p_seed bigint, p_bonus_points int
)
returns public.cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_row public.cards;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));
  v_status := public.photo_check(p_owner, p_hash => p_photo_hash);
  if v_status <> 'ok' then
    raise exception '%', v_status using errcode = 'P0001';
  end if;
  insert into cards (id, owner_id, name, photo_path, photo_hash, category, element, rarity,
                     attack, health, seed, bonus_points)
  values (p_id, p_owner, p_name, p_photo_path, p_photo_hash, p_category, p_element, p_rarity,
          p_attack, p_health, p_seed, p_bonus_points)
  returning * into v_row;
  return v_row;
end;
$$;

-- Funções criadas em `public` ficam expostas à API por padrão; trancamos para só o servidor chamar.
revoke all on function public.photo_check(uuid, bit) from public, anon, authenticated;
revoke all on function public.insert_card(uuid, uuid, text, bit, text, text, text, text, int, int, bigint, int)
  from public, anon, authenticated;
grant execute on function public.photo_check(uuid, bit) to service_role;
grant execute on function public.insert_card(uuid, uuid, text, bit, text, text, text, text, int, int, bigint, int)
  to service_role;

-- Categorias iniciais (ajustáveis por UPDATE; o bônus real é arredondado para baixo em pontos de poder).
insert into public.categories (slug, nome, element, bonus_pct) values
  ('formiga',   'Formiga',    'terra',  0),
  ('inseto',    'Inseto',     'ar',     0),
  ('passaro',   'Pássaro',    'ar',     4),
  ('galinha',   'Galinha',    'terra',  5),
  ('gato',      'Gato',       'fogo',   4),
  ('cachorro',  'Cachorro',   'terra',  5),
  ('cavalo',    'Cavalo',     'terra',  8),
  ('vaca',      'Vaca',       'planta', 7),
  ('peixe',     'Peixe',      'agua',   3),
  ('reptil',    'Réptil',     'fogo',   5),
  ('animal',    'Animal',     'terra',  3),
  ('flor',      'Flor',       'planta', 1),
  ('arvore',    'Árvore',     'planta', 6),
  ('planta',    'Planta',     'planta', 2),
  ('fruta',     'Fruta',      'planta', 0),
  ('comida',    'Comida',     'fogo',   0),
  ('agua',      'Água',       'agua',   3),
  ('ceu',       'Céu',        'ar',     3),
  ('fogo',      'Fogo',       'fogo',   6),
  ('pedra',     'Pedra',      'terra',  4),
  ('veiculo',   'Veículo',    'fogo',   5),
  ('construcao','Construção', 'terra',  4),
  ('pessoa',    'Pessoa',     'fogo',   0),
  ('objeto',    'Objeto',     'ar',     0),
  ('outro',     'Misterioso', 'ar',     0);
