-- Behavioural tests for 20261022000000_points.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('40000000-0000-0000-0000-000000000001', 'uno@test'),
  ('40000000-0000-0000-0000-000000000002', 'dos@test'),
  ('40000000-0000-0000-0000-000000000003', 'tres@test');
-- Everyone here bought a piece (access.test.sql covers people who did not).
insert into public.members (user_id) select id from auth.users on conflict do nothing;
insert into public.user_consents (user_id, adult_at, content_rules_at) select id, now(), now() from auth.users on conflict do nothing;
insert into public.user_roles (user_id, role) values ('40000000-0000-0000-0000-00000000000d', 'moderator');
update public.profiles set username = 'uno' where id = '40000000-0000-0000-0000-000000000001';

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

-- 1. Each challenge is worth a random 100..500, in steps of 50.
do $$ begin
  if exists (select 1 from generate_series(1, 300) where public.random_max_points() not in (100, 150, 200, 250, 300, 350, 400, 450, 500)) then
    raise exception 'value outside 100..500 in steps of 50';
  end if;
  if (select count(distinct public.random_max_points()) from generate_series(1, 200)) < 6 then raise exception 'values are not random'; end if;
  if public.post_points(500, 0) <> 500 or public.post_points(500, 30) <> 475 or public.post_points(300, 10000) <> 30 then
    raise exception 'speed share wrong: % % %', public.post_points(500, 0), public.post_points(500, 30), public.post_points(300, 10000);
  end if;
end $$;

-- 2. Today's challenge says what it is worth; the prompts are about wearing UPZZY.
select pg_temp.act_as(null);
do $$ begin
  perform public.today_challenge();
end $$;
reset role;
update public.challenges set opens_at = now() - interval '1 minute', max_points = 400 where day = public.challenge_day();
insert into t select 'challenge', id::text from public.challenges where day = public.challenge_day();
select pg_temp.act_as(null);
do $$ begin
  if (select max_points from public.today_challenge()) <> 400 then raise exception 'today_challenge misses max_points'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.challenge_prompts where active and title || coalesce(description, '') not like '%upzzy%' and description not like '%piece%') then
    raise exception 'an active prompt is not about wearing upzzy';
  end if;
end $$;

-- 3. A new photo gets its points, but they wait for the UPZZY check.
select pg_temp.act_as('40000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) select 'oops', '40000000-0000-0000-0000-000000000001/' || v || '-a.jpg' from t where k = 'challenge';
insert into t select 'post', (public.submit_post(v::uuid, '40000000-0000-0000-0000-000000000001/' || v || '-a.jpg')).id::text from t where k = 'challenge';
do $$
declare s record;
begin
  if (select points from public.posts where id = (select v::uuid from t where k = 'post')) <> 400 then raise exception 'expected 400 points'; end if;
  if (select review from public.posts where id = (select v::uuid from t where k = 'post')) <> 'pending' then raise exception 'new photo should wait for the check'; end if;
  select * into s from public.user_stats('40000000-0000-0000-0000-000000000001');
  if s.month_points <> 0 or s.pending_points <> 400 then raise exception 'pending points counted: %', s; end if;
  if s.streak <> 1 then raise exception 'a pending photo should keep the streak'; end if;
  if exists (select 1 from public.monthly_ranking()) then raise exception 'pending points in the ranking'; end if;
  begin
    update public.posts set review = 'approved';
    raise exception 'owner approved their own photo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.review_post((select v::uuid from t where k = 'post'), true);
    raise exception 'non-staff checked a photo';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.post_likes (post_id) values ((select v::uuid from t where k = 'post'));
    raise exception 'liked my own photo';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4. Likes from others are +1 each (once staff approved the photo; before
--    that nobody else can see or like it, see approved_only.test.sql).
select pg_temp.act_as('40000000-0000-0000-0000-00000000000d');
select public.review_post(v::uuid, true) from t where k = 'post';
reset role;
select pg_temp.act_as('40000000-0000-0000-0000-000000000002');
insert into public.post_likes (post_id) select v::uuid from t where k = 'post';
do $$ begin
  if not (select liked from public.challenge_feed((select v::uuid from t where k = 'challenge')) where id = (select v::uuid from t where k = 'post')) then
    raise exception 'feed misses my like';
  end if;
end $$;
reset role;
select pg_temp.act_as('40000000-0000-0000-0000-000000000003');
insert into public.post_likes (post_id) select v::uuid from t where k = 'post';
reset role;

-- 5. Staff approve: photo points and likes count. Audited.
select pg_temp.act_as('40000000-0000-0000-0000-00000000000d');
select public.review_post(v::uuid, true) from t where k = 'post';
reset role;
do $$
declare s record;
begin
  select * into s from public.user_stats('40000000-0000-0000-0000-000000000001');
  if s.month_points <> 402 or s.total_points <> 402 or s.pending_points <> 0 then raise exception 'approved points wrong: %', s; end if;
  if (select points from public.monthly_ranking() where username = 'uno') <> 402 then raise exception 'ranking misses approved points'; end if;
  if not exists (select 1 from public.audit_log where action = 'post.review') then raise exception 'check not audited'; end if;
end $$;

-- 6. No UPZZY in the photo: nothing counts, not even the likes.
select pg_temp.act_as('40000000-0000-0000-0000-00000000000d');
select public.review_post(v::uuid, false) from t where k = 'post';
reset role;
do $$ begin
  if (select month_points from public.user_stats('40000000-0000-0000-0000-000000000001')) <> 0 then raise exception 'rejected photo still counts'; end if;
  if (select streak from public.user_stats('40000000-0000-0000-0000-000000000001')) <> 0 then raise exception 'rejected photo keeps the streak'; end if;
end $$;

-- 7. Friends: +10 each once you follow each other; gone if you unfollow.
select pg_temp.act_as('40000000-0000-0000-0000-000000000001');
insert into public.follows (followed_id) values ('40000000-0000-0000-0000-000000000003');
do $$ begin
  if (select month_points from public.user_stats('40000000-0000-0000-0000-000000000001')) <> 0 then raise exception 'one-way follow earned points'; end if;
end $$;
reset role;
select pg_temp.act_as('40000000-0000-0000-0000-000000000003');
insert into public.follows (followed_id) values ('40000000-0000-0000-0000-000000000001');
do $$
declare s record;
begin
  select * into s from public.user_stats('40000000-0000-0000-0000-000000000001');
  if s.month_points <> 10 or s.friends <> 1 then raise exception 'friend points wrong: %', s; end if;
  if (select month_points from public.user_stats('40000000-0000-0000-0000-000000000003')) <> 10 then raise exception 'both friends should get 10'; end if;
  if (select count(*) from public.monthly_ranking()) <> 2 then raise exception 'friends missing from ranking'; end if;
  delete from public.follows where followed_id = '40000000-0000-0000-0000-000000000001';
  if (select month_points from public.user_stats('40000000-0000-0000-0000-000000000001')) <> 0 then raise exception 'unfollow kept the points'; end if;
end $$;
reset role;

-- 8. Scores are internal; clients only see totals.
select pg_temp.act_as('40000000-0000-0000-0000-000000000002');
do $$ begin
  begin
    perform public.scores_since(now());
    raise exception 'client called scores_since';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

\echo points: all tests passed
