-- Behavioural tests for 20261025000000_safety.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('70000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('70000000-0000-0000-0000-000000000001', 'bad@test'),
  ('70000000-0000-0000-0000-000000000002', 'uno@test'),
  ('70000000-0000-0000-0000-000000000003', 'dos@test');
insert into public.members (user_id) select id from auth.users;
insert into public.user_roles (user_id, role) values ('70000000-0000-0000-0000-00000000000d', 'moderator');
update public.profiles set username = 'bad' where id = '70000000-0000-0000-0000-000000000001';

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

select public.today_challenge();
update public.challenges set opens_at = now() - interval '1 hour' where day = public.challenge_day();
insert into public.posts (user_id, challenge_id, image_path, review)
select u, c.id, u || '/' || c.id || '-a.jpg', 'approved'
from public.challenges c, unnest(array['70000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002']::uuid[]) u
where c.day = public.challenge_day();
insert into t select 'bad_post', id::text from public.posts where user_id = '70000000-0000-0000-0000-000000000001';
insert into t select 'ok_post', id::text from public.posts where user_id = '70000000-0000-0000-0000-000000000002';
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[bad-phone-1]', '70000000-0000-0000-0000-000000000001', 'ios');

-- 1. Reports show up in the staff queue, never for members.
select pg_temp.act_as('70000000-0000-0000-0000-000000000002');
insert into public.post_reports (post_id, reason) select v::uuid, 'nudity' from t where k = 'bad_post';
do $$ begin
  if exists (select 1 from public.report_queue()) then raise exception 'member sees the report queue'; end if;
  begin
    perform public.ban_user('70000000-0000-0000-0000-000000000001');
    raise exception 'member banned someone';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.act_as('70000000-0000-0000-0000-000000000003');
insert into public.post_reports (post_id, reason) select v::uuid, 'hate' from t where k = 'bad_post';
insert into public.post_reports (post_id, reason) select v::uuid, 'spam' from t where k = 'ok_post';
reset role;
select pg_temp.act_as('70000000-0000-0000-0000-00000000000d');
do $$
declare q record;
begin
  if (select count(*) from public.report_queue()) <> 2 then raise exception 'queue should have two photos'; end if;
  select * into q from public.report_queue() where post_id = (select v::uuid from t where k = 'bad_post');
  if q.reports <> 2 or q.username <> 'bad' or not q.reasons @> array['nudity', 'hate'] then raise exception 'queue row is wrong: %', row_to_json(q); end if;
end $$;

-- 2. Keeping a photo takes it off the queue until someone reports it again.
select public.moderate_post((select v::uuid from t where k = 'ok_post'), 'visible');
do $$ begin
  if exists (select 1 from public.report_queue() where post_id = (select v::uuid from t where k = 'ok_post')) then raise exception 'kept photo still queued'; end if;
end $$;
reset role;
select pg_temp.act_as('70000000-0000-0000-0000-000000000001');
insert into public.post_reports (post_id, reason) select v::uuid, 'other' from t where k = 'ok_post';
reset role;
select pg_temp.act_as('70000000-0000-0000-0000-00000000000d');
do $$ begin
  if not exists (select 1 from public.report_queue() where post_id = (select v::uuid from t where k = 'ok_post')) then raise exception 'new report did not bring it back'; end if;
  begin
    perform public.ban_user('70000000-0000-0000-0000-00000000000d');
    raise exception 'banned staff';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- 3. A ban removes their photos and phones, is audited, and locks them out.
select public.ban_user('70000000-0000-0000-0000-000000000001', 'nudity');
reset role;
do $$ begin
  if (select status from public.posts where id = (select v::uuid from t where k = 'bad_post')) <> 'removed' then raise exception 'photo not removed'; end if;
  if exists (select 1 from public.push_tokens where user_id = '70000000-0000-0000-0000-000000000001') then raise exception 'banned phone still saved'; end if;
  if not exists (select 1 from public.audit_log where action = 'user.ban') then raise exception 'ban not audited'; end if;
end $$;
select pg_temp.act_as('70000000-0000-0000-0000-00000000000d');
do $$ begin
  if exists (select 1 from public.report_queue() where post_id = (select v::uuid from t where k = 'bad_post')) then raise exception 'removed photo still queued'; end if;
end $$;
reset role;
insert into public.garment_codes (code) values ('NEWCODE234');
select pg_temp.act_as('70000000-0000-0000-0000-000000000001');
do $$ begin
  if public.has_access() then raise exception 'banned person has access'; end if;
  if public.redeem_code('NEWCODE234') <> 'banned' then raise exception 'banned person used a new code'; end if;
  begin
    insert into public.follows (followed_id) values ('70000000-0000-0000-0000-000000000002');
    raise exception 'banned person followed someone';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if (select redeemed_at from public.garment_codes where code = 'NEWCODE234') is not null then raise exception 'banned person spent a code'; end if;
end $$;

-- 4. Staff can undo a ban; it is audited.
select pg_temp.act_as('70000000-0000-0000-0000-00000000000d');
select public.unban_user('70000000-0000-0000-0000-000000000001');
reset role;
select pg_temp.act_as('70000000-0000-0000-0000-000000000001');
do $$ begin
  if not public.has_access() then raise exception 'unban did not give access back'; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.audit_log where action = 'user.unban') then raise exception 'unban not audited'; end if;
end $$;
\echo safety: all tests passed
