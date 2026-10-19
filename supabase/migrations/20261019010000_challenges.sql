-- UPZZY step 1: the daily photo challenge, its feed, likes, follows,
-- reports and blocks.
--
-- Security model
--   * One challenge per day, in Europe/Madrid time. Staff schedule challenges
--     with `schedule_challenge`; days nobody scheduled are filled from
--     `challenge_prompts` the first time someone opens the app.
--   * Posts are only created through `submit_post`, which checks the challenge
--     is today's, the photo was uploaded to the caller's own folder, and the
--     caller has not already posted today.
--   * Photos live in the private `oops` bucket. Anyone can read a photo that
--     belongs to a visible post; nobody can read hidden ones except the owner
--     and staff.
--   * Counters (likes, reports) are kept by triggers, never by the client.
--     Three reports hide a post until a moderator looks at it. Moderation and
--     account deletion write to audit_log.
--   * The app only opens the camera for challenge photos, but the server cannot
--     prove a photo is new or genuine. Anything with a prize attached needs
--     human review on top of this.

-- ---------------------------------------------------------------------------
-- Audit log fix
-- ---------------------------------------------------------------------------

-- The audit log is append-only, so "on delete set null" on the actor would be
-- an UPDATE and block deleting any account that ever did something audited.
-- Keep the actor's id as plain history instead.
alter table public.audit_log drop constraint audit_log_actor_id_fkey;

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------

create function public.challenge_day()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Madrid')::date;
$$;

create table public.challenge_prompts (
  id int generated always as identity primary key,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 280),
  active boolean not null default true
);

comment on table public.challenge_prompts is 'Pool used for days without a scheduled challenge. Edit or add rows in the dashboard.';

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 280),
  -- Shown as written. Null means there is no prize for this challenge.
  reward text check (char_length(reward) <= 140),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.challenge_prompts (title, description) values
  ('your upzzy, somewhere new.', 'a place you have never worn it before.'),
  ('one thing out of line.', 'find it, shoot it.'),
  ('with someone you love.', 'a friend, your gran, your dog.'),
  ('sunrise. no filter.', 'up early on purpose.'),
  ('your city, wearing upzzy.', 'the street you walk every day.'),
  ('something upside down.', 'wrong side up. stayed that way.'),
  ('doing the thing you love.', 'mid-action. no posing.'),
  ('a typo in the wild.', 'a sign, a menu, a label.'),
  ('at the beach, in upzzy.', 'sand counts. sea counts.'),
  ('the print moved.', 'anything slightly off register.'),
  ('on the road.', 'a train, a bus, a long walk.'),
  ('calm, clean, one mistake.', 'the whole idea, in one photo.');

-- Today's challenge, created from the prompt pool when nobody scheduled one.
create function public.today_challenge()
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.challenge_day();
  result public.challenges;
  prompt record;
begin
  select * into result from public.challenges where day = today;
  if found then
    return result;
  end if;

  select p.title, p.description into prompt
  from public.challenge_prompts p
  where p.active
  order by p.id
  offset (
    (today - date '2026-01-01') % greatest((select count(*) from public.challenge_prompts where active), 1)
  )
  limit 1;

  if prompt is null then
    return null;
  end if;

  insert into public.challenges (day, title, description)
  values (today, prompt.title, prompt.description)
  on conflict (day) do nothing;

  select * into result from public.challenges where day = today;
  return result;
end;
$$;

create function public.schedule_challenge(p_day date, p_title text, p_description text default null, p_reward text default null)
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
  insert into public.challenges (day, title, description, reward, created_by)
  values (p_day, p_title, p_description, p_reward, (select auth.uid()))
  on conflict (day) do update
    set title = excluded.title, description = excluded.description, reward = excluded.reward, created_by = excluded.created_by
  returning * into result;
  perform public.write_audit('challenge.schedule', 'challenges', result.id::text,
    jsonb_build_object('day', p_day, 'title', p_title, 'reward', p_reward));
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

create type public.post_status as enum ('visible', 'hidden', 'removed');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  image_path text not null unique,
  -- Keep in sync with src/social/rules.ts
  caption text check (char_length(caption) <= 80),
  status public.post_status not null default 'visible',
  like_count int not null default 0,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create index posts_challenge_created_idx on public.posts (challenge_id, created_at desc);

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_reports (
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('spam', 'nudity', 'hate', 'violence', 'other')),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

create table public.follows (
  follower_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  followed_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create index follows_followed_idx on public.follows (followed_id);

create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create function public.submit_post(p_challenge_id uuid, p_image_path text, p_caption text default null)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  result public.posts;
begin
  if me is null then
    raise exception 'Sign in to post' using errcode = '42501';
  end if;
  if not exists (select 1 from public.challenges c where c.id = p_challenge_id and c.day = public.challenge_day()) then
    raise exception 'This challenge is closed' using errcode = '22023';
  end if;
  if p_image_path is null or p_image_path not like me::text || '/' || p_challenge_id::text || '-%' then
    raise exception 'Photo must be in your own folder' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'oops' and o.name = p_image_path) then
    raise exception 'Photo not uploaded' using errcode = '22023';
  end if;
  insert into public.posts (user_id, challenge_id, image_path, caption)
  values (me, p_challenge_id, p_image_path, nullif(btrim(p_caption), ''))
  returning * into result;
  return result;
end;
$$;

