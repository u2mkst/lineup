-- 우리 팀 전용 모드: 구단·멤버·합류코드, 멤버만 읽기, 일정/경기 기록, 게시판.
-- 앞선 두 마이그레이션(init, matches_attendance_comments) 다음에 실행합니다.
-- 기존 정책은 DROP 하지 않고 ALTER POLICY 로 바꿉니다.

-- ===== 구단 / 멤버 =====
create table public.team (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  name text not null default '우리 팀' check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);
alter table public.team enable row level security;

-- 합류코드와 최초 관리자 코드는 관리자만 읽음
create table public.team_secret (
  singleton boolean primary key default true check (singleton),
  join_code text not null unique,
  /** 최초 관리자가 없을 때만 한 번 쓰이고 사라지는 코드 */
  admin_code text unique
);
alter table public.team_secret enable row level security;

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'player' check (role in ('admin', 'player')),
  player_id text unique references public.players (id) on delete set null,
  nickname text check (nickname is null or char_length(nickname) <= 20),
  joined_at timestamptz not null default now()
);
alter table public.members enable row level security;

-- RLS 안에서 members 를 읽으므로 SECURITY DEFINER (재귀 방지)
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where user_id = (select auth.uid()) and role = 'admin');
$$;

create or replace function public.my_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select player_id from public.members where user_id = (select auth.uid());
$$;

revoke execute on function public.is_member() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_player_id() from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_player_id() to authenticated;

create policy "members read the team" on public.team
  for select to authenticated using ((select public.is_member()));
create policy "admins rename the team" on public.team
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admins read team secrets" on public.team_secret
  for select to authenticated using ((select public.is_admin()));

create policy "members see each other" on public.members
  for select to authenticated using ((select public.is_member()));
create policy "admins manage members" on public.members
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins remove members or leave" on public.members
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 마지막 관리자는 내려가거나 나갈 수 없음
create or replace function public.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  demoting boolean;
begin
  if old.role = 'admin' then
    -- NEW does not exist in a DELETE trigger, so never read it there
    if tg_op = 'DELETE' then demoting := true; else demoting := (new.role <> 'admin'); end if;
    if demoting and not exists (select 1 from public.members where role = 'admin' and user_id <> old.user_id) then
      raise exception 'last admin' using errcode = '23514';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke execute on function public.keep_one_admin() from public, anon, authenticated;
create trigger members_keep_one_admin before update or delete on public.members
  for each row execute function public.keep_one_admin();

