-- Behavioural tests for 20261024000000_push.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

-- Stand-in for Supabase's pg_net: remembers what would have been sent.
create schema net;
create table net.sent (body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as $$
  insert into net.sent values (body) returning 1::bigint;
$$;

insert into auth.users (id, email) values
  ('60000000-0000-0000-0000-000000000001', 'member@test'),
  ('60000000-0000-0000-0000-000000000002', 'locked@test'),
  ('60000000-0000-0000-0000-000000000003', 'other@test');
insert into public.members (user_id) values
  ('60000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003');
insert into public.user_consents (user_id, adult_at, content_rules_at) select id, now(), now() from auth.users on conflict do nothing;

-- 1. You save your own phone; bad tokens and other people's tokens are refused.
select pg_temp.act_as('60000000-0000-0000-0000-000000000001');
select public.save_push_token('ExponentPushToken[member-phone-1]', 'ios');
do $$ begin
  if (select count(*) from public.push_tokens) <> 1 then raise exception 'phone not saved'; end if;
  begin
    perform public.save_push_token('not a token', 'ios');
    raise exception 'saved a bad token';
  exception when check_violation then null;
  end;
  begin
    perform public.save_push_token('ExponentPushToken[member-phone-2]', 'windows');
    raise exception 'saved a bad platform';
  exception when check_violation then null;
  end;
  begin
    insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[forged-phone]', '60000000-0000-0000-0000-000000000003', 'ios');
    raise exception 'inserted a token directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 2. Locked accounts can save a phone but get no push; others cannot read it.
select pg_temp.act_as('60000000-0000-0000-0000-000000000002');
select public.save_push_token('ExponentPushToken[locked-phone]', 'android');
do $$ begin
  if (select count(*) from public.push_tokens) <> 1 then raise exception 'sees other people''s phones'; end if;
end $$;
reset role;
select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select public.save_push_token('ExponentPushToken[other-phone]', 'android');
reset role;

-- 3. A phone that changes account moves with it; only the last 5 phones stay.
select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select public.save_push_token('ExponentPushToken[member-phone-1]', 'ios');
reset role;
do $$ begin
  if (select user_id from public.push_tokens where token = 'ExponentPushToken[member-phone-1]') <> '60000000-0000-0000-0000-000000000003' then
    raise exception 'phone did not move to the new account';
  end if;
end $$;
select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select public.save_push_token('ExponentPushToken[old-phone-' || n || ']', 'ios') from generate_series(1, 5) n;
reset role;
do $$ begin
  if exists (select 1 from public.push_tokens where token = 'ExponentPushToken[other-phone]') then raise exception 'oldest phone was kept'; end if;
  if (select count(*) from public.push_tokens where user_id = '60000000-0000-0000-0000-000000000003') <> 5 then raise exception 'kept more than 5 phones'; end if;
end $$;
select pg_temp.act_as('60000000-0000-0000-0000-000000000003');
select public.remove_push_token('ExponentPushToken[old-phone-5]');
reset role;
do $$ begin
  if exists (select 1 from public.push_tokens where token = 'ExponentPushToken[old-phone-5]') then raise exception 'sign out kept the phone'; end if;
end $$;

-- 4. The app cannot trigger the push.
select pg_temp.act_as('60000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    perform public.send_drop_push();
    raise exception 'member triggered the push';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 5. Nothing goes out before the drop.
select public.today_challenge();
update public.challenges set opens_at = now() + interval '1 hour' where day = public.challenge_day();
do $$ begin
  if public.send_drop_push() <> 0 then raise exception 'pushed before the drop'; end if;
  if exists (select 1 from net.sent) then raise exception 'sent before the drop'; end if;
end $$;

-- 6. At the drop: one push to members' phones only, exactly once, audited.
update public.challenges set opens_at = now() - interval '1 minute', max_points = 300 where day = public.challenge_day();
do $$
declare body jsonb;
begin
  if public.send_drop_push() <> 4 then raise exception 'wrong number of phones'; end if;
  body := (select s.body from net.sent s);
  if (select count(*) from net.sent) <> 1 then raise exception 'expected one request'; end if;
  if body @> '[{"to": "ExponentPushToken[locked-phone]"}]' then raise exception 'locked account got the push'; end if;
  if not body @> '[{"to": "ExponentPushToken[old-phone-1]"}]' then raise exception 'member phone missed the push'; end if;
  if (body -> 0 ->> 'body') not like '%300 pts%' then raise exception 'push does not say the points'; end if;
  if public.send_drop_push() <> 0 then raise exception 'pushed twice'; end if;
  if (select count(*) from net.sent) <> 1 then raise exception 'sent twice'; end if;
  if not exists (select 1 from public.audit_log where action = 'challenge.push') then raise exception 'push not audited'; end if;
end $$;

-- 7. A drop that opened hours ago is not pushed late.
update public.challenges set notified_at = null, opens_at = now() - interval '3 hours' where day = public.challenge_day();
do $$ begin
  if public.send_drop_push() <> 0 then raise exception 'sent a stale push'; end if;
end $$;

-- 8. Deleting the account removes its phones.
delete from auth.users where id = '60000000-0000-0000-0000-000000000003';
do $$ begin
  if exists (select 1 from public.push_tokens where user_id = '60000000-0000-0000-0000-000000000003') then raise exception 'phones survived account deletion'; end if;
end $$;
\echo push: all tests passed
