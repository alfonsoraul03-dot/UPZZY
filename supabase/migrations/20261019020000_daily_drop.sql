-- UPZZY: the daily drop. The challenge appears at a random time each day,
-- the same for everyone; the sooner you post, the more points. Points,
-- streaks and the monthly ranking are all computed here, never by the app.
-- Also adds photo reactions: you answer someone's photo with a photo.

-- ---------------------------------------------------------------------------
-- Random opening time
-- ---------------------------------------------------------------------------

alter table public.challenges add column opens_at timestamptz;

-- Challenges created before this migration were open from midnight.
update public.challenges
set opens_at = (day::timestamp at time zone 'Europe/Madrid')
where opens_at is null;

alter table public.challenges alter column opens_at set not null;

-- A random moment between 09:00 and 21:00 Madrid time on `p_day`.
create function public.random_open_time(p_day date)
returns timestamptz
language sql
volatile
set search_path = ''
as $$
  select ((p_day + time '09:00') + (random() * interval '12 hours')) at time zone 'Europe/Madrid';
$$;

-- Nobody sees a challenge (not even its title) before it opens, except staff.
drop policy "challenges are public" on public.challenges;
create policy "challenges are public once open"
on public.challenges for select
using (opens_at <= now() or public.has_role('moderator'));

-- Points for posting `p_minutes` after the drop: 100 in the first 5 minutes,
-- then one less every 5 minutes, never below 10. Mirrored in src/social/rules.ts.
create function public.points_for(p_minutes numeric)
returns int
language sql
immutable
set search_path = ''
as $$
  select greatest(10, 100 - floor(greatest(p_minutes - 5, 0) / 5)::int);
$$;

-- Today's challenge, created on first use with a random opening time. Before
-- it opens only `day` and `is_open = false` are returned, so the title stays a surprise.
drop function public.today_challenge();
create function public.today_challenge()
returns table (
  id uuid,
  day date,
  opens_at timestamptz,
  is_open boolean,
  title text,
  description text,
  reward text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.challenge_day();
  c public.challenges;
  prompt record;
begin
  select * into c from public.challenges ch where ch.day = today;
  if not found then
    select p.title, p.description into prompt
    from public.challenge_prompts p
    where p.active
    order by p.id
    offset (
      (today - date '2026-01-01') % greatest((select count(*) from public.challenge_prompts where active), 1)
    )
    limit 1;
    if prompt is null then
      return;
    end if;
    insert into public.challenges (day, title, description, opens_at)
    values (today, prompt.title, prompt.description, public.random_open_time(today))
    on conflict on constraint challenges_day_key do nothing;
    select * into c from public.challenges ch where ch.day = today;
  end if;

  if c.opens_at <= now() then
    return query select c.id, c.day, c.opens_at, true, c.title, c.description, c.reward;
  else
    return query select null::uuid, c.day, null::timestamptz, false, null::text, null::text, null::text;
  end if;
end;
$$;

-- Staff can still pick the day's challenge; the time stays random unless given.
drop function public.schedule_challenge(date, text, text, text);
create function public.schedule_challenge(
  p_day date,
  p_title text,
  p_description text default null,
  p_reward text default null,
  p_opens_at timestamptz default null
)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.challenges;
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can schedule challenges' using errcode = '42501';
  end if;
  if p_day < public.challenge_day() then
    raise exception 'Past challenges cannot be changed' using errcode = '22023';
  end if;
  if exists (select 1 from public.challenges c where c.day = p_day and c.opens_at <= now()) then
    raise exception 'This challenge is already out' using errcode = '22023';
  end if;
  insert into public.challenges (day, title, description, reward, created_by, opens_at)
  values (p_day, p_title, p_description, p_reward, (select auth.uid()), coalesce(p_opens_at, public.random_open_time(p_day)))
  on conflict (day) do update
    set title = excluded.title, description = excluded.description, reward = excluded.reward,
        created_by = excluded.created_by, opens_at = excluded.opens_at
  returning * into result;
  perform public.write_audit('challenge.schedule', 'challenges', result.id::text,
    jsonb_build_object('day', p_day, 'title', p_title, 'reward', p_reward, 'opens_at', result.opens_at));
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Points on posts
-- ---------------------------------------------------------------------------

alter table public.posts add column points int not null default 0 check (points between 0 and 100);

update public.posts p
set points = public.points_for(extract(epoch from (p.created_at - c.opens_at)) / 60)
from public.challenges c
where c.id = p.challenge_id;

create or replace function public.submit_post(p_challenge_id uuid, p_image_path text, p_caption text default null)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  c public.challenges;
  result public.posts;
begin
  if me is null then
    raise exception 'Sign in to post' using errcode = '42501';
  end if;
  select * into c from public.challenges ch
  where ch.id = p_challenge_id and ch.day = public.challenge_day() and ch.opens_at <= now();
  if not found then
    raise exception 'This challenge is closed' using errcode = '22023';
  end if;
  if p_image_path is null or p_image_path not like me::text || '/' || p_challenge_id::text || '-%' then
    raise exception 'Photo must be in your own folder' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'oops' and o.name = p_image_path) then
    raise exception 'Photo not uploaded' using errcode = '22023';
  end if;
  insert into public.posts (user_id, challenge_id, image_path, caption, points)
  values (me, p_challenge_id, p_image_path, nullif(btrim(p_caption), ''),
          public.points_for(extract(epoch from (now() - c.opens_at)) / 60))
  returning * into result;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photo reactions
