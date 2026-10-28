-- Behavioural tests for 20261019020000_daily_drop.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('20000000-0000-0000-0000-000000000001', 'uno@test'),
  ('20000000-0000-0000-0000-000000000002', 'dos@test'),
  ('20000000-0000-0000-0000-000000000003', 'tres@test');
-- Everyone here bought a piece (access.test.sql covers people who did not).
insert into public.members (user_id) select id from auth.users on conflict do nothing;
insert into public.user_consents (user_id, adult_at, content_rules_at) select id, now(), now() from auth.users on conflict do nothing;
insert into public.user_roles (user_id, role) values ('20000000-0000-0000-0000-00000000000d', 'moderator');
update public.profiles set username = 'uno' where id = '20000000-0000-0000-0000-000000000001';
update public.profiles set username = 'dos' where id = '20000000-0000-0000-0000-000000000002';

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

-- 1. Points: 100 in the first 5 minutes, then one less every 5 minutes, never below 10.
do $$ begin
  if public.points_for(0) <> 100 or public.points_for(5) <> 100 then raise exception 'early posts should get 100'; end if;
  if public.points_for(10) <> 99 or public.points_for(60) <> 89 then raise exception 'points do not drop 1 per 5 minutes'; end if;
  if public.points_for(10000) <> 10 then raise exception 'points should never go below 10'; end if;
end $$;

-- 2. Opening times are random, between 09:00 and 21:00 in Madrid.
do $$
declare ts timestamptz; local time;
begin
  for i in 1..300 loop
    ts := public.random_open_time(date '2026-11-02');
    local := (ts at time zone 'Europe/Madrid')::time;
    if (ts at time zone 'Europe/Madrid')::date <> date '2026-11-02' or local < time '09:00' or local > time '21:00' then
      raise exception 'open time % outside 09:00-21:00 Madrid', ts;
    end if;
  end loop;
  if (select count(distinct public.random_open_time(date '2026-11-02')) from generate_series(1, 20)) < 15 then
    raise exception 'open times are not random';
  end if;
end $$;

-- 3. Before it opens, today's challenge is a secret and nobody can post.
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
select public.today_challenge();
reset role;
-- Worth 100 so the numbers below are easy to follow (points.test.sql covers other values).
update public.challenges set opens_at = now() + interval '2 hours', max_points = 100 where day = public.challenge_day();
insert into t select 'challenge', id::text from public.challenges where day = public.challenge_day();
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name)
select 'oops', '20000000-0000-0000-0000-000000000001/' || v || '-a.jpg' from t where k = 'challenge';
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
begin
  if (select is_open from public.today_challenge()) then raise exception 'challenge open too early'; end if;
  if (select title from public.today_challenge()) is not null then raise exception 'title leaked before opening'; end if;
  if exists (select 1 from public.challenges) then raise exception 'unopened challenge readable from the table'; end if;
  begin
    perform public.submit_post(c, '20000000-0000-0000-0000-000000000001/' || c || '-a.jpg');
    raise exception 'posted before the challenge opened';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
select pg_temp.act_as('20000000-0000-0000-0000-00000000000d');
do $$ begin
  if not exists (select 1 from public.challenges) then raise exception 'staff cannot see the upcoming challenge'; end if;
end $$;
reset role;

-- 4. Once open, the server gives points by how fast you were.
update public.challenges set opens_at = now() - interval '30 minutes' where day = public.challenge_day();
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
begin
  if not (select is_open from public.today_challenge()) then raise exception 'challenge should be open'; end if;
  if (select id from public.latest_challenge()) <> c then raise exception 'latest challenge is not today'; end if;
  insert into t values ('post1', (public.submit_post(c, '20000000-0000-0000-0000-000000000001/' || c || '-a.jpg')).id::text);
  if (select points from public.posts where id = (select v::uuid from t where k = 'post1')) <> 95 then raise exception 'expected 95 points after 30 minutes'; end if;
  begin
    update public.posts set points = 100;
    raise exception 'client edited points';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.challenges set opens_at = now() - interval '3 hours' where day = public.challenge_day();
select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
insert into storage.objects (bucket_id, name)
select 'oops', '20000000-0000-0000-0000-000000000002/' || v || '-b.jpg' from t where k = 'challenge';
insert into t select 'post2', (public.submit_post(v::uuid, '20000000-0000-0000-0000-000000000002/' || v || '-b.jpg')).id::text from t where k = 'challenge';
do $$ begin
  if (select points from public.posts where id = (select v::uuid from t where k = 'post2')) <> 65 then raise exception 'expected 65 points after 3 hours'; end if;
end $$;
reset role;

-- Others only react to photos staff approved (approved_only.test.sql covers the wait).
update public.posts set review = 'approved';