-- 합류: 코드가 맞으면 선수(player)로 등록. 틀리면 1초 지연(무차별 대입 방지)
create or replace function public.join_team(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  r text;
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  select role into r from public.members where user_id = uid;
  if r is not null then return r; end if;
  if not exists (select 1 from public.team_secret where join_code = upper(trim(code))) then
    perform pg_sleep(1);
    raise exception 'wrong code' using errcode = '28P01';
  end if;
  insert into public.members (user_id, role) values (uid, 'player');
  return 'player';
end;
$$;

-- 최초 관리자: 관리자가 한 명도 없을 때만 쓸 수 있는 1회용 코드
create or replace function public.claim_admin(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if exists (select 1 from public.members where role = 'admin')
     or not exists (select 1 from public.team_secret where admin_code is not null and admin_code = upper(trim(code))) then
    perform pg_sleep(1);
    raise exception 'wrong code' using errcode = '28P01';
  end if;
  insert into public.members (user_id, role) values (uid, 'admin')
    on conflict (user_id) do update set role = 'admin';
  update public.team_secret set admin_code = null;
  return 'admin';
end;
$$;

create or replace function public.regenerate_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.team_secret set join_code = c;
  return c;
end;
$$;

-- 내 계정에 선수 프로필 연결 (아직 연결 안 했고, 그 선수가 비어 있을 때만)
create or replace function public.link_my_player(pid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
begin
  if not public.is_member() then raise exception 'members only' using errcode = '42501'; end if;
  if exists (select 1 from public.members where user_id = uid and player_id is not null) then
    raise exception 'already linked' using errcode = '23505';
  end if;
  if not exists (select 1 from public.players where id = pid) then
    raise exception 'player not found' using errcode = 'P0002';
  end if;
  update public.members set player_id = pid where user_id = uid;
exception when unique_violation then
  raise exception 'player taken' using errcode = '23505';
end;
$$;

create or replace function public.set_nickname(n text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.members set nickname = nullif(left(trim(n), 20), '') where user_id = (select auth.uid());
$$;

revoke execute on function public.join_team(text), public.claim_admin(text), public.regenerate_join_code(),
  public.link_my_player(text), public.set_nickname(text) from public, anon;
grant execute on function public.join_team(text), public.claim_admin(text), public.regenerate_join_code(),
  public.link_my_player(text), public.set_nickname(text) to authenticated;

-- 가입만으로는 더 이상 관리자가 되지 않음
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  return new;
end;
$$;

-- ===== 기존 관리자 이전 + 초기 구단 =====
insert into public.members (user_id, role)
  select user_id, 'admin' from public.admins
  on conflict (user_id) do nothing;
insert into public.team (singleton) values (true);
insert into public.team_secret (singleton, join_code, admin_code)
  values (
    true,
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    case when exists (select 1 from public.members where role = 'admin') then null
         else upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)) end
  );

-- ===== 선수단 =====
alter table public.players
  add column birth_year smallint check (birth_year is null or birth_year between 1940 and 2020);
alter policy "players are public" on public.players
  to authenticated using ((select public.is_member()));

-- ===== 일정 / 경기 기록 =====
alter table public.matches
  add column kind text not null default 'match' check (kind in ('match', 'social', 'practice', 'other')),
  add column status text not null default 'scheduled' check (status in ('scheduled', 'finished', 'cancelled')),
  add column our_score smallint check (our_score is null or our_score between 0 and 99),
  add column opp_score smallint check (opp_score is null or opp_score between 0 and 99),
  add column quarters jsonb not null default '[]'::jsonb
    check (jsonb_typeof(quarters) = 'array' and jsonb_array_length(quarters) <= 6),
  add column potm_player_id text references public.players (id) on delete set null,
  add column vote_deadline timestamptz;
create index matches_potm_idx on public.matches (potm_player_id);
alter policy "matches are public" on public.matches
  to authenticated using ((select public.is_member()));

create table public.match_stats (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  played boolean not null default true,
  goals smallint not null default 0 check (goals between 0 and 20),
  assists smallint not null default 0 check (assists between 0 and 20),
  primary key (match_id, player_id)
);
create index match_stats_player_idx on public.match_stats (player_id);
alter table public.match_stats enable row level security;
create policy "members read stats" on public.match_stats
  for select to authenticated using ((select public.is_member()));
create policy "admins add stats" on public.match_stats
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins edit stats" on public.match_stats
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins remove stats" on public.match_stats
  for delete to authenticated using ((select public.is_admin()));

-- ===== 참석 투표: 본인 것만(관리자는 누구든), 마감 전까지 =====
alter policy "attendance is public" on public.attendance
  to authenticated using ((select public.is_member()));
alter policy "anyone can vote while the match is open" on public.attendance
  to authenticated
  with check (
    (select public.is_admin())
    or ((select public.is_member()) and player_id = (select public.my_player_id())
        and exists (select 1 from public.matches m
                    where m.id = match_id and m.status = 'scheduled' and coalesce(m.vote_deadline, m.kickoff) > now()))
  );
alter policy "anyone can change a vote while the match is open" on public.attendance
  to authenticated
  using (
    (select public.is_admin())
    or ((select public.is_member()) and player_id = (select public.my_player_id())
        and exists (select 1 from public.matches m
                    where m.id = match_id and m.status = 'scheduled' and coalesce(m.vote_deadline, m.kickoff) > now()))
  )
  with check (
    (select public.is_admin())
    or ((select public.is_member()) and player_id = (select public.my_player_id())
        and exists (select 1 from public.matches m
                    where m.id = match_id and m.status = 'scheduled' and coalesce(m.vote_deadline, m.kickoff) > now()))
  );

-- ===== 전술: 관리자만 서버에 저장, 공개(is_public)는 "팀 공유" = 멤버에게만 보임 =====
alter policy "read own or public tactics" on public.tactics
  to authenticated
  using (owner_id = (select auth.uid()) or (is_public and (select public.is_member())));
alter policy "insert own tactics" on public.tactics
  with check (owner_id = (select auth.uid()) and (select public.is_admin()));
alter policy "update own tactics" on public.tactics
  using (owner_id = (select auth.uid()) and (select public.is_admin()))
  with check (owner_id = (select auth.uid()) and (select public.is_admin()));
alter policy "delete own tactics" on public.tactics
  using (owner_id = (select auth.uid()) and (select public.is_admin()));

alter policy "read comments of visible tactics" on public.tactic_comments
  to authenticated
  using ((select public.is_member())
         and exists (select 1 from public.tactics t where t.id = tactic_id and (t.is_public or t.owner_id = (select auth.uid()))));
alter policy "comment on public tactics" on public.tactic_comments
  to authenticated
  with check ((select public.is_member())
              and exists (select 1 from public.tactics t where t.id = tactic_id and t.is_public));
alter policy "anyone can take back a confirmation" on public.tactic_comments using (false);
alter policy "admins delete comments" on public.tactic_comments
  using ((kind = 'ack' and player_id is not distinct from (select public.my_player_id())) or (select public.is_admin()));

-- ===== 게시판 =====
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 20),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_feed_idx on public.posts (pinned desc, created_at desc);
create index posts_author_idx on public.posts (author_id);
alter table public.posts enable row level security;

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 20),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);
create index post_comments_author_idx on public.post_comments (author_id);
alter table public.post_comments enable row level security;

create policy "members read posts" on public.posts
  for select to authenticated using ((select public.is_member()));
create policy "members write posts" on public.posts
  for insert to authenticated
  with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy "authors and admins edit posts" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()))
  with check (author_id = (select auth.uid()) or (select public.is_admin()));
create policy "authors and admins delete posts" on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

create policy "members read comments" on public.post_comments
  for select to authenticated using ((select public.is_member()));
create policy "members write comments" on public.post_comments
  for insert to authenticated
  with check ((select public.is_member()) and author_id = (select auth.uid()));
create policy "authors and admins delete comments" on public.post_comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or (select public.is_admin()));

-- 공지 고정은 관리자만
create or replace function public.guard_pinned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.pinned := case when tg_op = 'UPDATE' then old.pinned else false end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function public.guard_pinned() from public, anon, authenticated;
create trigger posts_guard before insert or update on public.posts
  for each row execute function public.guard_pinned();
