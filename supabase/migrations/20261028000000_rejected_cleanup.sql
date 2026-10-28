-- Photos rejected before 20261026000000_no_upzzy.sql were only marked, not
-- taken down. Take them down like any rejection: out of the feed, profiles
-- and points. (Their files are deleted from the staff app or the dashboard.)
update public.posts set status = 'removed' where review = 'rejected' and status <> 'removed';