-- ---------------------------------------------------------------------------

create table public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  image_path text not null unique,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index post_reactions_post_idx on public.post_reactions (post_id, created_at desc);

-- React to a visible post with a photo from your own folder
-- (`<you>/r-<post id>-<random>.jpg`). Reacting again replaces your reaction
-- and returns the old photo's path so the app can delete the file.
create function public.react_to_post(p_post_id uuid, p_image_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  old_path text;
begin
  if me is null then
    raise exception 'Sign in to react' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.posts p
    where p.id = p_post_id and p.status = 'visible'
      and not exists (select 1 from public.user_blocks b where b.blocker_id = p.user_id and b.blocked_id = me)
  ) then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if p_image_path is null or p_image_path not like me::text || '/r-' || p_post_id::text || '-%' then
    raise exception 'Photo must be in your own folder' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'oops' and o.name = p_image_path) then
    raise exception 'Photo not uploaded' using errcode = '22023';
  end if;
  delete from public.post_reactions r where r.post_id = p_post_id and r.user_id = me
  returning r.image_path into old_path;
  insert into public.post_reactions (post_id, user_id, image_path) values (p_post_id, me, p_image_path);
  return old_path;
end;
$$;

alter table public.post_reactions enable row level security;

-- A reaction is visible when its post is (posts RLS applies inside), minus people you blocked.
create policy "reactions on readable posts are readable"
on public.post_reactions for select
using (
  exists (select 1 from public.posts p where p.id = post_id)
  and not exists (
    select 1 from public.user_blocks b
    where b.blocker_id = (select auth.uid()) and b.blocked_id = post_reactions.user_id
  )
);

create policy "users remove their own reactions"
on public.post_reactions for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "photos of readable reactions are readable"
on storage.objects for select
using (
  bucket_id = 'oops'
  and exists (select 1 from public.post_reactions r where r.image_path = name)
);

revoke all on public.post_reactions from anon, authenticated;
grant select on public.post_reactions to anon, authenticated;
grant delete on public.post_reactions to authenticated;

-- ---------------------------------------------------------------------------
-- Reading: feed, profile stats, ranking
-- ---------------------------------------------------------------------------