-- 5. Photo reactions: own folder only, one per person (replacing returns the old photo), public like the post.
select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
insert into storage.objects (bucket_id, name)
select 'oops', '20000000-0000-0000-0000-000000000002/r-' || v || '-1.jpg' from t where k = 'post1';
insert into storage.objects (bucket_id, name)
select 'oops', '20000000-0000-0000-0000-000000000002/r-' || v || '-2.jpg' from t where k = 'post1';
do $$
declare p uuid := (select v::uuid from t where k = 'post1');
begin
  begin
    perform public.react_to_post(p, '20000000-0000-0000-0000-000000000001/' || p || '-a.jpg');
    raise exception 'reacted with someone else''s photo';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.react_to_post(p, '20000000-0000-0000-0000-000000000002/r-' || p || '-missing.jpg');
    raise exception 'reacted without uploading';
  exception when invalid_parameter_value then null;
  end;
  if public.react_to_post(p, '20000000-0000-0000-0000-000000000002/r-' || p || '-1.jpg') is not null then raise exception 'first reaction returned an old photo'; end if;
  if public.react_to_post(p, '20000000-0000-0000-0000-000000000002/r-' || p || '-2.jpg') <> '20000000-0000-0000-0000-000000000002/r-' || p || '-1.jpg' then
    raise exception 'replacing a reaction should return the old photo';
  end if;
  if (select count(*) from public.post_reactions) <> 1 then raise exception 'expected one reaction per person'; end if;
  if (select my_reaction from public.challenge_feed((select v::uuid from t where k = 'challenge')) where id = p) is null then raise exception 'feed misses my reaction'; end if;
  begin
    insert into public.post_reactions (post_id, user_id, image_path) values (p, '20000000-0000-0000-0000-000000000002', 'x');
    raise exception 'inserted a reaction directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
do $$
declare row record;
begin
  select * into row from public.challenge_feed((select v::uuid from t where k = 'challenge')) where id = (select v::uuid from t where k = 'post1');
  if row.reaction_count <> 1 or row.reactions->0->>'username' <> 'dos' then raise exception 'feed reactions wrong: %', row.reactions; end if;
  if not exists (select 1 from storage.objects where name like '20000000-0000-0000-0000-000000000002/r-%-2.jpg') then raise exception 'members cannot see a reaction photo'; end if;
end $$;
reset role;

-- 6. Someone you blocked cannot react to your photos.
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
insert into public.user_blocks (blocked_id) values ('20000000-0000-0000-0000-000000000003');
reset role;
select pg_temp.act_as('20000000-0000-0000-0000-000000000003');
insert into storage.objects (bucket_id, name)
select 'oops', '20000000-0000-0000-0000-000000000003/r-' || v || '-1.jpg' from t where k = 'post1';
do $$
declare p uuid := (select v::uuid from t where k = 'post1');
begin
  perform public.react_to_post(p, '20000000-0000-0000-0000-000000000003/r-' || p || '-1.jpg');
  raise exception 'blocked person reacted';
exception when no_data_found then null;
end $$;
reset role;

-- 7. Streaks count days in a row; points add up.
insert into public.challenges (day, title, opens_at) values
  (public.challenge_day() - 1, 'yesterday.', now() - interval '1 day'),
  (public.challenge_day() - 2, 'the day before.', now() - interval '2 days'),
  (public.challenge_day() - 4, 'a while ago.', now() - interval '4 days');
insert into public.posts (user_id, challenge_id, image_path, points)
select '20000000-0000-0000-0000-000000000001', id, 'old/' || day || '.jpg', 50 from public.challenges where day < public.challenge_day();
-- Staff checked every photo: the UPZZY piece shows.
update public.posts set review = 'approved';
select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
do $$
declare s record;
begin
  select * into s from public.user_stats('20000000-0000-0000-0000-000000000001');
  if s.streak <> 3 then raise exception 'expected a 3 day streak, got %', s.streak; end if;
  if s.total_points <> 245 or s.posts <> 4 then raise exception 'expected 245 points in 4 posts, got % in %', s.total_points, s.posts; end if;
  if s.username <> 'uno' then raise exception 'stats missing username'; end if;
  select * into s from public.user_stats('20000000-0000-0000-0000-000000000003');
  if s.streak <> 0 or s.total_points <> 0 then raise exception 'empty profile should have no streak or points'; end if;
end $$;
reset role;
-- Yesterday's post keeps the streak alive until today's is posted.
delete from public.posts where id = (select v::uuid from t where k = 'post1');
do $$ begin
  if (select streak from public.user_stats('20000000-0000-0000-0000-000000000001')) <> 2 then raise exception 'streak should survive until today ends'; end if;
end $$;

-- 8. Monthly ranking, global and friends (you plus who you follow).
select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
do $$ begin
  if (select username from public.monthly_ranking() where rank = 1) <> 'uno' then raise exception 'uno should lead the month'; end if;
  if (select count(*) from public.monthly_ranking('friends')) <> 1 then raise exception 'friends ranking should only have me'; end if;
  insert into public.follows (followed_id) values ('20000000-0000-0000-0000-000000000001');
  if (select count(*) from public.monthly_ranking('friends')) <> 2 then raise exception 'friends ranking misses someone I follow'; end if;
  if (select points from public.monthly_ranking('friends') where username = 'dos') <> 65 then raise exception 'my points wrong in ranking'; end if;
end $$;
reset role;

\echo daily_drop: all tests passed
