-- UPZZY: a push to every member's phone the minute the daily challenge drops.
-- Phones save their Expo push token here. Every minute the database checks
-- whether today's challenge has opened and, once per challenge, sends the push
-- through Expo's push service (pg_cron + pg_net, both built into Supabase).

create table public.push_tokens (
  -- Like ExponentPushToken[xxxxxxxx]. One phone, one token.
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default clock_timestamp()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.challenges add column notified_at timestamptz;

alter table public.push_tokens enable row level security;

create policy "users see their own phones"
on public.push_tokens for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on public.push_tokens from anon, authenticated;
grant select on public.push_tokens to authenticated;

-- Save this phone for the signed-in user. A phone that changes account moves
-- with it. Old phones beyond the last 5 are dropped.
create function public.save_push_token(p_token text, p_platform text)
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
  insert into public.push_tokens (token, user_id, platform)
  values (p_token, me, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = clock_timestamp();
  delete from public.push_tokens t
  where t.user_id = me
    and t.token not in (
      select k.token from public.push_tokens k where k.user_id = me order by k.updated_at desc, k.token limit 5
    );
end;
$$;

-- Signing out stops the pushes on that phone.
create function public.remove_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$$;

-- Once per challenge: if today's has opened (in the last 2 hours, so a late
-- start never sends a stale push), mark it notified and return who to tell.
-- Only members with access get it. Called by the scheduler, never by the app.
create function public.claim_drop_push()
returns table (challenge_id uuid, title text, max_points int, tokens text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
begin
  -- Makes sure today's challenge exists, with its random opening time.
  perform public.today_challenge();
  update public.challenges ch
  set notified_at = now()
  where ch.day = public.challenge_day()
    and ch.notified_at is null
    and ch.opens_at <= now()
    and ch.opens_at > now() - interval '2 hours'
  returning * into c;
  if c.id is null then
    return;
  end if;
  perform public.write_audit('challenge.push', 'challenges', c.id::text, '{}'::jsonb);
  return query
  select c.id, c.title, c.max_points, coalesce(array_agg(t.token order by t.token), '{}')
  from public.push_tokens t
  join public.members m on m.user_id = t.user_id;
end;
$$;

-- Sends the claimed push through Expo, 100 phones per request.
create function public.send_drop_push()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  d record;
  batch text[];
  sent int := 0;
begin
  select * into d from public.claim_drop_push();
  if d.challenge_id is null then
    return 0;
  end if;
  for i in 0 .. coalesce(array_length(d.tokens, 1), 0) - 1 by 100 loop
    batch := d.tokens[i + 1 : i + 100];
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := (
        select jsonb_agg(jsonb_build_object(
          'to', tok,
          'title', 'time to upzzy.',
          'body', d.title || ' · ' || d.max_points || ' pts if you post now.',
          'sound', 'default',
          'priority', 'high',
          'channelId', 'drop',
          'data', jsonb_build_object('url', '/')
        ))
        from unnest(batch) tok
      )
    );
    sent := sent + array_length(batch, 1);
  end loop;
  return sent;
end;
$$;

revoke execute on function public.save_push_token(text, text) from public, anon;
revoke execute on function public.remove_push_token(text) from public, anon;
revoke execute on function public.claim_drop_push() from public, anon, authenticated;
revoke execute on function public.send_drop_push() from public, anon, authenticated;
grant execute on function public.save_push_token(text, text) to authenticated;
grant execute on function public.remove_push_token(text) to authenticated;

-- Every minute on Supabase. Plain PostgreSQL (the tests) has neither
-- extension, so this part only runs where they exist.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
    create extension if not exists pg_cron;
    perform cron.schedule('upzzy-drop-push', '* * * * *', 'select public.send_drop_push()');
  end if;
end $$;
