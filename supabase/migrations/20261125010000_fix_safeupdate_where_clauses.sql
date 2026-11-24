-- Supabase 는 WHERE 없는 UPDATE/DELETE 를 막아요(safeupdate). claim_admin / regenerate_join_code 가 그 규칙에 걸려
-- "UPDATE requires a WHERE clause" 로 실패했어요. 단일 행 테이블이라 `where singleton` 을 붙여요.
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
  update public.team_secret set admin_code = null where singleton;
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
  update public.team_secret set join_code = c where singleton;
  return c;
end;
$$;
