-- Behavioural tests for 20261019010000_challenges.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

-- Fixtures (as superuser): a moderator and three members.
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('10000000-0000-0000-0000-000000000001', 'uno@test'),
  ('10000000-0000-0000-0000-000000000002', 'dos@test'),
  ('10000000-0000-0000-0000-000000000003', 'tres@test');
-- Everyone here bought a piece (access.test.sql covers people who did not).
insert into public.members (user_id) select id from auth.users on conflict do nothing;
insert into public.user_roles (user_id, role) values ('10000000-0000-0000-0000-00000000000d', 'moderator');
update public.profiles set username = 'uno' where id = '10000000-0000-0000-0000-000000000001';

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

-- 1. Anyone gets today's challenge; it is created once from the prompt pool.
--    (Its random opening time is moved to the past here; daily_drop.test.sql covers the wait.)
select pg_temp.act_as(null);
select public.today_challenge();
reset role;
update public.challenges set opens_at = now() - interval '1 minute';
insert into t select 'challenge', id::text from public.challenges;
select pg_temp.act_as(null);
do $$ begin
  if (select v from t where k = 'challenge') is null then raise exception 'no challenge today'; end if;
  if (select id::text from public.today_challenge()) <> (select v from t where k = 'challenge') then raise exception 'today changed between calls'; end if;
  if (select count(*) from public.challenges) <> 1 then raise exception 'expected exactly one challenge'; end if;
end $$;
reset role;

-- 2. Only staff can schedule challenges, and it is audited.
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    perform public.schedule_challenge(public.challenge_day() + 1, 'fake challenge');
    raise exception 'member scheduled a challenge';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-00000000000d');
select public.schedule_challenge(public.challenge_day() + 1, 'tomorrow, in upzzy.', null, 'one free tee');
do $$ begin
  begin
    perform public.schedule_challenge(public.challenge_day() - 1, 'rewrite history');
    raise exception 'past challenge was changed';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.audit_log where action = 'challenge.schedule') then raise exception 'schedule not audited'; end if;
end $$;

-- 3. Uploads only go to your own folder.
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name)
select 'oops', '10000000-0000-0000-0000-000000000001/' || v || '-a.jpg' from t where k = 'challenge';
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('oops', '10000000-0000-0000-0000-000000000002/x-a.jpg');
    raise exception 'uploaded into someone else''s folder';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 4. Posting: needs the photo, today's challenge, your folder, once per day.
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
begin
  begin
    perform public.submit_post(c, '10000000-0000-0000-0000-000000000001/' || c || '-missing.jpg');
    raise exception 'posted without a photo';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.submit_post(c, '10000000-0000-0000-0000-000000000002/' || c || '-a.jpg');
    raise exception 'posted a photo from another folder';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_post((select id from public.challenges where day = public.challenge_day() + 1), '10000000-0000-0000-0000-000000000001/x-a.jpg');
    raise exception 'posted to a challenge that is not today';
  exception when invalid_parameter_value then null;
  end;
  insert into t values ('post', (public.submit_post(c, '10000000-0000-0000-0000-000000000001/' || c || '-a.jpg', '  first.  ')).id::text);
  if (select caption from public.posts where id = (select v::uuid from t where k = 'post')) <> 'first.' then raise exception 'caption not trimmed'; end if;
  begin
    perform public.submit_post(c, '10000000-0000-0000-0000-000000000001/' || c || '-a.jpg');
    raise exception 'posted twice';
  exception when unique_violation then null;
  end;
  begin
    insert into public.posts (user_id, challenge_id, image_path) values ('10000000-0000-0000-0000-000000000001', c, 'direct.jpg');
    raise exception 'inserted a post directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
-- Others only see photos staff approved (approved_only.test.sql covers the wait).
update public.posts set review = 'approved';

-- 5. Anonymous visitors see the global feed and the photo, but cannot post.
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
begin
  if (select count(*) from public.challenge_feed(c)) <> 1 then raise exception 'members should see one post'; end if;
  if (select username from public.challenge_feed(c)) <> 'uno' then raise exception 'feed is missing the username'; end if;
  if not exists (select 1 from storage.objects where name like '10000000-0000-0000-0000-000000000001/%') then raise exception 'members cannot read a visible photo'; end if;
