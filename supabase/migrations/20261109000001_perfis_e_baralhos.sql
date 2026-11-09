-- Fase 3: contas e nuvem. Perfil de cada jogador e baralhos salvos no servidor.
-- Regra de ouro (igual à fase 2): cada jogador só enxerga e altera o que é dele.
-- O id do jogador é o id do login (auth.users). Quando um usuário anônimo cria uma conta,
-- o Supabase mantém o MESMO id, então cartas, perfil e baralho continuam dele sem migração.

-- Perfil: nome de exibição. Nasce sozinho junto com o login (trigger abaixo).
-- Na fase 4 uma policy nova deixará o adversário ler o nome durante a partida.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(btrim(display_name)) between 2 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Baralho: lista de ids de cartas (as fixas do motor têm id texto, as de foto têm uuid, por isso text[]).
-- O banco só guarda; quem decide se o baralho é LEGAL (7 cartas, teto de poder, cartas que o jogador
-- possui) é o motor, no servidor, ao iniciar a partida (fase 4). O limite de 20 abaixo é só higiene.
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  card_ids text[] not null default '{}' check (cardinality(card_ids) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

alter table public.profiles enable row level security;
alter table public.decks enable row level security;

-- O Supabase concede tudo a anon/authenticated por padrão nas tabelas novas; aqui fechamos ao mínimo.
revoke all on public.profiles, public.decks from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated; -- só o nome; id e datas não mudam
grant select, insert, update, delete on public.decks to authenticated;

create policy "cada um lê o próprio perfil" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "cada um edita o próprio perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Sem policy de insert/delete em profiles: o perfil é criado pelo trigger e some junto com o login.

create policy "cada um lê os próprios baralhos" on public.decks
  for select to authenticated using (owner_id = auth.uid());
create policy "cada um cria os próprios baralhos" on public.decks
  for insert to authenticated with check (owner_id = auth.uid());
create policy "cada um edita os próprios baralhos" on public.decks
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "cada um apaga os próprios baralhos" on public.decks
  for delete to authenticated using (owner_id = auth.uid());

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger decks_touch before update on public.decks
  for each row execute function public.touch_updated_at();

-- Todo login novo (anônimo ou não) ganha um perfil vazio.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem já existia antes desta migração (os logins anônimos da fase 2) também ganha perfil.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- Reforço das tabelas da fase 2: a RLS já impede escrita do cliente (não há policy de escrita),
-- e aqui tiramos também a permissão, para valer mesmo que alguém crie uma policy por engano.
revoke insert, update, delete, truncate on public.cards, public.categories from anon, authenticated;
revoke all on public.app_config from anon, authenticated;
revoke all on public.cards, public.categories from anon;
