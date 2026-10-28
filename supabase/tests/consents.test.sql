-- Behavioural tests for 20261029000000_consents.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-00000000000d', 'mod@test'),
  ('b0000000-0000-0000-0000-000000000001', 'adult@test'),
  ('b0000000-0000-0000-0000-000000000002', 'kid@test');
insert into public.user_roles (user_id, role) values ('b0000000-0000-0000-0000-00000000000d', 'moderator');
-- Both bought a piece; the age decides whether they get in.
insert into public.members (user_id) values ('b0000000-0000-0000-0000-000000000001'), ('b0000000-0000-0000-0000-000000000002');

-- 1. Age in years, on the day.
do $$ begin
  if public.age_on('2008-03-10', '2026-03-09') <> 17 or public.age_on('2008-03-10', '2026-03-10') <> 18 then
    raise exception 'age_on is wrong';
  end if;
end $$;

-- 2. A member with a code but no age answer does not get in yet.
select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');
do $$ begin
  if public.has_access() then raise exception 'got in without confirming the age'; end if;
  if (select adult from public.my_consents()) then raise exception 'adult before answering'; end if;
  if public.confirm_age((now() at time zone 'Europe/Madrid')::date + 1) <> 'invalid' then raise exception 'future birth date accepted'; end if;
end $$;

-- 3. 18 or over: in. The date itself is not kept.
do $$ begin
  if public.confirm_age(((now() at time zone 'Europe/Madrid')::date - interval '18 years')::date) <> 'ok' then raise exception '18 today was refused'; end if;
  if not public.has_access() then raise exception 'adult member did not get in'; end if;
  if not (select adult from public.my_consents()) then raise exception 'my_consents misses the age'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from information_schema.columns where table_name = 'user_consents' and column_name like '%birth%') > 0 then
    raise exception 'the birth date is stored';
  end if;
  if not exists (select 1 from public.audit_log where action = 'consent.adult') then raise exception 'age not audited'; end if;
end $$;

-- 4. Under 18: kept out, and another date does not change it.
select pg_temp.act_as('b0000000-0000-0000-0000-000000000002');
do $$ begin
  if public.confirm_age(((now() at time zone 'Europe/Madrid')::date - interval '15 years')::date) <> 'minor' then raise exception 'minor not spotted'; end if;
  if public.confirm_age('1990-01-01') <> 'minor' then raise exception 'a minor changed the date to get in'; end if;
  if public.has_access() then raise exception 'minor got in'; end if;
  if not (select under_18 from public.my_consents()) then raise exception 'my_consents misses under 18'; end if;
  begin
    perform public.allow_minor('b0000000-0000-0000-0000-000000000002');
    raise exception 'a member let themselves in';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 5. Staff record a guardian's consent: then they get in. Audited.
select pg_temp.act_as('b0000000-0000-0000-0000-00000000000d');
select public.allow_minor('b0000000-0000-0000-0000-000000000002');
reset role;
select pg_temp.act_as('b0000000-0000-0000-0000-000000000002');
do $$ begin
  if not public.has_access() then raise exception 'guardian consent did not let them in'; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.audit_log where action = 'consent.guardian') then raise exception 'guardian consent not audited'; end if;
end $$;

-- 6. No photo before the photo rules; after accepting, posting works.
select pg_temp.act_as(null);
do $$ begin perform public.today_challenge(); end $$;
reset role;
update public.challenges set opens_at = now() - interval '1 minute' where day = public.challenge_day();
select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name)
select 'oops', 'b0000000-0000-0000-0000-000000000001/' || id || '-a.jpg' from public.challenges where day = public.challenge_day();
do $$
declare c uuid := (select id from public.challenges where day = public.challenge_day());
begin
  begin
    perform public.submit_post(c, 'b0000000-0000-0000-0000-000000000001/' || c || '-a.jpg');
    raise exception 'posted without accepting the photo rules';
  exception when insufficient_privilege then null;
  end;
  perform public.accept_content_rules();
  if not (select content_rules from public.my_consents()) then raise exception 'rules not remembered'; end if;
  perform public.submit_post(c, 'b0000000-0000-0000-0000-000000000001/' || c || '-a.jpg');
end $$;

-- 7. Social media: off until a yes, can be taken back, and only staff list it.
do $$ begin
  if (select social_ok or social_answered from public.my_consents()) then raise exception 'social consent on by default'; end if;
  perform public.set_social_consent(true);
  if not (select social_ok from public.my_consents()) then raise exception 'social yes not saved'; end if;
  begin
    perform public.photos_ok_for_social();
    raise exception 'a member listed photos for social media';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
update public.posts set review = 'approved';
select pg_temp.act_as('b0000000-0000-0000-0000-00000000000d');
do $$ begin
  if (select count(*) from public.photos_ok_for_social()) <> 1 then raise exception 'staff do not see the consented photo'; end if;
end $$;
reset role;
select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');
select public.set_social_consent(false);
reset role;
select pg_temp.act_as('b0000000-0000-0000-0000-00000000000d');
do $$ begin
  if exists (select 1 from public.photos_ok_for_social()) then raise exception 'a withdrawn consent still lists the photo'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from public.audit_log where action = 'consent.social') <> 2 then raise exception 'social answers not audited'; end if;
end $$;

-- 8. Nobody reads the consents table directly.
select pg_temp.act_as('b0000000-0000-0000-0000-000000000001');
do $$ begin
  perform 1 from public.user_consents;
  raise exception 'read the consents table directly';
exception when insufficient_privilege then null;
end $$;
reset role;

\echo consents: all tests passed
