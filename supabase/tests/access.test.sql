-- Behavioural tests for 20261023000000_access.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('50000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('50000000-0000-0000-0000-000000000001', 'member@test'),
  ('50000000-0000-0000-0000-000000000002', 'new@test'),
  ('50000000-0000-0000-0000-000000000003', 'other@test');
insert into public.user_roles (user_id, role) values ('50000000-0000-0000-0000-00000000000d', 'moderator');
insert into public.members (user_id) values ('50000000-0000-0000-0000-000000000001');
update public.profiles set username = 'member' where id = '50000000-0000-0000-0000-000000000001';

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

-- A member's photo, approved, so it shows in feeds and rankings.
select public.today_challenge();
update public.challenges set opens_at = now() - interval '1 hour' where day = public.challenge_day();
insert into public.posts (user_id, challenge_id, image_path, points, review)
select '50000000-0000-0000-0000-000000000001', id, '50000000-0000-0000-0000-000000000001/' || id || '-a.jpg', 80, 'approved'
from public.challenges where day = public.challenge_day();
insert into t select 'challenge', id::text from public.challenges where day = public.challenge_day();
insert into t select 'post', id::text from public.posts;

-- 1. Without a code you see nothing and can do nothing.
select pg_temp.act_as('50000000-0000-0000-0000-000000000002');
do $$ begin
  if public.has_access() then raise exception 'new account has access'; end if;
  if exists (select 1 from public.posts) then raise exception 'locked account reads posts'; end if;
  if exists (select 1 from public.challenge_feed((select v::uuid from t where k = 'challenge'))) then raise exception 'locked account sees the feed'; end if;
  if exists (select 1 from public.monthly_ranking()) then raise exception 'locked account sees the ranking'; end if;
  if exists (select 1 from public.user_stats('50000000-0000-0000-0000-000000000001')) then raise exception 'locked account sees profiles'; end if;
  if not exists (select 1 from public.user_stats('50000000-0000-0000-0000-000000000002')) then raise exception 'locked account cannot see itself'; end if;
  begin
    insert into public.follows (followed_id) values ('50000000-0000-0000-0000-000000000001');
    raise exception 'locked account followed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.post_likes (post_id) values ((select v::uuid from t where k = 'post'));
    raise exception 'locked account liked';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.members (user_id) values ('50000000-0000-0000-0000-000000000002');
    raise exception 'unlocked myself without a code';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_codes(5);
    raise exception 'non-staff made codes';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.garment_codes) then raise exception 'non-staff reads codes'; end if;
end $$;
reset role;

-- 2. Staff make codes (in the app or from the SQL Editor, which runs as the owner).
select pg_temp.act_as('50000000-0000-0000-0000-00000000000d');
insert into t select 'code' || row_number() over (), code from public.create_codes(3, 'drop 001 tees');
do $$ begin
  if (select count(*) from t where k like 'code%') <> 3 then raise exception 'expected 3 codes'; end if;
  if exists (select 1 from t where k like 'code%' and v !~ '^UPZ-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$') then raise exception 'bad code format'; end if;
  if (select count(*) from public.garment_codes) <> 3 then raise exception 'staff cannot read codes'; end if;
  if not public.has_access() then raise exception 'staff should get in without a code'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.create_codes(2)) <> 2 then raise exception 'owner session cannot make codes'; end if;
  if (select count(*) from public.audit_log where action = 'codes.create') <> 2 then raise exception 'codes not audited'; end if;
end $$;

-- 3. Redeem: wrong codes are recorded, the right one unlocks, typed any way.
select pg_temp.act_as('50000000-0000-0000-0000-000000000002');
do $$
declare code text := (select v from t where k = 'code1');
begin
  if public.redeem_code('UPZ-AAAAA-AAAAA') <> 'unknown' then raise exception 'made-up code accepted'; end if;
  if public.redeem_code(lower(replace(code, '-', ' '))) <> 'ok' then raise exception 'real code refused'; end if;
  if not public.has_access() then raise exception 'code did not unlock'; end if;
  if (select count(*) from public.posts) <> 1 then raise exception 'unlocked account cannot see photos'; end if;
  insert into public.follows (followed_id) values ('50000000-0000-0000-0000-000000000001');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.code_attempts where user_id = '50000000-0000-0000-0000-000000000002') <> 1 then raise exception 'wrong try not recorded'; end if;
  if (select redeemed_by from public.garment_codes where redeemed_at is not null) <> '50000000-0000-0000-0000-000000000002' then raise exception 'code not marked used'; end if;
  if not exists (select 1 from public.audit_log where action = 'codes.redeem') then raise exception 'redeem not audited'; end if;
end $$;

-- 4. One use per code; ten wrong tries an hour, then wait.
select pg_temp.act_as('50000000-0000-0000-0000-000000000003');
do $$ begin
  if public.redeem_code((select v from t where k = 'code1')) <> 'used' then raise exception 'used code accepted twice'; end if;
  if public.has_access() then raise exception 'used code unlocked a second account'; end if;
  for i in 1..9 loop
    perform public.redeem_code('UPZ-BBBBB-BBBB' || i);
  end loop;
  if public.redeem_code((select v from t where k = 'code2')) <> 'wait' then raise exception 'guessing not limited'; end if;
end $$;
reset role;

\echo access: all tests passed
