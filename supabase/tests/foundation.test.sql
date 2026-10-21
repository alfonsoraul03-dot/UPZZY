-- Behavioural tests for 20261019000000_foundation.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

-- Fixtures (as superuser)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@test'),
  ('00000000-0000-0000-0000-00000000000c', 'carl@test');
-- Everyone here bought a piece (access.test.sql covers people who did not).
insert into public.members (user_id) select id from auth.users on conflict do nothing;
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin');
update public.profiles set visibility = 'private' where id = '00000000-0000-0000-0000-00000000000c';

-- 1. Sign-up creates a profile with a valid placeholder username.
do $$
begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'expected 3 auto-created profiles'; end if;
  if exists (select 1 from public.profiles where username !~ '^member[0-9a-f]{12}$') then raise exception 'bad placeholder username'; end if;
end $$;

-- 2. Anonymous visitors only see public profiles and cannot write.
select pg_temp.act_as(null);
do $$
begin
  if (select count(*) from public.profiles) <> 2 then raise exception 'anon should see 2 public profiles'; end if;
  begin
    update public.profiles set bio = 'x';
    raise exception 'anon update should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 3. Private profiles are hidden from other members but visible to owner and admin.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000c') then raise exception 'private profile leaked'; end if;
end $$;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$ begin
  if not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000c') then raise exception 'owner cannot see own profile'; end if;
end $$;
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  if (select count(*) from public.profiles) <> 3 then raise exception 'admin should see all profiles'; end if;
end $$;
reset role;

-- 4. Users can edit only their own profile, within the validation rules.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.profiles set username = 'bea_upzzy', bio = 'Hi' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set bio = 'hacked' where id = '00000000-0000-0000-0000-00000000000a';
do $$
begin
  if (select username from public.profiles where id = '00000000-0000-0000-0000-00000000000b') <> 'bea_upzzy' then raise exception 'own update failed'; end if;
  begin
    update public.profiles set username = 'Bad Name' where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'invalid username accepted';
  exception when check_violation then null;
  end;
  begin
    update public.profiles set created_at = now() - interval '1 year' where id = '00000000-0000-0000-0000-00000000000b';
    raise exception 'created_at should not be writable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, username) values (gen_random_uuid(), 'sneaky');
    raise exception 'direct profile insert should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if (select bio from public.profiles where id = '00000000-0000-0000-0000-00000000000a') is not null then raise exception 'updated someone else''s profile'; end if;
end $$;

-- 5. Members cannot give themselves roles or read the audit log.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$
begin
  if public.is_admin() then raise exception 'member is admin'; end if;
  begin
    insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000b', 'admin');
    raise exception 'self-grant via insert succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.grant_role('00000000-0000-0000-0000-00000000000b', 'admin');
    raise exception 'self-grant via function succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.write_audit('fake.entry', null, null);
    raise exception 'client wrote to audit log';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.audit_log) then raise exception 'member can read audit log'; end if;
  if (select count(*) from public.user_roles) <> 0 then raise exception 'member sees other roles'; end if;
end $$;
reset role;

-- 6. Admins grant and revoke roles, and every change is audited.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.grant_role('00000000-0000-0000-0000-00000000000b', 'moderator');
do $$
begin
  if (select count(*) from public.audit_log where action = 'role.grant') <> 1 then raise exception 'grant not audited'; end if;
  begin
    perform public.revoke_role('00000000-0000-0000-0000-00000000000a', 'admin');
    raise exception 'admin removed own admin role';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 7. Moderators can see private profiles; role is effective immediately.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  if not public.has_role('moderator') then raise exception 'moderator role missing'; end if;
  if public.has_role('admin') then raise exception 'moderator should not be admin'; end if;
  if not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000c') then raise exception 'moderator cannot see private profile'; end if;
end $$;
reset role;

-- 8. The audit log is append-only, even for the database owner.
do $$
begin
  begin
    update public.audit_log set action = 'role.tampered';
    raise exception 'audit update succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.audit_log;
    raise exception 'audit delete succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 9. Deleting an account removes the profile (App Store account deletion).
delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  if exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000c') then raise exception 'profile survived account deletion'; end if;
end $$;

\echo 'foundation: all tests passed'
