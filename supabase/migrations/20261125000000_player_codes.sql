-- 선수마다 개인 가입 코드. 코드를 입력하고 아이디·비밀번호를 정하면 그 선수 계정으로 바로 들어와요.
-- 계정 생성은 Edge Function(claim-player)이 service role 로 처리하고, 이 테이블은 관리자만 읽을 수 있어요.
create table public.player_codes (
  player_id text primary key references public.players (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  -- 가입 완료 후의 아이디 (로그인 이메일은 아이디@도메인 으로 만들어져요)
  username text,
  claimed_by uuid references auth.users (id) on delete set null,
  -- 코드를 쓴 시각. 비어 있을 때만 쓸 수 있어요. 재발급하면 다시 비워져요
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.player_codes enable row level security;

create policy "admins read player codes" on public.player_codes
  for select to authenticated using (public.is_admin());
revoke all on public.player_codes from anon;

-- 헷갈리는 글자(I, L, O, 0, 1)를 뺀 8자리 코드
create or replace function public.new_player_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text;
  bytes bytea;
  tries int := 0;
begin
  loop
    bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    result := '';
    for i in 0..7 loop
      result := result || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.player_codes where code = result);
    tries := tries + 1;
    if tries > 20 then raise exception 'could not generate a code'; end if;
  end loop;
  return result;
end;
$$;
revoke execute on function public.new_player_code() from public, anon, authenticated;

-- 선수를 추가하면 코드도 자동으로 만들어져요
create or replace function public.player_code_for_new_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.player_codes (player_id, code) values (new.id, public.new_player_code());
  return new;
end;
$$;
revoke execute on function public.player_code_for_new_player() from public, anon, authenticated;

create trigger players_new_code
  after insert on public.players
  for each row execute function public.player_code_for_new_player();

-- 이미 있는 선수들
insert into public.player_codes (player_id, code)
select id, public.new_player_code() from public.players
on conflict (player_id) do nothing;

-- 관리자: 새 코드 발급. 아직 가입 전이면 코드만 바뀌고, 이미 가입한 선수라면 비밀번호 재설정용 코드가 돼요
create or replace function public.reissue_player_code(pid text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.players where id = pid) then
    raise exception 'no such player' using errcode = 'P0002';
  end if;
  c := public.new_player_code();
  insert into public.player_codes (player_id, code) values (pid, c)
  on conflict (player_id) do update set code = excluded.code, used_at = null
  returning code into c;
  return c;
end;
$$;
revoke execute on function public.reissue_player_code(text) from public, anon;
grant execute on function public.reissue_player_code(text) to authenticated;
