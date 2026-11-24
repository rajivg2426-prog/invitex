\set ON_ERROR_STOP 1
-- run after supabase-stubs.sql + schema.sql (see docs/DEPLOYMENT.md)
insert into auth.users values ('33333333-3333-3333-3333-333333333333'), ('44444444-4444-4444-4444-444444444444') on conflict do nothing;
-- the signed-in user sees their own allowance
set role authenticated; select set_config('request.jwt.uid','33333333-3333-3333-3333-333333333333',false);
select 'fresh user', public.my_ai_credits();
-- users cannot take tries themselves or raise their limit
do $$ begin perform public.ai_take_try('33333333-3333-3333-3333-333333333333'); raise exception 'FAIL: user could call ai_take_try'; exception when insufficient_privilege then raise notice 'ok: ai_take_try blocked for users'; end $$;
update public.ai_credits set tries_limit = 999;
select 'limit after user update attempt', tries_limit from public.ai_credits;
-- other user cannot see this row
select set_config('request.jwt.uid','44444444-4444-4444-4444-444444444444',false);
select 'other user rows', count(*) from public.ai_credits;
reset role;
-- the edge function (service role) takes tries
set role service_role;
select 'take1', public.ai_take_try('33333333-3333-3333-3333-333333333333');
select 'take2', public.ai_take_try('33333333-3333-3333-3333-333333333333');
select 'take3', public.ai_take_try('33333333-3333-3333-3333-333333333333');
select 'take4 (over limit)', public.ai_take_try('33333333-3333-3333-3333-333333333333');
select public.ai_refund_try('33333333-3333-3333-3333-333333333333');
select 'after refund', public.ai_take_try('33333333-3333-3333-3333-333333333333');
select public.ai_log('33333333-3333-3333-3333-333333333333','royal','google',4,true,'prompt');
reset role;
select 'logged', count(*) from public.ai_generations;
-- a paid plan just raises the limit
update public.ai_credits set plan = 'pro', tries_limit = 50 where user_id = '33333333-3333-3333-3333-333333333333';
set role authenticated; select set_config('request.jwt.uid','33333333-3333-3333-3333-333333333333',false);
select 'after upgrade', public.my_ai_credits();
