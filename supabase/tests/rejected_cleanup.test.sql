-- Behavioural tests for 20261028000000_rejected_cleanup.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

-- A photo rejected the old way (marked, still up) comes down when the cleanup runs again.
insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000001', 'uno@test');
select public.today_challenge();
insert into public.user_consents (user_id, adult_at, content_rules_at) values ('a0000000-0000-0000-0000-000000000001', now(), now());
insert into storage.objects (bucket_id, name) values ('oops', 'a0000000-0000-0000-0000-000000000001/old.jpg');
insert into public.posts (user_id, challenge_id, image_path, review, status)
select 'a0000000-0000-0000-0000-000000000001', id, 'a0000000-0000-0000-0000-000000000001/old.jpg', 'rejected', 'visible'
from public.challenges where day = public.challenge_day();

\i supabase/migrations/20261028000000_rejected_cleanup.sql

do $$ begin
  if exists (select 1 from public.posts where review = 'rejected' and status <> 'removed') then
    raise exception 'an old rejected photo is still up';
  end if;
end $$;

\echo rejected_cleanup: all tests passed
