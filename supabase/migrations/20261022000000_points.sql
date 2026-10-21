-- UPZZY: new points.
--   * Each day's challenge is worth a random amount, up to 500. Posting fast
--     still matters: the sooner you post, the bigger the share you get.
--   * Challenges are about wearing UPZZY. Staff check every photo: without an
--     UPZZY piece in it, the photo earns nothing (not even its likes).
--   * Each like on a checked photo is +1 point. You cannot like your own.
--   * Each friend (you follow each other) is +10 points.
-- Everything is computed here; the app only shows it.

-- ---------------------------------------------------------------------------
-- Random value per challenge
-- ---------------------------------------------------------------------------

-- 100, 150, ... 500.
create function public.random_max_points()
returns int
language sql
volatile
set search_path = ''
as $$
  select 100 + floor(random() * 9)::int * 50;
$$;

alter table public.challenges
  add column max_points int not null default 100 check (max_points between 10 and 500);
alter table public.challenges alter column max_points set default public.random_max_points();

-- What a post is worth `p_minutes` after the drop: the full value in the first
-- 5 minutes, then the share from `points_for` (100% down to 10%). Mirrored in src/social/rules.ts.
create function public.post_points(p_max int, p_minutes numeric)
returns int
language sql
immutable
set search_path = ''
as $$
  select round(p_max * public.points_for(p_minutes) / 100.0)::int;
$$;

alter table public.posts drop constraint posts_points_check;
alter table public.posts add constraint posts_points_check check (points between 0 and 500);

-- ---------------------------------------------------------------------------
-- UPZZY check
-- ---------------------------------------------------------------------------

create type public.post_review as enum ('pending', 'approved', 'rejected');

alter table public.posts add column review public.post_review not null default 'pending';
-- Photos posted before this rule existed keep their points.
update public.posts set review = 'approved';

create index posts_pending_idx on public.posts (created_at) where review = 'pending';

