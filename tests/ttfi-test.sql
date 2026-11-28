-- v2.4: time-to-first-invitation in Admin → Usage. Run after supabase/admin.sql, tests/admin-test.sql
-- and tests/rsvp-questions-test.sql (it reuses their invitations and admin C).
\set ON_ERROR_STOP 1
update invitations set created_at = now() - interval '12 minutes', published_at = now() - interval '9 minutes' where slug = 'kabir';
update invitations set created_at = now() - interval '40 minutes', published_at = now() - interval '33 minutes' where slug = 'meera-q';
-- the same host's second invitation, published later, must not count as their first
insert into invitations(id, owner_id, slug, status, data, created_at, published_at)
values ('aaaaaaaa-0000-0000-0000-000000000009','33333333-3333-3333-3333-333333333333','meera-2','published','{}', now() - interval '2 days', now() - interval '1 minute')
on conflict (id) do nothing;
set role authenticated; select set_config('request.jwt.uid','c0000000-0000-0000-0000-00000000000c',false);
do $$
declare t jsonb := public.admin_usage(4)->'totals';
begin
  assert (t->>'ttfi_median_min')::numeric = 5.0, 'median of 3 and 7 minutes should be 5, got ' || t::text;
  assert (t->>'ttfi_hosts')::int = 2, 'two hosts published a first invitation';
  raise notice 'time to first invitation: all checks passed';
end $$;
reset role;
