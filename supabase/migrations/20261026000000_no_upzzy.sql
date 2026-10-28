-- UPZZY: a photo without an UPZZY piece comes down.
--   * When staff answer "no upzzy", the photo leaves the feed, the profile
--     and the points at once (status 'removed'). The owner still sees it was
--     theirs, so the app can tell them "UPZZZZ. you made a mistake".
--   * That day is spent: one photo per challenge (already a unique key), and
--     a rejected photo cannot be deleted to post again.
--   * Approving it after all (a misclick) brings it back, unless the person
--     was banned in the meantime.

create or replace function public.review_post(p_post_id uuid, p_has_upzzy boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.posts;
begin
  if not public.has_role('moderator') then
    raise exception 'Only staff can check photos' using errcode = '42501';
  end if;
  select * into was from public.posts where id = p_post_id for update;
  if was.id is null then
    raise exception 'Post not found' using errcode = 'P0002';
  end if;
  if p_has_upzzy then
    update public.posts
    set review = 'approved',
        status = case
          when was.review = 'rejected' and was.status = 'removed'
            and not exists (select 1 from public.bans b where b.user_id = was.user_id)
          then 'visible'::public.post_status
          else status
        end
    where id = p_post_id;
  else
    update public.posts set review = 'rejected', status = 'removed' where id = p_post_id;
  end if;
  perform public.write_audit('post.review', 'posts', p_post_id::text, jsonb_build_object('has_upzzy', p_has_upzzy));
end;
$$;

-- Deleting a rejected photo would free the day for a second try.
drop policy "owners delete their posts" on public.posts;
create policy "owners delete their posts"
on public.posts for delete
to authenticated
using (user_id = (select auth.uid()) and review <> 'rejected');