-- Staff decide whether an UPZZY piece shows in the photo. Audited.
create function public.review_post(p_post_id uuid, p_has_upzzy boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can check photos' using errcode = '42501';
  end if;
  update public.posts
  set review = case when p_has_upzzy then 'approved' else 'rejected' end::public.post_review
  where id = p_post_id;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('post.review', 'posts', p_post_id::text, jsonb_build_object('has_upzzy', p_has_upzzy));
end;
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('moderator');
$$;

-- ---------------------------------------------------------------------------
-- Likes: never your own photo
-- ---------------------------------------------------------------------------

drop policy "users like visible posts" on public.post_likes;
create policy "users like other people's visible posts"
on public.post_likes for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.posts p
    where p.id = post_id and p.status = 'visible' and p.user_id <> (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Posting uses the challenge's value
-- ---------------------------------------------------------------------------

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
          public.post_points(c.max_points, extract(epoch from (now() - c.opens_at)) / 60))
  returning * into result;
  return result;
end;
$$;

-- Today's challenge now also says what it is worth.
drop function public.today_challenge();
create function public.today_challenge()
returns table (
  id uuid,
  day date,
  opens_at timestamptz,
  is_open boolean,
  title text,
  description text,
  reward text,
  max_points int
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
    return query select c.id, c.day, c.opens_at, true, c.title, c.description, c.reward, c.max_points;
  else
    return query select null::uuid, c.day, null::timestamptz, false, null::text, null::text, null::text, null::int;
  end if;
end;
$$;

-- Staff can set the value too; otherwise it is random.
drop function public.schedule_challenge(date, text, text, text, timestamptz);
create function public.schedule_challenge(
  p_day date,
  p_title text,
  p_description text default null,
  p_reward text default null,
  p_opens_at timestamptz default null,
  p_max_points int default null
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
  insert into public.challenges (day, title, description, reward, created_by, opens_at, max_points)
  values (p_day, p_title, p_description, p_reward, (select auth.uid()),
          coalesce(p_opens_at, public.random_open_time(p_day)), coalesce(p_max_points, public.random_max_points()))
  on conflict (day) do update
    set title = excluded.title, description = excluded.description, reward = excluded.reward,
        created_by = excluded.created_by, opens_at = excluded.opens_at, max_points = excluded.max_points
  returning * into result;
  perform public.write_audit('challenge.schedule', 'challenges', result.id::text,
    jsonb_build_object('day', p_day, 'title', p_title, 'reward', p_reward, 'opens_at', result.opens_at, 'max_points', result.max_points));
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Challenges about wearing UPZZY
-- ---------------------------------------------------------------------------

update public.challenge_prompts set active = false;
insert into public.challenge_prompts (title, description) values
  ('your upzzy, upside down.', 'wear it, hang it, flip it. the piece has to show.'),
  ('the fit check.', 'full outfit, head to toe. upzzy in it.'),
  ('upzzy in the wild.', 'a street, a park, a bus. the piece has to show.'),
  ('inside out on purpose.', 'wear your upzzy the wrong way. own it.'),
  ('two upzzys, one photo.', 'you and a friend, both wearing it.'),
  ('upzzy, close up.', 'the print, the tag, the stitch.'),
  ('upzzy at golden hour.', 'the last light of the day on your piece.'),
  ('upzzy on the move.', 'running, riding, walking. no posing.'),
  ('upzzy where nobody expects it.', 'the weirdest place you can wear it.'),
  ('upzzy and your pet.', 'or your plant. or your gran.'),
  ('one mistake, one upzzy.', 'something gone wrong, and your piece next to it.'),
  ('upzzy at work.', 'the desk, the shop, the kitchen. piece on.');

-- ---------------------------------------------------------------------------
-- Feed: likes and the check
-- ---------------------------------------------------------------------------

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
  review public.post_review,
  like_count int,
  liked boolean,
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
    p.review,
    p.like_count,
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())),
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

-- ---------------------------------------------------------------------------
-- Scores
-- ---------------------------------------------------------------------------

-- Points earned since `p_since`, per person:
--   challenge: checked photos (their value), likes: likes on those photos,
--   friends: 10 per friendship made since then (the later of the two follows).
-- Internal: follows are private, so only the totals leave through the functions below.
create function public.scores_since(p_since timestamptz)
returns table (user_id uuid, challenge_points int, like_points int, friend_points int, posts int)
language sql
stable
security definer
set search_path = ''
as $$
  with photo as (
    select p.user_id, sum(p.points)::int as challenge_points, sum(p.like_count)::int as like_points, count(*)::int as posts
    from public.posts p
    where p.status = 'visible' and p.review = 'approved' and p.created_at >= p_since
    group by p.user_id
  ),
  friend as (
    select a.follower_id as user_id, (count(*) * 10)::int as friend_points
    from public.follows a
    join public.follows b on b.follower_id = a.followed_id and b.followed_id = a.follower_id
    where greatest(a.created_at, b.created_at) >= p_since
    group by a.follower_id
  )
  select
    coalesce(photo.user_id, friend.user_id),
    coalesce(photo.challenge_points, 0),
    coalesce(photo.like_points, 0),
    coalesce(friend.friend_points, 0),
    coalesce(photo.posts, 0)
  from photo
  full join friend on friend.user_id = photo.user_id;
$$;

-- Streak: days in a row with a visible photo that was not turned down.
drop function public.user_stats(uuid);
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
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  days date[];
  expected date := public.challenge_day();
  n int := 0;
  d date;
  month record;
  ever record;
begin
  select array_agg(c.day order by c.day desc) into days
  from public.posts p join public.challenges c on c.id = p.challenge_id
  where p.user_id = p_user_id and p.status = 'visible' and p.review <> 'rejected';

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

  select * into month from public.scores_since(public.month_start()) s where s.user_id = p_user_id;
  select * into ever from public.scores_since('-infinity') s where s.user_id = p_user_id;

  return query
  select
    (select pr.username from public.profiles pr where pr.id = p_user_id),
    n,
    coalesce(month.challenge_points + month.like_points + month.friend_points, 0),
    coalesce(ever.challenge_points + ever.like_points + ever.friend_points, 0),
    coalesce((select sum(p.points)::int from public.posts p where p.user_id = p_user_id and p.status = 'visible' and p.review = 'pending'), 0),
    (select count(*)::int from public.posts p where p.user_id = p_user_id and p.status = 'visible'),
    coalesce(ever.friend_points / 10, 0),
    exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = p_user_id);
end;
$$;

-- This month's points. 'friends' is you plus the people you follow.
drop function public.monthly_ranking(text, int);
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
  where s.challenge_points + s.like_points + s.friend_points > 0
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

revoke execute on function public.random_max_points() from public, anon, authenticated;
revoke execute on function public.scores_since(timestamptz) from public, anon, authenticated;
revoke execute on function public.review_post(uuid, boolean) from public, anon;
revoke execute on function public.today_challenge() from public;
revoke execute on function public.schedule_challenge(date, text, text, text, timestamptz, int) from public, anon;
grant execute on function public.review_post(uuid, boolean) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.post_points(int, numeric) to anon, authenticated;
grant execute on function public.today_challenge() to anon, authenticated;
grant execute on function public.schedule_challenge(date, text, text, text, timestamptz, int) to authenticated;
grant execute on function public.challenge_feed(uuid, text, timestamptz, int) to anon, authenticated;
grant execute on function public.user_stats(uuid) to anon, authenticated;
grant execute on function public.monthly_ranking(text, int) to anon, authenticated;
