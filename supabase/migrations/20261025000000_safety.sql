-- UPZZY: what the App Store and Google Play ask of apps with people's photos.
-- Staff get a queue of reported photos to act on (keep, remove, or ban the
-- person), and a banned person loses access for good: no new code brings
-- them back, and their photos come down.

create table public.bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  banned_by uuid references auth.users (id) on delete set null,
  banned_at timestamptz not null default now()
);

alter table public.bans enable row level security;
create policy "staff read bans"
on public.bans for select
to authenticated
using (public.has_role('moderator'));
revoke all on public.bans from anon, authenticated;
grant select on public.bans to authenticated;

-- When staff last looked at a photo's reports. Newer reports bring it back.
alter table public.posts add column reports_checked_at timestamptz;

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
  )
  or public.has_role('moderator');
$$;

-- Same as before, plus: a banned person cannot get back in with a new code.
create or replace function public.redeem_code(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  row public.garment_codes;
begin
  if me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.bans b where b.user_id = me) then
    return 'banned';
  end if;
  if exists (select 1 from public.members m where m.user_id = me) then
    return 'ok';
  end if;
  if (select count(*) from public.code_attempts a where a.user_id = me and a.at > now() - interval '1 hour') >= 10 then
    return 'wait';
  end if;
  if clean like 'UPZ%' and length(clean) = 13 then
    clean := substr(clean, 4);
  end if;
  select * into row from public.garment_codes g where g.code = clean for update;
  if row.code is null or row.redeemed_at is not null then
    insert into public.code_attempts (user_id) values (me);
    return case when row.code is null then 'unknown' else 'used' end;
  end if;
  update public.garment_codes set redeemed_by = me, redeemed_at = now() where code = clean;
  insert into public.members (user_id, code) values (me, clean);
  perform public.write_audit('codes.redeem', 'garment_codes', clean, '{}'::jsonb);
  return 'ok';
end;
$$;

-- Moderating a photo also marks its reports as looked at.
create or replace function public.moderate_post(p_post_id uuid, p_status public.post_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can moderate posts' using errcode = '42501';
  end if;
  update public.posts set status = p_status, reports_checked_at = now() where id = p_post_id;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('post.moderate', 'posts', p_post_id::text, jsonb_build_object('status', p_status));
end;
$$;

-- Staff: reported photos nobody has looked at since their last report, oldest first.
create function public.report_queue()
returns table (
  post_id uuid,
  user_id uuid,
  username text,
  image_path text,
  caption text,
  status public.post_status,
  reports int,
  reasons text[],
  first_report_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.user_id, pr.username, p.image_path, p.caption, p.status,
         count(r.*)::int, array_agg(distinct r.reason), min(r.created_at)
  from public.posts p
  join public.post_reports r on r.post_id = p.id
  left join public.profiles pr on pr.id = p.user_id
  where public.has_role('moderator')
    and p.status <> 'removed'
    and r.created_at > coalesce(p.reports_checked_at, '-infinity')
  group by p.id, pr.username
  order by min(r.created_at)
  limit 50;
$$;

-- Staff: ban someone. Their photos come down, their phones stop getting pushes.
create function public.ban_user(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can ban' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = p_user_id) then
    raise exception 'Staff cannot be banned here' using errcode = '22023';
  end if;
  insert into public.bans (user_id, reason, banned_by)
  values (p_user_id, nullif(btrim(p_reason), ''), (select auth.uid()))
  on conflict (user_id) do nothing;
  update public.posts set status = 'removed', reports_checked_at = now() where user_id = p_user_id;
  delete from public.push_tokens where user_id = p_user_id;
  perform public.write_audit('user.ban', 'bans', p_user_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Staff: undo a ban made by mistake. Photos stay down; staff restore them one by one.
create function public.unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can unban' using errcode = '42501';
  end if;
  delete from public.bans where user_id = p_user_id;
  perform public.write_audit('user.unban', 'bans', p_user_id::text, '{}'::jsonb);
end;
$$;

revoke execute on function public.report_queue() from public, anon;
revoke execute on function public.ban_user(uuid, text) from public, anon;
revoke execute on function public.unban_user(uuid) from public, anon;
grant execute on function public.report_queue() to authenticated;
grant execute on function public.ban_user(uuid, text) to authenticated;
grant execute on function public.unban_user(uuid) to authenticated;
