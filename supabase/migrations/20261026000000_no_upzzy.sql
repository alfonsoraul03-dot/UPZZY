-- UPZZY: a photo without an UPZZY piece is deleted.
--   * When staff answer "no upzzy", the photo leaves the feed, profiles and
--     points at once (status 'removed'), and the staff app deletes the photo
--     file itself. Only a bare record stays, so the day stays spent and the
--     owner's app can say "UPZZZZ. you made a mistake".
--   * That day is spent: one photo per challenge (already a unique key), and
--     a rejected photo cannot be deleted to post again.
--   * There is no undo: the file is gone, so a rejected photo cannot be
--     approved later.

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
  if was.review = 'rejected' then
    raise exception 'This photo was rejected and deleted' using errcode = '22023';
  end if;
  if p_has_upzzy then
    update public.posts set review = 'approved' where id = p_post_id;
  else
    update public.posts set review = 'rejected', status = 'removed' where id = p_post_id;
  end if;
  perform public.write_audit('post.review', 'posts', p_post_id::text, jsonb_build_object('has_upzzy', p_has_upzzy));
end;
$$;

-- Deleting a rejected photo's record would free the day for a second try.
drop policy "owners delete their posts" on public.posts;
create policy "owners delete their posts"
on public.posts for delete
to authenticated
using (user_id = (select auth.uid()) and review <> 'rejected');

-- Staff delete the file of a photo they rejected (owners can already delete their own).
create policy "staff delete rejected photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'oops'
  and public.has_role('moderator')
  and exists (select 1 from public.posts p where p.image_path = name and p.review = 'rejected')
);
