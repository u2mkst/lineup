-- 감독만 보는 비밀 능력치. players 테이블(팀원 모두 읽음)과 분리해서, 관리자 외에는 읽지도 쓰지도 못하게 한다.
create table public.player_ratings (
  player_id text primary key references public.players (id) on delete cascade,
  shooting smallint not null default 5 check (shooting between 1 and 10),
  passing smallint not null default 5 check (passing between 1 and 10),
  dribbling smallint not null default 5 check (dribbling between 1 and 10),
  defending smallint not null default 5 check (defending between 1 and 10),
  pace smallint not null default 5 check (pace between 1 and 10),
  stamina smallint not null default 5 check (stamina between 1 and 10),
  physical smallint not null default 5 check (physical between 1 and 10),
  keeper smallint not null default 5 check (keeper between 1 and 10),
  memo text check (memo is null or char_length(memo) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.player_ratings enable row level security;

create policy "admins read ratings" on public.player_ratings
  for select to authenticated using (public.is_admin());
create policy "admins add ratings" on public.player_ratings
  for insert to authenticated with check (public.is_admin());
create policy "admins edit ratings" on public.player_ratings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete ratings" on public.player_ratings
  for delete to authenticated using (public.is_admin());

revoke all on public.player_ratings from anon;
