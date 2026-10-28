-- UPZZY: photos stay out of global and friends until staff approve them.
--   * Everyone else (the feed, profiles, photo files) sees a photo only once
--     staff found an UPZZY piece in it. The owner sees theirs right away,
--     marked "upzzy check pending"; staff see everything to check it.
--   * Likes and selfie reactions wait for the check too, so nothing piles up
--     on a photo nobody can see yet.

drop policy "members read visible posts" on public.posts;
create policy "members read visible posts"
on public.posts for select
using (
  (
    status = 'visible'
    and review = 'approved'
    and public.has_access()
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = (select auth.uid()) and b.blocked_id = posts.user_id
    )
  )
  or user_id = (select auth.uid())
  or public.has_role('moderator')
);

create or replace function public.challenge_feed(
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
    -- Others see a photo once staff found UPZZY in it; you see yours at once.
    and (p.review = 'approved' or p.user_id = (select auth.uid()))
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

create function public.require_approved_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts p where p.id = new.post_id and p.review = 'approved') then
    raise exception 'This photo is waiting for the upzzy check' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger post_likes_require_approved before insert on public.post_likes
for each row execute function public.require_approved_post();
create trigger post_reactions_require_approved before insert on public.post_reactions
for each row execute function public.require_approved_post();
