-- UPZZY: private messages between friends. Friends means you follow each
-- other. Only the two people in a conversation can read it, blocking stops
-- new messages both ways, and messages are only written through `send_message`.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- Keep in sync with src/social/rules.ts
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index messages_pair_idx on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);
create index messages_recipient_unread_idx on public.messages (recipient_id) where read_at is null;

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.follows f where f.follower_id = a and f.followed_id = b)
     and exists (select 1 from public.follows f where f.follower_id = b and f.followed_id = a);
$$;

create function public.send_message(p_to uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  result public.messages;
begin
  if me is null then
    raise exception 'Sign in to send messages' using errcode = '42501';
  end if;
  if not public.are_friends(me, p_to) then
    raise exception 'You can only message friends' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = me and b.blocked_id = p_to) or (b.blocker_id = p_to and b.blocked_id = me)
  ) then
    raise exception 'You can only message friends' using errcode = '42501';
  end if;
  -- A little brake on floods: 30 messages a minute is plenty for a person.
  if (select count(*) from public.messages m where m.sender_id = me and m.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many messages, slow down' using errcode = '54000';
  end if;
  insert into public.messages (sender_id, recipient_id, body)
  values (me, p_to, btrim(p_body))
  returning * into result;
  return result;
end;
$$;

-- Marks everything `p_from` sent you as read.
create function public.mark_read(p_from uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.messages set read_at = now()
  where recipient_id = (select auth.uid()) and sender_id = p_from and read_at is null;
$$;

-- Your conversations, newest first, plus friends you have not talked to yet.
create function public.my_chats()
returns table (
  user_id uuid,
  username text,
  last_body text,
  last_at timestamptz,
  last_from_me boolean,
  unread int,
  is_friend boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select (select auth.uid()) as id),
  pairs as (
    select case when m.sender_id = me.id then m.recipient_id else m.sender_id end as other, m.*
    from public.messages m, me
  ),
  latest as (
    select distinct on (other) other, body, created_at, sender_id = (select id from me) as from_me
    from pairs
    order by other, created_at desc
  ),
  friends as (
    select f.followed_id as other
    from public.follows f, me
    where f.follower_id = me.id and public.are_friends(me.id, f.followed_id)
  ),
  everyone as (
    select other from latest union select other from friends
  )
  select
    e.other,
    pr.username,
    l.body,
    l.created_at,
    coalesce(l.from_me, false),
    (select count(*)::int from pairs p where p.other = e.other and p.recipient_id = (select id from me) and p.read_at is null),
    public.are_friends((select id from me), e.other)
  from everyone e
  left join latest l on l.other = e.other
  left join public.profiles pr on pr.id = e.other
  where not exists (select 1 from public.user_blocks b where b.blocker_id = (select id from me) and b.blocked_id = e.other)
  order by l.created_at desc nulls last, pr.username;
$$;

alter table public.messages enable row level security;

create policy "people in a conversation read it"
on public.messages for select
to authenticated
using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.send_message(uuid, text) from public, anon;
revoke execute on function public.mark_read(uuid) from public, anon;
revoke execute on function public.my_chats() from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.my_chats() to authenticated;

-- Live updates in the app (Supabase Realtime). Skipped where Realtime is not installed.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