end $$;
reset role;
-- Photos are for members only (see access.test.sql).
select pg_temp.act_as(null);
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
begin
  if exists (select 1 from public.challenge_feed(c)) then raise exception 'anon sees the feed'; end if;
  begin
    perform public.submit_post(c, 'x');
    raise exception 'anon posted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 6. Likes are counted by the server, once per person, and cannot be forged.
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
insert into public.post_likes (post_id) select v::uuid from t where k = 'post';
do $$
declare p uuid := (select v::uuid from t where k = 'post');
begin
  begin
    insert into public.post_likes (post_id) values (p);
    raise exception 'liked twice';
  exception when unique_violation then null;
  end;
  begin
    insert into public.post_likes (post_id, user_id) values (p, '10000000-0000-0000-0000-000000000003');
    raise exception 'liked as someone else';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.posts set like_count = 999 where id = p;
    raise exception 'like count edited by a client';
  exception when insufficient_privilege then null;
  end;
  if (select like_count from public.posts where id = p) <> 1 then raise exception 'like not counted'; end if;
end $$;
delete from public.post_likes where post_id = (select v::uuid from t where k = 'post');
do $$ begin
  if (select like_count from public.posts where id = (select v::uuid from t where k = 'post')) <> 0 then raise exception 'unlike not counted'; end if;
end $$;
reset role;

-- 7. Friends feed only shows people you follow.
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
do $$
declare c uuid := (select v::uuid from t where k = 'challenge');
begin
  if (select count(*) from public.challenge_feed(c, 'friends')) <> 0 then raise exception 'friends feed shows strangers'; end if;
  insert into public.follows (followed_id) values ('10000000-0000-0000-0000-000000000001');
  if (select count(*) from public.challenge_feed(c, 'friends')) <> 1 then raise exception 'friends feed misses someone I follow'; end if;
  if not (select following from public.challenge_feed(c)) then raise exception 'feed does not show I follow them'; end if;
  begin
    insert into public.follows (followed_id) values ('10000000-0000-0000-0000-000000000002');
    raise exception 'followed myself';
  exception when check_violation then null;
  end;
  begin
    insert into public.follows (follower_id, followed_id) values ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001');
    raise exception 'made someone else follow';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 8. Blocking hides that person's posts from you.
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
insert into public.user_blocks (blocked_id) values ('10000000-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.challenge_feed((select v::uuid from t where k = 'challenge'))) <> 0 then raise exception 'blocked user still in my feed'; end if;
end $$;
delete from public.user_blocks;
reset role;

-- 9. Three reports hide a post (audited); its photo goes private; staff restore it.
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
insert into public.post_reports (post_id, reason) select v::uuid, 'spam' from t where k = 'post';
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
insert into public.post_reports (post_id, reason) select v::uuid, 'other' from t where k = 'post';
do $$ begin
  if exists (select 1 from public.post_reports) then raise exception 'members can read reports'; end if;
end $$;
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-00000000000d');
insert into public.post_reports (post_id, reason) select v::uuid, 'nudity' from t where k = 'post';
reset role;
do $$ begin
  if (select status from public.posts where id = (select v::uuid from t where k = 'post')) <> 'hidden' then raise exception 'post not hidden after 3 reports'; end if;
  if not exists (select 1 from public.audit_log where action = 'post.auto_hide') then raise exception 'auto hide not audited'; end if;
end $$;
select pg_temp.act_as(null);
do $$ begin
  if exists (select 1 from public.posts) then raise exception 'hidden post is public'; end if;
  if exists (select 1 from storage.objects where name like '10000000-0000-0000-0000-000000000001/%') then raise exception 'hidden photo is public'; end if;
end $$;
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
do $$ begin
  if not exists (select 1 from public.posts) then raise exception 'owner cannot see own hidden post'; end if;
  begin
    perform public.moderate_post((select v::uuid from t where k = 'post'), 'visible');
    raise exception 'member moderated a post';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-00000000000d');
select public.moderate_post((select v::uuid from t where k = 'post'), 'visible');
reset role;
do $$ begin
  if (select status from public.posts where id = (select v::uuid from t where k = 'post')) <> 'visible' then raise exception 'moderator could not restore'; end if;
  if not exists (select 1 from public.audit_log where action = 'post.moderate') then raise exception 'moderation not audited'; end if;
end $$;

-- 10. Deleting an account removes its posts and is audited, even with audit history.
select pg_temp.act_as('10000000-0000-0000-0000-00000000000d');
select public.delete_account();
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.delete_account();
reset role;
do $$ begin
  if exists (select 1 from auth.users where id = '10000000-0000-0000-0000-000000000001') then raise exception 'account not deleted'; end if;
  if exists (select 1 from public.posts where id = (select v::uuid from t where k = 'post')) then raise exception 'posts survived account deletion'; end if;
  if (select count(*) from public.audit_log where action = 'account.delete') <> 2 then raise exception 'account deletion not audited'; end if;
end $$;
\echo challenges: all tests passed
