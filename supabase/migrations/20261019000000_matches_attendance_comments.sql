-- 경기 일정, 참석 투표, 공개 전술 댓글, 선수 겸임 포지션/부상.
-- 이미 프로젝트(qommbqaanutaigklxcrp)에 적용되어 있음. (init 마이그레이션 다음에 실행)

-- ===== 선수: 겸임 포지션, 부상/출전 불가 =====
alter table public.players
  add column alt_pos text[] not null default '{}',
  add column injured boolean not null default false,
  add column injury_note text;
alter table public.players
  add constraint players_alt_pos_valid check (alt_pos <@ array['GK', 'DF', 'MF', 'FW']::text[]),
  add constraint players_injury_note_len check (injury_note is null or char_length(injury_note) <= 20);

-- ===== 경기 (모두 읽기, 관리자만 쓰기) =====
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 40),
  opponent text check (opponent is null or char_length(opponent) <= 30),
  kickoff timestamptz not null,
  venue text check (venue is null or char_length(venue) <= 60),
  notes text check (notes is null or char_length(notes) <= 300),
  tactic_id uuid references public.tactics (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matches_kickoff_idx on public.matches (kickoff desc);
create index matches_tactic_idx on public.matches (tactic_id);
create index matches_created_by_idx on public.matches (created_by);
alter table public.matches enable row level security;

create policy "matches are public" on public.matches
  for select to anon, authenticated using (true);
create policy "admins add matches" on public.matches
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins edit matches" on public.matches
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins remove matches" on public.matches
  for delete to authenticated using ((select public.is_admin()));
create trigger matches_touch before update on public.matches
  for each row execute function public.touch_updated_at();

-- ===== 참석 투표 (로그인 없이 가능, 킥오프 하루 뒤까지) =====
create table public.attendance (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  status text not null check (status in ('yes', 'no', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index attendance_player_idx on public.attendance (player_id);
alter table public.attendance enable row level security;

create policy "attendance is public" on public.attendance
  for select to anon, authenticated using (true);
create policy "anyone can vote while the match is open" on public.attendance
  for insert to anon, authenticated
  with check (exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now() - interval '1 day'));
create policy "anyone can change a vote while the match is open" on public.attendance
  for update to anon, authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now() - interval '1 day'))
  with check (exists (select 1 from public.matches m where m.id = match_id and m.kickoff > now() - interval '1 day'));
create policy "admins clear votes" on public.attendance
  for delete to authenticated using ((select public.is_admin()));
create trigger attendance_touch before update on public.attendance
  for each row execute function public.touch_updated_at();

-- ===== 공개 전술의 댓글 / "확인했어요" =====
create table public.tactic_comments (
  id uuid primary key default gen_random_uuid(),
  tactic_id uuid not null references public.tactics (id) on delete cascade,
  player_id text references public.players (id) on delete set null,
  author text check (author is null or char_length(author) <= 20),
  kind text not null default 'comment' check (kind in ('comment', 'ack')),
  body text not null default '' check (char_length(body) <= 200),
  created_at timestamptz not null default now(),
  constraint comment_has_body check (kind = 'ack' or char_length(body) >= 1)
);
create unique index tactic_ack_once on public.tactic_comments (tactic_id, player_id) where kind = 'ack' and player_id is not null;
create index tactic_comments_idx on public.tactic_comments (tactic_id, created_at);
create index tactic_comments_player_idx on public.tactic_comments (player_id);
alter table public.tactic_comments enable row level security;

create policy "read comments of visible tactics" on public.tactic_comments
  for select to anon, authenticated
  using (exists (select 1 from public.tactics t where t.id = tactic_id and (t.is_public or t.owner_id = (select auth.uid()))));
create policy "comment on public tactics" on public.tactic_comments
  for insert to anon, authenticated
  with check (exists (select 1 from public.tactics t where t.id = tactic_id and t.is_public));
-- 로그인 안 한 사람은 "확인했어요"만 취소 가능, 관리자는 모든 댓글 삭제 가능 (역할별로 나눠 정책이 겹치지 않게 함)
create policy "take back a confirmation" on public.tactic_comments
  for delete to anon using (kind = 'ack');
create policy "admins delete comments" on public.tactic_comments
  for delete to authenticated using (kind = 'ack' or (select public.is_admin()));
