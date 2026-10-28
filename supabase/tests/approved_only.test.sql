-- Behavioural tests for 20261027000000_approved_only.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('90000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('90000000-0000-0000-0000-000000000001', 'uno@test'),
  ('90000000-0000-0000-0000-000000000002', 'dos@test');
insert into public.members (user_id) select id from auth.users on conflict do nothing;
insert into public.user_consents (user_id, adult_at, content_rules_at) select id, now(), now() from auth.users on conflict do nothing;
insert into public.user_roles (user_id, role) values ('90000000-0000-0000-0000-00000000000d', 'moderator');

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

select pg_temp.act_as(null);
do $$ begin perform public.today_challenge(); end $$;
reset role;
update public.challenges set opens_at = now() - interval '1 minute' where day = public.challenge_day();
insert into t select 'challenge', id::text from public.challenges where day = public.challenge_day();

-- dos follows uno, so the photo would be in dos's friends feed too.
select pg_temp.act_as('90000000-0000-0000-0000-000000000002');
insert into public.follows (followed_id) values ('90000000-0000-0000-0000-000000000001');
reset role;

select pg_temp.act_as('90000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) select 'oops', '90000000-0000-0000-0000-000000000001/' || v || '-a.jpg' from t where k = 'challenge';
insert into t select 'post', (public.submit_post(v::uuid, '90000000-0000-0000-0000-000000000001/' || v || '-a.jpg')).id::text from t where k = 'challenge';
-- 1. The owner sees their photo right away, waiting for the check.
do $$ begin
  if not exists (select 1 from public.challenge_feed((select v::uuid from t where k = 'challenge')) where id = (select v::uuid from t where k = 'post') and review = 'pending') then
    raise exception 'owner does not see their pending photo';
  end if;
end $$;
reset role;

-- 2. Nobody else does: not in global, not in friends, not the row, not the file.
select pg_temp.act_as('90000000-0000-0000-0000-000000000002');
insert into storage.objects (bucket_id, name)
select 'oops', '90000000-0000-0000-0000-000000000002/r-' || v || '-1.jpg' from t where k = 'post';
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
declare p uuid := (select v::uuid from t where k = 'post');
begin
  if exists (select 1 from public.challenge_feed(c, 'global')) then raise exception 'pending photo in global'; end if;
  if exists (select 1 from public.challenge_feed(c, 'friends')) then raise exception 'pending photo in friends'; end if;
  if exists (select 1 from public.posts where id = p) then raise exception 'others can read a pending photo'; end if;
  if exists (select 1 from storage.objects where name like '90000000-0000-0000-0000-000000000001/%') then raise exception 'others can open a pending photo file'; end if;
  -- 3. ... and cannot like or react to it yet.
  begin
    insert into public.post_likes (post_id) values (p);
    raise exception 'liked a pending photo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.react_to_post(p, '90000000-0000-0000-0000-000000000002/r-' || p || '-1.jpg');
    raise exception 'reacted to a pending photo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4. Staff see it to check it.
select pg_temp.act_as('90000000-0000-0000-0000-00000000000d');
do $$ begin
  if not exists (select 1 from public.posts where id = (select v::uuid from t where k = 'post')) then raise exception 'staff cannot see a pending photo'; end if;
end $$;
select public.review_post(v::uuid, true) from t where k = 'post';
reset role;

-- 5. Once approved, it is in global and friends, and others can like and react.
select pg_temp.act_as('90000000-0000-0000-0000-000000000002');
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
declare p uuid := (select v::uuid from t where k = 'post');
begin
  if not exists (select 1 from public.challenge_feed(c, 'global') where id = p) then raise exception 'approved photo missing from global'; end if;
  if not exists (select 1 from public.challenge_feed(c, 'friends') where id = p) then raise exception 'approved photo missing from friends'; end if;
  if not exists (select 1 from storage.objects where name like '90000000-0000-0000-0000-000000000001/%') then raise exception 'approved photo file not readable'; end if;
  insert into public.post_likes (post_id) values (p);
  perform public.react_to_post(p, '90000000-0000-0000-0000-000000000002/r-' || p || '-1.jpg');
end $$;
reset role;

\echo approved_only: all tests passed
