-- UPZZY foundation: profiles, staff roles and an append-only audit log.
--
-- Security model
--   * Row Level Security is enabled on every table. Clients use the anon key
--     and can only do what the policies below allow.
--   * Staff roles live in their own table that clients cannot write. Roles are
--     granted through `public.grant_role`, which checks the caller is an admin
--     and writes an audit entry in the same transaction.
--   * The audit log is append-only: UPDATE and DELETE are blocked by trigger
--     even for the table owner, so history cannot be rewritten casually.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'moderator');
create type public.profile_visibility as enum ('public', 'members', 'private');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Keep in sync with src/lib/validation.ts
  username text not null unique
    check (username ~ '^[a-z0-9][a-z0-9_.]{1,22}[a-z0-9]$' and username !~ '[_.]{2}'),
  display_name text check (char_length(display_name) between 1 and 40),
  bio text check (char_length(bio) <= 160),
  city text check (char_length(city) <= 60),
  avatar_path text,
  visibility public.profile_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user, created automatically on sign-up.';
comment on column public.profiles.city is 'Optional, free text. Never store precise location here.';

-- ---------------------------------------------------------------------------
-- Staff roles
-- ---------------------------------------------------------------------------

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_target_idx on public.audit_log (target_table, target_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

comment on table public.audit_log is 'Append-only record of sensitive actions (prizes, founder allocations, score adjustments, commissions, role changes).';

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- True when the current user holds `required`. Admins implicitly hold every role.
create function public.has_role(required public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid())
      and (r.role = required or r.role = 'admin')
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

-- Internal: write an audit entry. Not callable by clients.
create function public.write_audit(p_action text, p_target_table text, p_target_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_table, target_id, details)
  values ((select auth.uid()), p_action, p_target_table, p_target_id, coalesce(p_details, '{}'::jsonb));
$$;

create function public.grant_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can grant roles' using errcode = '42501';
  end if;
  insert into public.user_roles (user_id, role, granted_by)
  values (p_user_id, p_role, (select auth.uid()))
  on conflict do nothing;
  perform public.write_audit('role.grant', 'user_roles', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

create function public.revoke_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can revoke roles' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) and p_role = 'admin' then
    raise exception 'Admins cannot remove their own admin role' using errcode = '42501';
  end if;
  delete from public.user_roles where user_id = p_user_id and role = p_role;
  perform public.write_audit('role.revoke', 'user_roles', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Clients may edit their own profile, but never its id or timestamps.
create function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id or new.created_at <> old.created_at then
    raise exception 'id and created_at cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_columns
before update on public.profiles
for each row execute function public.protect_profile_columns();

-- Create a profile for every new auth user with a unique placeholder username.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  -- Random suffix, retried on the (very unlikely) chance it is already taken.
  loop
    candidate := 'member' || substr(md5(new.id::text || clock_timestamp()::text || random()::text), 1, 12);
    begin
      insert into public.profiles (id, username) values (new.id, candidate);
      return new;
    exception when unique_violation then
      if exists (select 1 from public.profiles where id = new.id) then
        return new;
      end if;
    end;
  end loop;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create function public.forbid_audit_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;

create trigger audit_log_append_only
before update or delete on public.audit_log
for each row execute function public.forbid_audit_changes();

create trigger audit_log_no_truncate
before truncate on public.audit_log
for each statement execute function public.forbid_audit_changes();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: public profiles are visible to everyone, members-only profiles to
-- signed-in users, private profiles only to their owner and staff. Friends
-- visibility is added with friendships in Phase 4.
create policy "profiles are readable according to visibility"
on public.profiles for select
using (
  visibility = 'public'
  or (visibility = 'members' and (select auth.uid()) is not null)
  or id = (select auth.uid())
  or public.has_role('moderator')
);

create policy "users update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- No insert policy: profiles are created by the sign-up trigger.
-- No delete policy: deleting the auth user cascades (account deletion, Phase 2).

create policy "users see their own roles, admins see all"
on public.user_roles for select
to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy "admins read the audit log"
on public.audit_log for select
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on public.user_roles, public.audit_log from anon, authenticated;
grant select on public.user_roles, public.audit_log to authenticated;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (username, display_name, bio, city, avatar_path, visibility) on public.profiles to authenticated;

revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.grant_role(uuid, public.app_role) from public, anon;
revoke execute on function public.revoke_role(uuid, public.app_role) from public, anon;
grant execute on function public.grant_role(uuid, public.app_role) to authenticated;
grant execute on function public.revoke_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(public.app_role) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
