-- 축구방 초기 스키마. 이미 프로젝트(qommbqaanutaigklxcrp)에 적용되어 있음.
-- 새 Supabase 프로젝트에 같은 구조를 만들 때 SQL Editor에서 그대로 실행하면 됩니다.

-- ===== 관리자 =====
-- 가입한 계정은 모두 관리자. (제한하려면 handle_new_user 트리거를 바꾸면 됨)
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admins (user_id, email) values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 선수 명단 (모두 읽기, 관리자만 쓰기) =====
create table public.players (
  id text primary key default gen_random_uuid()::text,
  number text not null check (char_length(number) between 1 and 3),
  name text not null check (char_length(name) between 1 and 8),
  pos text not null check (pos in ('GK', 'DF', 'MF', 'FW')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_number_key unique (number) deferrable initially immediate
);
alter table public.players enable row level security;

create policy "players are public" on public.players
  for select to anon, authenticated using (true);
create policy "admins add players" on public.players
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins edit players" on public.players
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins remove players" on public.players
  for delete to authenticated using ((select public.is_admin()));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger players_touch before update on public.players
  for each row execute function public.touch_updated_at();

-- 등번호 맞교체: 한 트랜잭션 안에서 유니크 검사를 미뤄서 서로 바꿈
create or replace function public.swap_player_numbers(a text, b text)
returns void
language plpgsql
set search_path = public
as $$
declare
  na text;
  nb text;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if a = b then
    raise exception 'pick two different players' using errcode = '22023';
  end if;
  select number into na from public.players where id = a for update;
  select number into nb from public.players where id = b for update;
  if na is null or nb is null then
    raise exception 'player not found' using errcode = 'P0002';
  end if;
  set constraints public.players_number_key deferred;
  update public.players set number = nb where id = a;
  update public.players set number = na where id = b;
end;
$$;
revoke execute on function public.swap_player_numbers(text, text) from public, anon;
grant execute on function public.swap_player_numbers(text, text) to authenticated;

-- ===== 전술 (내 것 + 팀 공개) =====
create table public.tactics (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  data jsonb not null check (pg_column_size(data) < 400000),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tactics_owner_idx on public.tactics (owner_id, updated_at desc);
create index tactics_public_idx on public.tactics (updated_at desc) where is_public;
alter table public.tactics enable row level security;

create policy "read own or public tactics" on public.tactics
  for select to anon, authenticated
  using (is_public or owner_id = (select auth.uid()));
create policy "insert own tactics" on public.tactics
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "update own tactics" on public.tactics
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "delete own tactics" on public.tactics
  for delete to authenticated using (owner_id = (select auth.uid()));

create trigger tactics_touch before update on public.tactics
  for each row execute function public.touch_updated_at();

-- ===== 기본 선수 명단 (앱의 기존 기본값과 같은 id) =====
insert into public.players (id, number, name, pos) values
  ('p14', '14', '박나로', 'GK'), ('p21', '21', '백은규', 'GK'), ('p23', '23', '김승환', 'GK'),
  ('p1', '1', '강예준', 'DF'), ('p3', '3', '김서준', 'DF'), ('p4', '4', '남찬영', 'DF'), ('p5', '5', '주윤재', 'DF'),
  ('p22', '22', '김서우', 'DF'), ('p26', '26', '조홍재', 'DF'), ('p27', '27', '이강윤', 'DF'),
  ('p2', '2', '윤지환', 'MF'), ('p6', '6', '이민찬', 'MF'), ('p8', '8', '김하민', 'MF'), ('p10', '10', '신유철', 'MF'),
  ('p12', '12', '전윤우', 'MF'), ('p17', '17', '이형우', 'MF'), ('p19', '19', '남관우', 'MF'),
  ('p7', '7', '김태완', 'FW'), ('p11', '11', '이유찬', 'FW'), ('p32', '32', '이서준', 'FW'), ('p80', '80', '김하준', 'FW'),
  ('p99', '99', '김규빈', 'FW');
