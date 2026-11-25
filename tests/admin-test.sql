\set ON_ERROR_STOP 1
-- run after supabase-stubs.sql + schema.sql + admin.sql (see docs/DEPLOYMENT.md)
-- A = admin, B = host with data, C = another host
insert into auth.users(id, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@example.com'),
  ('b0000000-0000-0000-0000-00000000000b', 'host.b@example.com'),
  ('c0000000-0000-0000-0000-00000000000c', 'host.c@example.com') on conflict do nothing;
select 'profiles made by trigger', count(*) from public.profiles where user_id in ('a0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-00000000000b','c0000000-0000-0000-0000-00000000000c');
-- the owner makes the first admin in the SQL editor
-- the owner makes themselves Super Admin (the first run of admin.sql does this for the oldest admin)
update public.profiles set role = 'super_admin' where user_id = (select id from auth.users where email = 'admin@example.com');

-- host B makes and publishes an invitation, gets a reply
set role authenticated; select set_config('request.jwt.uid','b0000000-0000-0000-0000-00000000000b',false);
insert into invitations(id, owner_id, slug, status, data, published, published_at)
values ('bbbbbbbb-0000-0000-0000-000000000001','b0000000-0000-0000-0000-00000000000b','b-wedding','published','{"defaultLang":"en","category":"wedding","text":{"en":{"title":"Aarav weds Diya"}}}','{"text":{"en":{"title":"Aarav weds Diya"}}}', now());
reset role; set role anon; select set_config('request.jwt.uid','',false);
select 'guest reply', public.submit_rsvp('b-wedding','{"name":"Rakesh","phone":"9876543210","status":"yes","adults":2,"children":1,"consent":true}')->>'status';
reset role;

-- a host cannot see admin data or call admin functions
set role authenticated; select set_config('request.jwt.uid','c0000000-0000-0000-0000-00000000000c',false);
select 'host C my_account', public.my_account();
do $$ begin perform public.admin_users(); raise exception 'FAIL: host called admin_users'; exception when insufficient_privilege then raise notice 'ok: admin_users refused for host'; end $$;
do $$ begin perform public.admin_delete_invitation('bbbbbbbb-0000-0000-0000-000000000001'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'ok: admin_delete_invitation refused for host'; end $$;
do $$ begin perform public._admin_log('x','x','x','x'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'ok: _admin_log not callable'; end $$;
do $$ begin update public.profiles set role = 'admin' where user_id = auth.uid(); raise exception 'FAIL: host updated own role'; exception when insufficient_privilege then raise notice 'ok: host cannot make self admin'; end $$;
select 'host C sees only own profile', count(*) from public.profiles;
do $$ begin perform count(*) from public.admin_log; raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'ok: admin_log not readable'; end $$;
reset role;
set role anon;
do $$ begin perform public.admin_usage(); raise exception 'FAIL: anon'; exception when insufficient_privilege then raise notice 'ok: anon refused'; end $$;
reset role;

-- the admin uses the admin functions
set role authenticated; select set_config('request.jwt.uid','a0000000-0000-0000-0000-00000000000a',false);
select 'admin my_account', public.my_account();
select 'admin own invitations via table (expect 0)', count(*) from invitations;
select 'users total', public.admin_users()->'total';
select 'users search', jsonb_path_query_array(public.admin_users('host.b')->'rows', '$[*].email');
select 'user B counts', (select r from jsonb_array_elements(public.admin_users('host.b')->'rows') r) - 'id' - 'created_at' - 'last_edit';
select 'invitations', (jsonb_path_query_array(public.admin_invitations()->'rows', '$[*] ? (@.slug == "b-wedding")') -> 0) - 'created_at' - 'updated_at' - 'published_at' - 'owner_id' - 'id';
select 'grant tries', public.admin_grant_ai_tries('b0000000-0000-0000-0000-00000000000b', 5, 'bought pack');
do $$ begin perform public.admin_grant_ai_tries('b0000000-0000-0000-0000-00000000000b', 0); raise exception 'FAIL'; exception when raise_exception then raise notice 'ok: zero tries refused'; end $$;
do $$ begin perform public.admin_set_role('a0000000-0000-0000-0000-00000000000a', 'host'); raise exception 'FAIL'; exception when raise_exception then raise notice 'ok: cannot change own role'; end $$;
do $$ begin perform public.admin_set_user_status('a0000000-0000-0000-0000-00000000000a', 'suspended'); raise exception 'FAIL'; exception when raise_exception then raise notice 'ok: cannot suspend self'; end $$;
select 'suspend B + unpublish', public.admin_set_user_status('b0000000-0000-0000-0000-00000000000b', 'suspended', 'spam', true);
reset role;

-- suspended B is locked out; guests see the invitation is gone; no AI tries
set role authenticated; select set_config('request.jwt.uid','b0000000-0000-0000-0000-00000000000b',false);
select 'B my_account', public.my_account();
select 'B sees own invitations (expect 0)', count(*) from invitations;
do $$ begin insert into invitations(owner_id, data) values (auth.uid(), '{}'); raise exception 'FAIL: suspended insert'; exception when insufficient_privilege then raise notice 'ok: suspended host cannot create'; end $$;
reset role;
set role anon; select 'guest view after unpublish', public.get_public_invitation('b-wedding')->>'status'; reset role;
set role service_role; select 'AI try while suspended', public.ai_take_try('b0000000-0000-0000-0000-00000000000b'); reset role;

-- re-activate; B sees their data again (still a draft) and AI works
set role authenticated; select set_config('request.jwt.uid','a0000000-0000-0000-0000-00000000000a',false);
select 'activate B', public.admin_set_user_status('b0000000-0000-0000-0000-00000000000b', 'active');
select 'make C admin', public.admin_set_role('c0000000-0000-0000-0000-00000000000c', 'admin');
reset role;
set role authenticated; select set_config('request.jwt.uid','b0000000-0000-0000-0000-00000000000b',false);
select 'B sees own after activate', count(*), min(status) from invitations;
reset role;
set role service_role; select 'AI try after activate', public.ai_take_try('b0000000-0000-0000-0000-00000000000b')->'ok'; reset role;

-- C is now admin and can see the log; then deletes the invitation
set role authenticated; select set_config('request.jwt.uid','c0000000-0000-0000-0000-00000000000c',false);
select 'C admin unpublish (already draft)', public.admin_unpublish_invitation('bbbbbbbb-0000-0000-0000-000000000001', 'check')->'ok';
select 'delete', public.admin_delete_invitation('bbbbbbbb-0000-0000-0000-000000000001', 'requested by host')->'ok';
select 'usage totals', public.admin_usage(4)->'totals';
select 'usage weeks', jsonb_array_length(public.admin_usage(4)->'weeks');
select 'log', a->>'admin_email', a->>'action', a->>'target_label', a->'details' from jsonb_array_elements(public.admin_activity(20)->'rows') a order by (a->>'id')::int;
select 'log filter user.*', public.admin_activity(50,0,'user.')->'total';
reset role;
select 'rsvps left after delete', count(*) from rsvps where invitation_id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- Super Admin rules: a plain admin cannot make admins or touch the Super Admin, and the log is append-only
set role authenticated; select set_config('request.jwt.uid','c0000000-0000-0000-0000-00000000000c',false);
do $$ begin perform public.admin_set_role('b0000000-0000-0000-0000-00000000000b', 'admin'); raise exception 'FAIL: plain admin made an admin'; exception when insufficient_privilege then raise notice 'ok: only Super Admin makes admins'; end $$;
do $$ begin perform public.admin_set_user_status('a0000000-0000-0000-0000-00000000000a', 'suspended'); raise exception 'FAIL: plain admin paused Super Admin'; exception when insufficient_privilege then raise notice 'ok: plain admin cannot pause the Super Admin'; end $$;
select 'C is_super_admin', public.is_super_admin();
reset role;
do $$ begin update public.admin_log set action = 'x'; raise exception 'FAIL: log edited'; exception when insufficient_privilege then raise notice 'ok: admin_log is append-only'; end $$;
