-- UPZZY: age, photo rules and social media consent.
--   * upzzy is 18+. People confirm their age with their birth date; only the
--     fact that they are 18+ is kept, never the date. Under 18 is marked, and
--     only staff can let them in, after a parent or guardian gave consent by
--     email. Members need one of the two to get in (has_access).
--   * Before the first photo, people accept the photo rules: fit for all
--     ages, nothing inappropriate. Posting checks it.
--   * Sharing someone's photos on UPZZY's social media needs their own yes.
--     It is optional (EU law: consent has to be free), off until they say
--     yes, and they can take it back any time. The time of each answer is kept.
-- Every answer is written to audit_log.

create table public.user_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  adult_at timestamptz,
  under_18_at timestamptz,
  guardian_ok_at timestamptz,
  guardian_ok_by uuid references auth.users (id) on delete set null,
  content_rules_at timestamptz,
  social_ok boolean,
  social_answered_at timestamptz
);

alter table public.user_consents enable row level security;
-- Read and written only through the functions below.
revoke all on public.user_consents from anon, authenticated;

-- Age in whole years on `p_today` (Madrid), for someone born on `p_birth`. Mirrored in src/social/rules.ts.
create function public.age_on(p_birth date, p_today date)
returns int
language sql
immutable
set search_path = ''
as $$
  select extract(year from age(p_today, p_birth))::int;
$$;

-- Returns 'ok' (18+), 'minor' (under 18, or marked under 18 before) or 'invalid'.
create function public.confirm_age(p_birth date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  today date := (now() at time zone 'Europe/Madrid')::date;
  c public.user_consents;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_birth is null or p_birth > today or p_birth < date '1900-01-01' then
    return 'invalid';
  end if;
  select * into c from public.user_consents where user_id = me;
  if c.adult_at is not null or c.guardian_ok_at is not null then
    return 'ok';
  end if;
  -- Once under 18, a different date does not change it: staff decide.
  if c.under_18_at is not null then
    return 'minor';
  end if;
  if public.age_on(p_birth, today) >= 18 then
    insert into public.user_consents (user_id, adult_at) values (me, now())
    on conflict (user_id) do update set adult_at = now();
    perform public.write_audit('consent.adult', 'user_consents', me::text, '{}'::jsonb);
    return 'ok';
  end if;
  insert into public.user_consents (user_id, under_18_at) values (me, now())
  on conflict (user_id) do update set under_18_at = now();
  perform public.write_audit('consent.minor', 'user_consents', me::text, '{}'::jsonb);
  return 'minor';
end;
$$;

create function public.accept_content_rules()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  insert into public.user_consents (user_id, content_rules_at) values (me, now())
  on conflict (user_id) do update set content_rules_at = coalesce(public.user_consents.content_rules_at, now());
  perform public.write_audit('consent.content_rules', 'user_consents', me::text, '{}'::jsonb);
end;
$$;

create function public.set_social_consent(p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if p_ok is null then
    raise exception 'Answer yes or no' using errcode = '22023';
  end if;
  insert into public.user_consents (user_id, social_ok, social_answered_at) values (me, p_ok, now())
  on conflict (user_id) do update set social_ok = p_ok, social_answered_at = now();
  perform public.write_audit('consent.social', 'user_consents', me::text, jsonb_build_object('ok', p_ok));
end;
$$;

-- What the app needs to know about you. Staff count as adults.
create function public.my_consents()
returns table (adult boolean, under_18 boolean, content_rules boolean, social_ok boolean, social_answered boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(c.adult_at is not null or c.guardian_ok_at is not null, false) or public.has_role('moderator'),
    coalesce(c.under_18_at is not null and c.adult_at is null and c.guardian_ok_at is null, false),
    coalesce(c.content_rules_at is not null, false),
    coalesce(c.social_ok, false),
    coalesce(c.social_answered_at is not null, false)
  from (select 1) one
  left join public.user_consents c on c.user_id = (select auth.uid());
$$;

-- Staff: a parent or guardian gave consent by email for someone under 18.
create function public.allow_minor(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can do this' using errcode = '42501';
  end if;
  insert into public.user_consents (user_id, guardian_ok_at, guardian_ok_by) values (p_user_id, now(), (select auth.uid()))
  on conflict (user_id) do update set guardian_ok_at = now(), guardian_ok_by = (select auth.uid());
  perform public.write_audit('consent.guardian', 'user_consents', p_user_id::text, '{}'::jsonb);
end;
$$;

-- Staff: approved challenge photos whose owners said yes to social media.
create function public.photos_ok_for_social(p_limit int default 100)
returns table (post_id uuid, user_id uuid, username text, image_path text, caption text, created_at timestamptz, consent_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can see this' using errcode = '42501';
  end if;
  return query
  select p.id, p.user_id, pr.username, p.image_path, p.caption, p.created_at, c.social_answered_at
  from public.posts p
  join public.user_consents c on c.user_id = p.user_id and c.social_ok
  left join public.profiles pr on pr.id = p.user_id
  where p.status = 'visible' and p.review = 'approved'
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 500);
end;
$$;

-- Members also need to be 18+ (or have a guardian's consent). Staff as before.
create or replace function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    exists (select 1 from public.members m where m.user_id = (select auth.uid()))
    and not exists (select 1 from public.bans b where b.user_id = (select auth.uid()))
    and exists (
      select 1 from public.user_consents c
      where c.user_id = (select auth.uid()) and (c.adult_at is not null or c.guardian_ok_at is not null)
    )
  )
  or public.has_role('moderator');
$$;

-- No photo before the photo rules were accepted.
create function public.require_content_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_consents c where c.user_id = new.user_id and c.content_rules_at is not null) then
    raise exception 'Accept the photo rules first' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger posts_require_content_rules before insert on public.posts
for each row execute function public.require_content_rules();

revoke execute on function public.confirm_age(date) from public, anon;
revoke execute on function public.accept_content_rules() from public, anon;
revoke execute on function public.set_social_consent(boolean) from public, anon;
revoke execute on function public.my_consents() from public, anon;
revoke execute on function public.allow_minor(uuid) from public, anon;
revoke execute on function public.photos_ok_for_social(int) from public, anon;
revoke execute on function public.require_content_rules() from public, anon, authenticated;
grant execute on function public.confirm_age(date) to authenticated;
grant execute on function public.accept_content_rules() to authenticated;
grant execute on function public.set_social_consent(boolean) to authenticated;
grant execute on function public.my_consents() to authenticated;
grant execute on function public.allow_minor(uuid) to authenticated;
grant execute on function public.photos_ok_for_social(int) to authenticated;
