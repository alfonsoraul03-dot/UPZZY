-- Behavioural tests for 20261021000000_messages.sql.
-- Each block raises an exception on failure; psql runs with ON_ERROR_STOP.

\set ON_ERROR_STOP on
set client_min_messages = warning;

create function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  if uid is null then execute 'set role anon'; else execute 'set role authenticated'; end if;
end $$;

insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001', 'uno@test'),
  ('30000000-0000-0000-0000-000000000002', 'dos@test'),
  ('30000000-0000-0000-0000-000000000003', 'tres@test');
-- Everyone here bought a piece (access.test.sql covers people who did not).
insert into public.members (user_id) select id from auth.users on conflict do nothing;
update public.profiles set username = 'uno' where id = '30000000-0000-0000-0000-000000000001';
update public.profiles set username = 'dos' where id = '30000000-0000-0000-0000-000000000002';
update public.profiles set username = 'tres' where id = '30000000-0000-0000-0000-000000000003';

-- 1. Following one way is not enough: friends follow each other.
select pg_temp.act_as('30000000-0000-0000-0000-000000000001');
insert into public.follows (followed_id) values ('30000000-0000-0000-0000-000000000002');
do $$ begin
  if (select count(*) from public.my_chats()) <> 0 then raise exception 'one-way follow listed as a friend'; end if;
  begin
    perform public.send_message('30000000-0000-0000-0000-000000000002', 'hola');
    raise exception 'messaged someone who does not follow back';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.act_as('30000000-0000-0000-0000-000000000002');
insert into public.follows (followed_id) values ('30000000-0000-0000-0000-000000000001');
reset role;

-- 2. Friends can message; empty or huge messages are refused; nobody inserts directly.
select pg_temp.act_as('30000000-0000-0000-0000-000000000001');
do $$ begin
  if (select count(*) from public.my_chats() where user_id = '30000000-0000-0000-0000-000000000002' and is_friend and last_body is null) <> 1 then
    raise exception 'new friend should appear with no messages yet';
  end if;
  if (public.send_message('30000000-0000-0000-0000-000000000002', '  hola  ')).body <> 'hola' then raise exception 'message not trimmed'; end if;
  begin
    perform public.send_message('30000000-0000-0000-0000-000000000002', '   ');
    raise exception 'sent an empty message';
  exception when check_violation then null;
  end;
  begin
    perform public.send_message('30000000-0000-0000-0000-000000000002', repeat('a', 1001));
    raise exception 'sent a message over 1000 characters';
  exception when check_violation then null;
  end;
  begin
    insert into public.messages (sender_id, recipient_id, body) values ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'x');
    raise exception 'inserted a message directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.messages set body = 'edited';
    raise exception 'edited a message';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 3. The recipient sees it unread, then reads it.
select pg_temp.act_as('30000000-0000-0000-0000-000000000002');
do $$
declare c record;
begin
  select * into c from public.my_chats() where user_id = '30000000-0000-0000-0000-000000000001';
  if c.unread <> 1 or c.last_body <> 'hola' or c.last_from_me or c.username <> 'uno' then raise exception 'chat list wrong: %', c; end if;
  perform public.send_message('30000000-0000-0000-0000-000000000001', 'qué tal');
  perform public.mark_read('30000000-0000-0000-0000-000000000001');
  select * into c from public.my_chats() where user_id = '30000000-0000-0000-0000-000000000001';
  if c.unread <> 0 or c.last_body <> 'qué tal' or not c.last_from_me then raise exception 'after reading: %', c; end if;
end $$;
reset role;
select pg_temp.act_as('30000000-0000-0000-0000-000000000001');
do $$ begin
  if (select read_at from public.messages where body = 'hola') is null then raise exception 'read_at not set'; end if;
  if (select unread from public.my_chats() where user_id = '30000000-0000-0000-0000-000000000002') <> 1 then raise exception 'uno should have 1 unread'; end if;
end $$;
reset role;

-- 4. Outsiders cannot read the conversation.
select pg_temp.act_as('30000000-0000-0000-0000-000000000003');
do $$ begin
  if exists (select 1 from public.messages) then raise exception 'outsider read messages'; end if;
  if exists (select 1 from public.my_chats()) then raise exception 'outsider sees chats'; end if;
  perform public.mark_read('30000000-0000-0000-0000-000000000001');
end $$;
reset role;
select pg_temp.act_as(null);
do $$ begin
  begin
    perform 1 from public.messages;
    raise exception 'anon read messages';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 5. Blocking stops messages both ways and hides the chat for the blocker.
select pg_temp.act_as('30000000-0000-0000-0000-000000000002');
insert into public.user_blocks (blocked_id) values ('30000000-0000-0000-0000-000000000001');
do $$ begin
  if exists (select 1 from public.my_chats() where user_id = '30000000-0000-0000-0000-000000000001') then raise exception 'blocked chat still listed'; end if;
  begin
    perform public.send_message('30000000-0000-0000-0000-000000000001', 'hey');
    raise exception 'blocker sent a message';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select pg_temp.act_as('30000000-0000-0000-0000-000000000001');
do $$ begin
  begin
    perform public.send_message('30000000-0000-0000-0000-000000000002', 'hey');
    raise exception 'blocked person sent a message';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
delete from public.user_blocks;

-- 6. A brake on floods: 30 a minute.
select pg_temp.act_as('30000000-0000-0000-0000-000000000001');
do $$ begin
  for i in 1..29 loop
    perform public.send_message('30000000-0000-0000-0000-000000000002', 'spam ' || i);
  end loop;
  begin
    perform public.send_message('30000000-0000-0000-0000-000000000002', 'one too many');
    raise exception 'flood not limited';
  exception when program_limit_exceeded then null;
  end;
end $$;
reset role;

\echo messages: all tests passed
