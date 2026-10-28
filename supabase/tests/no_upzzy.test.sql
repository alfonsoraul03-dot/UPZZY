-- Behavioural tests for 20261026000000_no_upzzy.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('80000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('80000000-0000-0000-0000-000000000001', 'uno@test'),
  ('80000000-0000-0000-0000-000000000002', 'dos@test');
insert into public.members (user_id) select id from auth.users on conflict do nothing;
insert into public.user_roles (user_id, role) values ('80000000-0000-0000-0000-00000000000d', 'moderator');

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

select pg_temp.act_as(null);
do $$ begin perform public.today_challenge(); end $$;
reset role;
update public.challenges set opens_at = now() - interval '1 minute' where day = public.challenge_day();
insert into t select 'challenge', id::text from public.challenges where day = public.challenge_day();

select pg_temp.act_as('80000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) select 'oops', '80000000-0000-0000-0000-000000000001/' || v || '-a.jpg' from t where k = 'challenge';
insert into t select 'post', (public.submit_post(v::uuid, '80000000-0000-0000-0000-000000000001/' || v || '-a.jpg')).id::text from t where k = 'challenge';
reset role;

-- 1. "no upzzy": the photo comes down at once and is audited.
select pg_temp.act_as('80000000-0000-0000-0000-00000000000d');
select public.review_post(v::uuid, false) from t where k = 'post';
reset role;
do $$ begin
  if (select status from public.posts where id = (select v::uuid from t where k = 'post')) <> 'removed' then
    raise exception 'rejected photo is still up';
  end if;
  if (select review from public.posts where id = (select v::uuid from t where k = 'post')) <> 'rejected' then
    raise exception 'photo not marked rejected';
  end if;
  if (select count(*) from public.audit_log where action = 'post.review') <> 1 then raise exception 'check not audited'; end if;
end $$;

-- 2. Others no longer see it in the feed.
select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
do $$ begin
  if exists (select 1 from public.challenge_feed((select v::uuid from t where k = 'challenge')) where id = (select v::uuid from t where k = 'post')) then
    raise exception 'rejected photo still in the feed';
  end if;
  if exists (select 1 from public.posts where id = (select v::uuid from t where k = 'post')) then
    raise exception 'others can read the rejected photo';
  end if;
end $$;
reset role;

-- 3. The owner still sees it was rejected, and the day is spent:
--    no second photo, and deleting the rejected one does nothing.
select pg_temp.act_as('80000000-0000-0000-0000-000000000001');
do $$ begin
  if (select review from public.posts where id = (select v::uuid from t where k = 'post')) <> 'rejected' then
    raise exception 'owner cannot see the rejection';
  end if;
end $$;
delete from public.posts where id = (select v::uuid from t where k = 'post');
do $$ begin
  if not exists (select 1 from public.posts where id = (select v::uuid from t where k = 'post')) then
    raise exception 'owner deleted a rejected photo to try again';
  end if;
end $$;
insert into storage.objects (bucket_id, name) select 'oops', '80000000-0000-0000-0000-000000000001/' || v || '-b.jpg' from t where k = 'challenge';
do $$ begin
  perform public.submit_post((select v::uuid from t where k = 'challenge'), '80000000-0000-0000-0000-000000000001/' || (select v from t where k = 'challenge') || '-b.jpg');
  raise exception 'posted twice on the same day';
exception when unique_violation then null;
end $$;
reset role;

-- 4. No undo: the file is gone, so it cannot be approved later.
select pg_temp.act_as('80000000-0000-0000-0000-00000000000d');
do $$ begin
  perform public.review_post((select v::uuid from t where k = 'post'), true);
  raise exception 'approved a rejected photo';
exception when invalid_parameter_value then null;
end $$;
reset role;

-- 5. The file of a rejected photo: someone else cannot delete it, staff can.
--    (dos also posts a photo that is still waiting, which staff cannot delete.)
select pg_temp.act_as('80000000-0000-0000-0000-000000000002');
insert into storage.objects (bucket_id, name) select 'oops', '80000000-0000-0000-0000-000000000002/' || v || '-a.jpg' from t where k = 'challenge';
select public.submit_post(v::uuid, '80000000-0000-0000-0000-000000000002/' || v || '-a.jpg') from t where k = 'challenge';
delete from storage.objects where name like '80000000-0000-0000-0000-000000000001/%';
reset role;
do $$ begin
  if (select count(*) from storage.objects where name like '80000000-0000-0000-0000-000000000001/%') <> 2 then
    raise exception 'someone else deleted the rejected photo file';
  end if;
end $$;
select pg_temp.act_as('80000000-0000-0000-0000-00000000000d');
delete from storage.objects where name = (select image_path from public.posts where id = (select v::uuid from t where k = 'post'));
delete from storage.objects where name like '80000000-0000-0000-0000-000000000002/%';
reset role;
do $$ begin
  if exists (select 1 from storage.objects where name = (select image_path from public.posts where id = (select v::uuid from t where k = 'post'))) then
    raise exception 'staff could not delete the rejected photo file';
  end if;
  if not exists (select 1 from storage.objects where name like '80000000-0000-0000-0000-000000000002/%') then
    raise exception 'staff deleted a photo that was not rejected';
  end if;
end $$;

-- 6. No rejected photo is left visible anywhere.
reset role;
do $$ begin
  if exists (select 1 from public.posts where review = 'rejected' and status <> 'removed') then
    raise exception 'a rejected photo is still visible';
  end if;
end $$;

\echo no_upzzy: all tests passed
