-- 로그인 없이 볼 수 있는 공개 페이지(/info)용 데이터.
-- 테이블을 열지 않고, 공개해도 되는 필드만 골라 돌려주는 함수 하나만 anon 에게 열어요.
-- 공개: 팀 이름, 올해 전적(경기·승무패·득실점), 최근 경기 결과(스코어·상대·날짜·장소), 다가오는 경기(날짜·상대·장소)
-- 비공개: 선수 이름·기록, 참석 투표, 전술, 팀원, 게시판, 능력치, 메모
alter table public.team add column public_page boolean not null default true;

create or replace function public.public_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t record;
  this_year int := extract(year from (now() at time zone 'Asia/Seoul'))::int;
  yr int;
  rec jsonb;
  res jsonb;
  nxt jsonb;
begin
  select name, public_page into t from public.team where singleton;
  if not found or not t.public_page then
    return jsonb_build_object('enabled', false, 'name', coalesce(t.name, ''));
  end if;

  -- 올해 끝난 경기가 있으면 올해, 없으면 가장 최근 시즌
  yr := coalesce(
    (select this_year where exists (
       select 1 from public.matches
       where kind = 'match' and status = 'finished' and our_score is not null and opp_score is not null
         and extract(year from (kickoff at time zone 'Asia/Seoul')) = this_year)),
    (select max(extract(year from (kickoff at time zone 'Asia/Seoul')))::int from public.matches
       where kind = 'match' and status = 'finished' and our_score is not null and opp_score is not null),
    this_year);

  select jsonb_build_object(
    'year', yr,
    'games', count(*),
    'wins', count(*) filter (where our_score > opp_score),
    'draws', count(*) filter (where our_score = opp_score),
    'losses', count(*) filter (where our_score < opp_score),
    'goalsFor', coalesce(sum(our_score), 0),
    'goalsAgainst', coalesce(sum(opp_score), 0))
  into rec
  from public.matches
  where kind = 'match' and status = 'finished' and our_score is not null and opp_score is not null
    and extract(year from (kickoff at time zone 'Asia/Seoul')) = yr;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.kickoff desc), '[]'::jsonb) into res from (
    select kickoff, coalesce(nullif(opponent, ''), title) as opponent, venue, our_score as "ourScore", opp_score as "oppScore"
    from public.matches
    where kind = 'match' and status = 'finished' and our_score is not null and opp_score is not null
    order by kickoff desc limit 10) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.kickoff asc), '[]'::jsonb) into nxt from (
    select kickoff, coalesce(nullif(opponent, ''), title) as opponent, venue
    from public.matches
    where kind = 'match' and status = 'scheduled' and kickoff >= now()
    order by kickoff asc limit 3) x;

  return jsonb_build_object('enabled', true, 'name', t.name, 'record', rec, 'results', res, 'upcoming', nxt);
end;
$$;

revoke execute on function public.public_overview() from public;
grant execute on function public.public_overview() to anon, authenticated;