-- The most recent challenge that is already out (today's, or yesterday's
-- while today's is still a secret).
create function public.latest_challenge()
returns setof public.challenges
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.challenges c
  where c.opens_at <= now()
  order by c.day desc
  limit 1;
$$;

drop function public.challenge_feed(uuid, text, timestamptz, int);
create function public.challenge_feed(
  p_challenge_id uuid,
  p_scope text default 'global',
  p_before timestamptz default null,
  p_limit int default 20
)
returns table (
  id uuid,
  user_id uuid,
  username text,
  image_path text,
  caption text,
  points int,
  created_at timestamptz,
  following boolean,
  reaction_count int,
  reactions jsonb,
  my_reaction text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    p.user_id,
    pr.username,
    p.image_path,
    p.caption,
    p.points,
    p.created_at,
    exists (select 1 from public.follows f where f.followed_id = p.user_id and f.follower_id = (select auth.uid())),
    (select count(*)::int from public.post_reactions r where r.post_id = p.id),
    coalesce((
      select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'username', x.username, 'image_path', x.image_path) order by x.created_at desc)
      from (
        select r.user_id, rp.username, r.image_path, r.created_at
        from public.post_reactions r
        left join public.profiles rp on rp.id = r.user_id
        where r.post_id = p.id
        order by r.created_at desc
        limit 6
      ) x
    ), '[]'::jsonb),
    (select r.image_path from public.post_reactions r where r.post_id = p.id and r.user_id = (select auth.uid()))
  from public.posts p
  left join public.profiles pr on pr.id = p.user_id
  where p.challenge_id = p_challenge_id
    and p.status = 'visible'
    and (p_before is null or p.created_at < p_before)
    and (
      p_scope = 'global'
      or (p_scope = 'friends' and (
        p.user_id = (select auth.uid())
        or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = p.user_id)
      ))
    )
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.month_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', now() at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid';
$$;

-- Streak: days in a row with a visible post, ending today or (if today's is
-- not posted yet) yesterday.
create function public.user_stats(p_user_id uuid)
returns table (
  username text,
  streak int,
  month_points int,
  total_points int,
  posts int,
  following boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  days date[];
  expected date := public.challenge_day();
  n int := 0;
  d date;
begin
  select array_agg(c.day order by c.day desc) into days
  from public.posts p join public.challenges c on c.id = p.challenge_id
  where p.user_id = p_user_id and p.status = 'visible';

  if days is not null then
    if days[1] < expected then
      expected := expected - 1;
    end if;
    foreach d in array days loop
      exit when d <> expected;
      n := n + 1;
      expected := expected - 1;
    end loop;
  end if;

  return query
  select
    (select pr.username from public.profiles pr where pr.id = p_user_id),
    n,
    coalesce((select sum(p.points)::int from public.posts p where p.user_id = p_user_id and p.status = 'visible' and p.created_at >= public.month_start()), 0),
    coalesce((select sum(p.points)::int from public.posts p where p.user_id = p_user_id and p.status = 'visible'), 0),
    (select count(*)::int from public.posts p where p.user_id = p_user_id and p.status = 'visible'),
    exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = p_user_id);
end;
$$;

-- This month's points. 'friends' is you plus the people you follow.
create function public.monthly_ranking(p_scope text default 'global', p_limit int default 50)
returns table (
  rank int,
  user_id uuid,
  username text,
  points int,
  posts int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (rank() over (order by sum(p.points) desc))::int,
    p.user_id,
    pr.username,
    sum(p.points)::int,
    count(*)::int
  from public.posts p
  left join public.profiles pr on pr.id = p.user_id
  where p.status = 'visible'
    and p.created_at >= public.month_start()
    and (
      p_scope = 'global'
      or (p_scope = 'friends' and (
        p.user_id = (select auth.uid())
        or exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = p.user_id)
      ))
    )
  group by p.user_id, pr.username
  order by sum(p.points) desc, min(p.created_at)
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.random_open_time(date) from public, anon, authenticated;
revoke execute on function public.today_challenge() from public;
revoke execute on function public.schedule_challenge(date, text, text, text, timestamptz) from public, anon;
revoke execute on function public.react_to_post(uuid, text) from public, anon;
grant execute on function public.today_challenge() to anon, authenticated;
grant execute on function public.schedule_challenge(date, text, text, text, timestamptz) to authenticated;
grant execute on function public.react_to_post(uuid, text) to authenticated;
grant execute on function public.points_for(numeric) to anon, authenticated;
grant execute on function public.latest_challenge() to anon, authenticated;
grant execute on function public.challenge_feed(uuid, text, timestamptz, int) to anon, authenticated;
grant execute on function public.month_start() to anon, authenticated;
grant execute on function public.user_stats(uuid) to anon, authenticated;
grant execute on function public.monthly_ranking(text, int) to anon, authenticated;
