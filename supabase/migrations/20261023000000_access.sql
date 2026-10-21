-- UPZZY: only people who bought a piece get in. Every piece ships with a
-- one-time code inside the package. Redeeming it unlocks the
-- account for good. Staff get in without a code. Without access you cannot
-- see photos, rankings or profiles, nor post, react, like, follow or message.

-- ---------------------------------------------------------------------------
-- Staff from the SQL Editor
-- ---------------------------------------------------------------------------

-- The Supabase SQL Editor runs as the database owner with no app user, so it
-- counts as staff (it could change any table anyway). App requests always
-- arrive as `authenticator` with a role set, and cannot pretend to be the owner.
create or replace function public.has_role(required public.app_role)
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
  )
  or (
    (select auth.uid()) is null
    and session_user in ('postgres', 'supabase_admin')
    -- No `set role` in effect: API requests and tests always switch role.
    and current_setting('role') = 'none'
  );
$$;

-- ---------------------------------------------------------------------------
-- Codes and members
-- ---------------------------------------------------------------------------

create table public.garment_codes (
  -- Like UPZ-7K3M-Q9TX. Stored without dashes, upper case.
  code text primary key check (code ~ '^[A-Z0-9]{8,16}$'),
  -- Which packages the code went into, for your own records: "drop 001 tees".
  batch text check (char_length(batch) <= 80),
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz
);

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text references public.garment_codes (code) on delete set null,
  unlocked_at timestamptz not null default now()
);

-- Failed tries, to stop guessing codes.
create table public.code_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index code_attempts_user_idx on public.code_attempts (user_id, at);

-- People already in the app before this rule keep their access.
insert into public.members (user_id) select id from public.profiles on conflict do nothing;

create function public.has_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.members m where m.user_id = (select auth.uid()))
    or public.has_role('moderator');
$$;

-- No ambiguous characters (0/O, 1/I/L).
create function public.new_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 10);
$$;

-- Staff: make `p_count` new codes to print. Returns them formatted UPZ-XXXXX-XXXXX.
create function public.create_codes(p_count int, p_batch text default null)
returns table (code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  made text[] := '{}';
  c text;
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can make codes' using errcode = '42501';
  end if;
  if p_count < 1 or p_count > 1000 then
    raise exception 'Make between 1 and 1000 codes at a time' using errcode = '22023';
  end if;
  while coalesce(array_length(made, 1), 0) < p_count loop
    c := public.new_code();
    insert into public.garment_codes (code, batch) values (c, p_batch) on conflict do nothing;
    if found then
      made := made || c;
    end if;
  end loop;
  perform public.write_audit('codes.create', 'garment_codes', null, jsonb_build_object('count', p_count, 'batch', p_batch));
  return query select 'UPZ-' || substr(m, 1, 5) || '-' || substr(m, 6) from unnest(made) m;
end;
$$;

-- Unlock your account with the code from your piece. One use per code.
-- Returns 'ok', 'used' (someone already used it), 'unknown' or 'wait' (too
-- many wrong tries in the last hour). Wrong tries are kept, so it returns
-- instead of raising (an error would undo the record).
create function public.redeem_code(p_code text)
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
  if exists (select 1 from public.members m where m.user_id = me) then
    return 'ok';
  end if;
  if (select count(*) from public.code_attempts a where a.user_id = me and a.at > now() - interval '1 hour') >= 10 then
    return 'wait';
  end if;
  -- Codes are printed with an UPZ prefix; accept them with or without it.
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

alter table public.garment_codes enable row level security;
alter table public.members enable row level security;
alter table public.code_attempts enable row level security;

create policy "staff read codes"
on public.garment_codes for select
to authenticated
using (public.has_role('moderator'));

create policy "users see their own membership"
on public.members for select
to authenticated
using (user_id = (select auth.uid()) or public.has_role('moderator'));

revoke all on public.garment_codes, public.members, public.code_attempts from anon, authenticated;
grant select on public.garment_codes, public.members to authenticated;

-- ---------------------------------------------------------------------------
-- Locking the app
-- ---------------------------------------------------------------------------

-- Anything an app user creates needs access. Inserts made by the owner
-- (SQL Editor, seeds) have no app user and pass.
create function public.require_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.has_access() then
    raise exception 'Unlock upzzy with the code from your piece' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger posts_require_access before insert on public.posts for each row execute function public.require_access();
create trigger post_reactions_require_access before insert on public.post_reactions for each row execute function public.require_access();
create trigger post_likes_require_access before insert on public.post_likes for each row execute function public.require_access();
create trigger follows_require_access before insert on public.follows for each row execute function public.require_access();
create trigger messages_require_access before insert on public.messages for each row execute function public.require_access();

-- Photos (and through them the feed, reactions and photo files) are for members.
drop policy "posts are readable when visible" on public.posts;
create policy "members read visible posts"
on public.posts for select
using (
  (
    status = 'visible'
    and public.has_access()
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = posts.user_id
    )
  )
  or user_id = (select auth.uid())
  or public.has_role('moderator')
);

-- Profiles' points and the ranking too.
create or replace function public.monthly_ranking(p_scope text default 'global', p_limit int default 50)
returns table (
  rank int,
  user_id uuid,
  username text,
  points int,
  posts int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (rank() over (order by s.challenge_points + s.like_points + s.friend_points desc))::int,
    s.user_id,
    pr.username,
    (s.challenge_points + s.like_points + s.friend_points)::int,
    s.posts
  from public.scores_since(public.month_start()) s
  join public.profiles pr on pr.id = s.user_id
  where public.has_access()
    and s.challenge_points + s.like_points + s.friend_points > 0
    and (
      p_scope = 'global'
      or (p_scope = 'friends' and (
        s.user_id = (select auth.uid())
        or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = s.user_id)
      ))
    )
  order by 1, pr.username
  limit least(greatest(p_limit, 1), 100);
$$;

alter function public.user_stats(uuid) rename to user_stats_unchecked;
revoke execute on function public.user_stats_unchecked(uuid) from public, anon, authenticated;

create function public.user_stats(p_user_id uuid)
returns table (
  username text,
  streak int,
  month_points int,
  total_points int,
  pending_points int,
  posts int,
  friends int,
  following boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.user_stats_unchecked(p_user_id)
  where public.has_access() or p_user_id = (select auth.uid());
$$;

revoke execute on function public.new_code() from public, anon, authenticated;
revoke execute on function public.require_access() from public, anon, authenticated;
revoke execute on function public.create_codes(int, text) from public, anon;
revoke execute on function public.redeem_code(text) from public, anon;
revoke execute on function public.has_access() from public;
grant execute on function public.create_codes(int, text) to authenticated;
grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.has_access() to anon, authenticated;
grant execute on function public.user_stats(uuid) to anon, authenticated;
grant execute on function public.monthly_ranking(text, int) to anon, authenticated;