create function public.moderate_post(p_post_id uuid, p_status public.post_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can moderate posts' using errcode = '42501';
  end if;
  update public.posts set status = p_status where id = p_post_id;
  if not found then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('post.moderate', 'posts', p_post_id::text, jsonb_build_object('status', p_status));
end;
$$;

create function public.count_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger post_likes_count
after insert or delete on public.post_likes
for each row execute function public.count_like();

create function public.count_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reports int;
begin
  update public.posts set report_count = report_count + 1 where id = new.post_id
  returning report_count into reports;
  if reports >= 3 then
    update public.posts set status = 'hidden' where id = new.post_id and status = 'visible';
    if found then
      perform public.write_audit('post.auto_hide', 'posts', new.post_id::text, jsonb_build_object('reports', reports));
    end if;
  end if;
  return null;
end;
$$;

create trigger post_reports_count
after insert on public.post_reports
for each row execute function public.count_report();

create function public.delete_account()
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
  perform public.write_audit('account.delete', 'auth.users', me::text, '{}'::jsonb);
  delete from auth.users where id = me;
end;
$$;

-- The feed for one challenge. `p_scope` is 'global' or 'friends' (people the
-- caller follows). Runs with the caller's rights, so every RLS rule applies.
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
  like_count int,
  created_at timestamptz,
  liked boolean,
  following boolean
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
    p.like_count,
    p.created_at,
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = (select auth.uid())),
    exists (select 1 from public.follows f where f.followed_id = p.user_id and f.follower_id = (select auth.uid()))
  from public.posts p
  left join public.profiles pr on pr.id = p.user_id
  where p.challenge_id = p_challenge_id
    and p.status = 'visible'
    and (p_before is null or p.created_at < p_before)
    and (
      p_scope = 'global'
      or (p_scope = 'friends' and exists (
        select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followed_id = p.user_id
      ))
    )
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.challenge_prompts enable row level security;
alter table public.challenges enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_reports enable row level security;
alter table public.follows enable row level security;
alter table public.user_blocks enable row level security;

create policy "staff read the prompt pool"
on public.challenge_prompts for select
to authenticated
using (public.has_role('moderator'));

create policy "challenges are public"
on public.challenges for select
using (true);

-- Visible posts are public, minus people you blocked. Owners and staff also
-- see hidden ones.
create policy "posts are readable when visible"
on public.posts for select
using (
  (
    status = 'visible'
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = posts.user_id
    )
  )
  or user_id = (select auth.uid())
  or public.has_role('moderator')
);

create policy "owners delete their posts"
on public.posts for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "users see their own likes"
on public.post_likes for select
to authenticated
using (user_id = (select auth.uid()));

create policy "users like visible posts"
on public.post_likes for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.posts p where p.id = post_id and p.status = 'visible')
);

create policy "users remove their own likes"
on public.post_likes for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "users report posts"
on public.post_reports for insert
to authenticated
with check (reporter_id = (select auth.uid()));

create policy "staff read reports"
on public.post_reports for select
to authenticated
using (public.has_role('moderator'));

create policy "users see follows that involve them"
on public.follows for select
to authenticated
using (follower_id = (select auth.uid()) or followed_id = (select auth.uid()));

create policy "users follow others"
on public.follows for insert
to authenticated
with check (follower_id = (select auth.uid()));

create policy "users unfollow"
on public.follows for delete
to authenticated
using (follower_id = (select auth.uid()));

create policy "users see their own blocks"
on public.user_blocks for select
to authenticated
using (blocker_id = (select auth.uid()));

create policy "users block others"
on public.user_blocks for insert
to authenticated
with check (blocker_id = (select auth.uid()));

create policy "users unblock"
on public.user_blocks for delete
to authenticated
using (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Photo storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oops', 'oops', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- Paths look like `<user id>/<challenge id>-<random>.jpg`.
create policy "users upload to their own folder"
on storage.objects for insert
to authenticated
with check (bucket_id = 'oops' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "users delete their own photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'oops' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Uses the posts policy above, so hidden posts' photos stay private.
create policy "photos of readable posts are readable"
on storage.objects for select
using (
  bucket_id = 'oops'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.posts p where p.image_path = name)
  )
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on public.challenge_prompts, public.challenges, public.posts, public.post_likes,
  public.post_reports, public.follows, public.user_blocks from anon, authenticated;

grant select on public.challenge_prompts to authenticated;
grant select on public.challenges to anon, authenticated;
grant select on public.posts to anon, authenticated;
grant delete on public.posts to authenticated;
grant select, insert, delete on public.post_likes, public.follows, public.user_blocks to authenticated;
-- Anon needs to be able to look (and find nothing) when the feed and the posts
-- policy check likes, follows and blocks; the policies above only match signed-in users.
grant select on public.post_likes, public.follows, public.user_blocks to anon;
grant select, insert on public.post_reports to authenticated;

revoke execute on function public.today_challenge() from public;
revoke execute on function public.schedule_challenge(date, text, text, text) from public, anon;
revoke execute on function public.submit_post(uuid, text, text) from public, anon;
revoke execute on function public.moderate_post(uuid, public.post_status) from public, anon;
revoke execute on function public.delete_account() from public, anon;
revoke execute on function public.count_like() from public, anon, authenticated;
revoke execute on function public.count_report() from public, anon, authenticated;
grant execute on function public.challenge_day() to anon, authenticated;
grant execute on function public.today_challenge() to anon, authenticated;
grant execute on function public.challenge_feed(uuid, text, timestamptz, int) to anon, authenticated;
grant execute on function public.schedule_challenge(date, text, text, text) to authenticated;
grant execute on function public.submit_post(uuid, text, text) to authenticated;
grant execute on function public.moderate_post(uuid, public.post_status) to authenticated;
grant execute on function public.delete_account() to authenticated;
