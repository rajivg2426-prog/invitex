\set ON_ERROR_STOP 1
-- Paid sharing campaigns: database rules. Run on a fresh database:
--   psql -d postgres -f tests/supabase-stubs.sql && psql -d ivx -c 'create role service_role nologin'
--   psql -d ivx -f supabase/schema.sql -f supabase/admin.sql -f supabase/ai-designs.sql -f tests/billing-seed-before.sql -f supabase/billing.sql -f tests/billing-test.sql
-- Every check prints PASS or stops with FAIL. Payments here are SIMULATED (provider 'simulated', test mode): no real money.
set client_min_messages = notice;
-- like Supabase: the service role can read every table (it bypasses RLS there)
grant select on all tables in schema public to service_role;
alter role service_role bypassrls;
create or replace function pg_temp.ok(p_name text, p_cond boolean) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAIL: %', p_name; end if;
  raise notice 'PASS %', p_name;
end $$;
-- a campaign as its owner sees it
create or replace function pg_temp.cj(p uuid) returns jsonb language sql as $$
  select c from jsonb_array_elements(public.my_campaigns()) c where (c->>'id')::uuid = p $$;
-- run as a signed-in user
create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.uid', coalesce(p::text, ''), false); end $$;

-- people: S = Super Admin, A = plain admin, H and K = hosts, N = brand-new host
insert into auth.users(id, email, created_at) values
  ('50000000-0000-0000-0000-000000000005', 'owner@example.com', now() - interval '400 days'),
  ('a0000000-0000-0000-0000-00000000000a', 'helper.admin@example.com', now() - interval '300 days'),
  ('10000000-0000-0000-0000-000000000001', 'host.h@example.com', now() - interval '200 days'),
  ('20000000-0000-0000-0000-000000000002', 'host.k@example.com', now() - interval '200 days'),
  ('30000000-0000-0000-0000-000000000003', 'new.n@example.com', now() - interval '1 day') on conflict do nothing;
update public.profiles set role = 'super_admin' where user_id = '50000000-0000-0000-0000-000000000005';
update public.profiles set role = 'admin' where user_id = 'a0000000-0000-0000-0000-00000000000a';

select pg_temp.ok('existing published invitation got a free "existing" campaign on install',
  (select count(*) from public.campaign_entitlements e where e.invitation_id = 'eeeeeeee-0000-0000-0000-000000000001' and e.source = 'existing' and e.grant_type = 'complimentary') = 1);
select pg_temp.ok('existing invitation still opens for guests', public.get_public_invitation('old-wedding')->>'status' = 'ok');
select pg_temp.ok('initial price rule: ₹20, charging on, test mode', (select price_paise = 2000 and payment_required and mode = 'test' from public._billing_policy()));

-- invitations: H has two, K has one (all published, none shared yet)
insert into public.invitations(id, owner_id, slug, status, data, published, published_at) values
  ('11111111-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'h-wedding', 'published',
   '{"text":{"en":{"title":"H Wedding"}},"events":[{"id":"ev1","date":"2030-02-14"}]}', '{"text":{"en":{"title":"H Wedding"}},"events":[{"id":"ev1","date":"2030-02-14"}]}', now()),
  ('11111111-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'h-party', 'published',
   '{"text":{"en":{"title":"H Party"}}}', '{"text":{"en":{"title":"H Party"}}}', now()),
  ('22222222-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'k-meet', 'published',
   '{"text":{"en":{"title":"K Meet"}}}', '{"text":{"en":{"title":"K Meet"}}}', now()),
  ('33333333-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'n-puja', 'published',
   '{"text":{"en":{"title":"N Puja"}}}', '{"text":{"en":{"title":"N Puja"}}}', now()),
  ('55555555-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', 's-test', 'published',
   '{"text":{"en":{"title":"Owner test"}}}', '{"text":{"en":{"title":"Owner test"}}}', now());
insert into public.guests(id, invitation_id, name, phone) values
  ('99999999-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Rakesh', '9876543210'),
  ('99999999-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 'Meena', '9876543211'),
  ('99999999-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Arjun', '9876543212');

-- ===== Pricing limits (Super Admin only) =====
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select pg_temp.ok('₹10 accepted',  (public.admin_set_pricing('{"price_rupees":10}')->>'price_paise')::int = 1000);
select pg_temp.ok('₹100 accepted', (public.admin_set_pricing('{"price_rupees":100}')->>'price_paise')::int = 10000);
do $$ begin perform public.admin_set_pricing('{"price_rupees":9}'); raise exception 'FAIL: ₹9 accepted'; exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS ₹9 refused'; end $$;
do $$ begin perform public.admin_set_pricing('{"price_rupees":101}'); raise exception 'FAIL: ₹101 accepted'; exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS ₹101 refused'; end $$;
do $$ begin perform public.admin_set_pricing('{"price_rupees":20.5}'); raise exception 'FAIL: ₹20.50 accepted'; exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS ₹20.50 refused (whole rupees only)'; end $$;
do $$ begin perform public.admin_set_pricing('{"mode":"live"}'); raise exception 'FAIL: live without confirmation'; exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS live mode needs the typed confirmation'; end $$;
select pg_temp.ok('₹20 accepted', (public.admin_set_pricing('{"price_rupees":20,"note":"back to default"}')->>'price_paise')::int = 2000);
select pg_temp.ok('price change is in the audit log', public.admin_activity(5, 0, 'pricing.')->'rows'->0->'details'->'new'->>'price_paise' = '2000');
reset role;

-- a plain admin and a host cannot change prices or free access
set role authenticated; select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.ok('plain admin can read the pricing page', (public.admin_pricing()->'current'->>'price_paise')::int = 2000);
do $$ begin perform public.admin_set_pricing('{"price_rupees":50}'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS plain admin cannot change price'; end $$;
do $$ begin perform public.admin_grant_exemption('host.h@example.com', 'x'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS plain admin cannot grant free access'; end $$;
select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
do $$ begin perform public.admin_billing_overview(); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot open billing admin'; end $$;
do $$ begin perform public.admin_payments(); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot list payments'; end $$;
do $$ begin perform public.admin_set_pricing('{"payment_required":false}'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot switch charging off'; end $$;
do $$ begin insert into public.pricing_settings(payment_required) values (false); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot write pricing table'; end $$;
do $$ begin insert into public.user_access_exemptions(user_id, reason) values (auth.uid(), 'me'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot grant self free access'; end $$;
reset role;

-- ===== Test mode protects real hosts =====
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok('test mode: a host is not asked to pay', (public.my_sharing_quote()->>'payment_required')::boolean = false and public.my_sharing_quote()->>'free_reason' = 'test_mode');
select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select pg_temp.ok('test mode: the Super Admin is asked to pay ₹20', (public.my_sharing_quote()->>'payment_required')::boolean and (public.my_sharing_quote()->>'charge_paise')::int = 2000);
reset role;

-- From here on, behave as if live so hosts are charged (database only; no real gateway is involved in these tests)
update public.pricing_settings set mode = 'live' where id = (select max(id) from public.pricing_settings);

-- ===== Guest-side lock =====
set role anon; select pg_temp.as_user(null);
select pg_temp.ok('unpaid invitation is not open for guests', public.get_public_invitation('h-wedding')->>'status' = 'not_open');
select pg_temp.ok('guest cannot reply to an unopened invitation', public.submit_rsvp('h-wedding', '{"name":"Rakesh","phone":"9876543210","status":"yes","adults":1,"consent":true}')->>'code' = 'notOpen');
reset role;
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok('the host can always preview their own invitation', public.get_public_invitation('h-wedding')->>'status' = 'ok');
reset role;

-- ===== Campaign creation and reuse, payment switch ON =====
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok('switch ON: host quote asks for ₹20', (public.my_sharing_quote()->>'payment_required')::boolean and (public.my_sharing_quote()->>'charge_paise')::int = 2000);
create temp table cid as select (public.campaign_start('11111111-0000-0000-0000-000000000001', null, null, 'req-1')->>'id')::uuid as id;
grant select on cid to public;
select pg_temp.ok('campaign created, awaiting payment of ₹20',
  (select (j->>'status') = 'awaiting_payment' and (j->>'amount_paise')::int = 2000 and (j->>'can_share')::boolean = false from (select pg_temp.cj(id) j from cid) x));
select pg_temp.ok('a double tap (same request id) returns the same campaign', (public.campaign_start('11111111-0000-0000-0000-000000000001', null, null, 'req-1')->>'id')::uuid = (select id from cid));
select pg_temp.ok('starting again reuses the open campaign', (public.campaign_start('11111111-0000-0000-0000-000000000001')->>'id')::uuid = (select id from cid));
select pg_temp.ok('only one campaign exists', (select count(*) from public.sharing_campaigns where invitation_id = '11111111-0000-0000-0000-000000000001') = 1);
do $$ begin perform public.campaign_mark_shared((select id from cid), null, 'whatsapp'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS cannot share before payment'; end $$;
-- bypass attempts
do $$ begin update public.sharing_campaigns set entitlement_status = 'active', campaign_status = 'ready' where id = (select id from cid); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot mark own campaign paid'; end $$;
do $$ begin insert into public.campaign_entitlements(campaign_id, user_id, invitation_id, grant_type, source) select id, auth.uid(), '11111111-0000-0000-0000-000000000001', 'complimentary', 'admin' from cid; raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot insert an unlock'; end $$;
do $$ begin perform public._svc_payment_apply('simulated', 'x', '{}', 'checkout'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot call server-only payment functions'; end $$;
do $$ begin perform public._grant_complimentary((select id from cid), '{"source":"emergency"}'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS host cannot call the free-grant helper'; end $$;
reset role;
-- another host cannot see or touch H's campaign
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('host K sees none of H''s campaigns', (select count(*) from public.sharing_campaigns) = 0);
do $$ begin perform public.campaign_start('11111111-0000-0000-0000-000000000001'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS K cannot start a campaign on H''s invitation'; end $$;
do $$ begin perform public.campaign_state('11111111-0000-0000-0000-000000000001'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS K cannot read H''s campaign'; end $$;
do $$ begin perform public.campaign_cancel((select id from public.sharing_campaigns limit 1)); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS K cannot cancel H''s campaign'; end $$;
reset role;

-- ===== Payment: order, pending, failed, captured (simulated provider) =====
set role service_role;
select pg_temp.ok('order prepared with the server amount ₹20', (select (j->>'status') = 'create' and (j->>'amount_paise')::int = 2000 from (select public._svc_order_prepare('10000000-0000-0000-0000-000000000001', id, 'simulated') j from cid) x));
select public._svc_order_created((select id from public.payment_orders where campaign_id = (select id from cid)), 'order_SIM1');
-- price changes while the order is open: the order keeps ₹20
reset role; set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_set_pricing('{"price_rupees":30}'); reset role;
update public.pricing_settings set mode = 'live' where id = (select max(id) from public.pricing_settings);
set role service_role;
select pg_temp.ok('retry reuses the same order at the old amount after a price change',
  (select (j->>'status') = 'reuse' and j->>'provider_order_id' = 'order_SIM1' and (j->>'amount_paise')::int = 2000 from (select public._svc_order_prepare('10000000-0000-0000-0000-000000000001', id, 'simulated') j from cid) x));
select pg_temp.ok('pending payment keeps sharing locked', public._svc_payment_apply('simulated', 'order_SIM1', '{"id":"pay_A","status":"authorized","amount":2000,"currency":"INR","method":"upi"}', 'checkout')->>'result' = 'pending');
select pg_temp.ok('campaign shows payment pending', (select campaign_status from public.sharing_campaigns where id = (select id from cid)) = 'payment_pending');
select pg_temp.ok('a failed attempt is recorded',
  public._svc_payment_apply('simulated', 'order_SIM1', '{"id":"pay_B","status":"failed","amount":2000,"currency":"INR","error_description":"cancelled"}', 'webhook')->>'result' = 'failed');
select pg_temp.ok('…but while another attempt is pending the campaign stays pending', (select campaign_status from public.sharing_campaigns where id = (select id from cid)) = 'payment_pending');
select pg_temp.ok('amount mismatch is caught', public._svc_payment_apply('simulated', 'order_SIM1', '{"id":"pay_X","status":"captured","amount":100,"currency":"INR"}', 'webhook')->>'result' = 'mismatch');
select pg_temp.ok('…and never unlocks', (select entitlement_status from public.sharing_campaigns where id = (select id from cid)) = 'none');
select pg_temp.ok('captured payment unlocks', public._svc_payment_apply('simulated', 'order_SIM1', '{"id":"pay_A","status":"captured","amount":2000,"currency":"INR","method":"upi"}', 'checkout')->>'result' = 'unlocked');
select pg_temp.ok('duplicate webhook for the same payment changes nothing', public._svc_payment_apply('simulated', 'order_SIM1', '{"id":"pay_A","status":"captured","amount":2000,"currency":"INR","method":"upi"}', 'webhook')->>'result' = 'already_unlocked');
select pg_temp.ok('exactly one unlock for the campaign', (select count(*) from public.campaign_entitlements where campaign_id = (select id from cid)) = 1);
select pg_temp.ok('unlock is a paid one for ₹20 pointing at the payment',
  (select e.grant_type = 'paid' and e.amount_paise = 2000 and t.provider_payment_id = 'pay_A' from public.campaign_entitlements e join public.payment_transactions t on t.id = e.transaction_id where e.campaign_id = (select id from cid)));
select pg_temp.ok('payment verified by both checkout and webhook', (select verified_via @> array['checkout','webhook'] from public.payment_transactions where provider_payment_id = 'pay_A'));
select pg_temp.ok('a new webhook event is processed', public._svc_webhook_seen('simulated', 'evt_1', 'payment.captured', true, '{}'));
select pg_temp.ok('an event that failed half-way is processed again', public._svc_webhook_seen('simulated', 'evt_1', 'payment.captured', true, '{}'));
select public._svc_webhook_done('simulated', 'evt_1', 'unlocked');
select pg_temp.ok('a processed webhook event is skipped when it arrives again', not public._svc_webhook_seen('simulated', 'evt_1', 'payment.captured', true, '{}'));
select pg_temp.ok('a second captured payment on the paid campaign is reported as a duplicate',
  public._svc_payment_apply('simulated', 'order_SIM1', '{"id":"pay_C","status":"captured","amount":2000,"currency":"INR"}', 'webhook')->>'result' = 'duplicate');
select pg_temp.ok('…flagged "refund due", still one unlock', (select flag from public.payment_transactions where provider_payment_id = 'pay_C') = 'duplicate_refund_due'
  and (select count(*) from public.campaign_entitlements where campaign_id = (select id from cid)) = 1);
select pg_temp.ok('after unlock, preparing an order says already unlocked', public._svc_order_prepare('10000000-0000-0000-0000-000000000001', (select id from cid), 'simulated')->>'status' = 'unlocked');
reset role;

-- ===== Sharing within the campaign is free; many guests, resends =====
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select public.campaign_mark_shared((select id from cid), '99999999-0000-0000-0000-000000000001', 'whatsapp');
select public.campaign_mark_shared((select id from cid), '99999999-0000-0000-0000-000000000002', 'whatsapp');
select public.campaign_mark_shared((select id from cid), '99999999-0000-0000-0000-000000000003', 'email');
select public.campaign_mark_shared((select id from cid), '99999999-0000-0000-0000-000000000001', 'whatsapp');  -- resend
select public.campaign_mark_shared((select id from cid), null, 'copy', 'link');
select pg_temp.ok('three guests shared in one campaign, resend counted, no new payment',
  (select (j->'stats'->>'shared')::int = 3 and (j->>'guest_count')::int = 3 and j->>'status' = 'sharing' from (select pg_temp.cj(id) j from cid) x)
  and (select share_count from public.campaign_guests where guest_id = '99999999-0000-0000-0000-000000000001') = 2
  and (select count(*) from public.payment_orders where campaign_id = (select id from cid)) = 1);
select pg_temp.ok('reopening via Start sharing returns the same unlocked campaign', (public.campaign_start('11111111-0000-0000-0000-000000000001')->>'id')::uuid = (select id from cid));
reset role;
set role anon; select pg_temp.as_user(null);
select pg_temp.ok('paid invitation opens for guests', public.get_public_invitation('h-wedding')->>'status' = 'ok');
reset role;

-- ===== A second campaign on the same invitation needs a new payment; reopen keeps the old unlock =====
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok('campaign marked done', public.campaign_complete((select id from cid))->>'status' = 'completed');
create temp table cid2 as select (public.campaign_start('11111111-0000-0000-0000-000000000001')->>'id')::uuid as id;
grant select on cid2 to public;
select pg_temp.ok('new campaign on the same invitation is separate and awaits ₹30 (the current price)',
  (select id from cid2) <> (select id from cid) and (select (j->>'status') = 'awaiting_payment' and (j->>'amount_paise')::int = 3000 from (select pg_temp.cj(id) j from cid2) x));
do $$ begin perform public.campaign_reopen((select id from cid)); raise exception 'FAIL'; exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS cannot reopen while another campaign is open'; end $$;
select pg_temp.ok('unpaid second campaign can be cancelled', public.campaign_cancel((select id from cid2))->>'status' = 'cancelled');
select pg_temp.ok('first campaign reopens with its unlock, no payment', (select (j->>'status') = 'sharing' and (j->>'can_share')::boolean from (select public.campaign_reopen(id) j from cid) x));
do $$ begin perform public.campaign_cancel((select id from cid)); raise exception 'FAIL'; exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'PASS an unlocked campaign cannot be cancelled'; end $$;
select pg_temp.ok('my_payments shows the receipt', (select count(*) from jsonb_array_elements(public.my_payments()) p where p->>'payment_id' = 'pay_A') = 1);
reset role;

-- ===== Failed payment allows retry against the same campaign =====
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
create temp table cid3 as select (public.campaign_start('11111111-0000-0000-0000-000000000002')->>'id')::uuid as id;
grant select on cid3 to public;
reset role; set role service_role;
select public._svc_order_prepare('10000000-0000-0000-0000-000000000001', (select id from cid3), 'simulated');
select public._svc_order_created((select id from public.payment_orders where campaign_id = (select id from cid3) and status = 'creating'), 'order_SIM3');
select pg_temp.ok('failed payment', public._svc_payment_apply('simulated', 'order_SIM3', '{"id":"pay_F","status":"failed","amount":3000,"currency":"INR"}', 'checkout')->>'result' = 'failed');
select pg_temp.ok('failed payment does not unlock', (select campaign_status = 'payment_failed' and entitlement_status = 'none' from public.sharing_campaigns where id = (select id from cid3)));
select pg_temp.ok('retry uses the same campaign and order', public._svc_order_prepare('10000000-0000-0000-0000-000000000001', (select id from cid3), 'simulated')->>'provider_order_id' = 'order_SIM3');
select pg_temp.ok('payment succeeds on retry', public._svc_payment_apply('simulated', 'order_SIM3', '{"id":"pay_G","status":"captured","amount":3000,"currency":"INR"}', 'checkout')->>'result' = 'unlocked');
select pg_temp.ok('unknown order is ignored', public._svc_payment_apply('simulated', 'order_NOPE', '{"id":"pay_Z","status":"captured","amount":3000,"currency":"INR"}', 'webhook')->>'result' = 'unknown_order');
-- refund: links stay, sharing stops
select pg_temp.ok('refund recorded', public._svc_refund_apply('simulated', '{"id":"rfnd_1","payment_id":"pay_G","amount":3000,"status":"processed"}')->>'result' = 'ok');
select pg_temp.ok('refund repeated is not double counted', (public._svc_refund_apply('simulated', '{"id":"rfnd_1","payment_id":"pay_G","amount":3000,"status":"processed"}')->>'refunded_paise')::int = 3000);
select pg_temp.ok('after refund: entitlement marked refunded, sharing stops', (select entitlement_status = 'refunded' and payment_status = 'refunded' from public.sharing_campaigns where id = (select id from cid3)));
reset role;
set role anon; select pg_temp.as_user(null);
select pg_temp.ok('after refund: links already sent still open', public.get_public_invitation('h-party')->>'status' = 'ok');
reset role;
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
do $$ begin perform public.campaign_mark_shared((select id from cid3), null, 'whatsapp'); raise exception 'FAIL'; exception when insufficient_privilege then raise notice 'PASS refunded campaign cannot share to new guests'; end $$;
reset role;

-- ===== Free access: switch OFF, emergency, exemption, promotion, new users, free quota =====
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_set_pricing('{"payment_required":false}'); reset role;
update public.pricing_settings set mode = 'live' where id = (select max(id) from public.pricing_settings);
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('switch OFF: campaign is free and unlocked at once, recorded as complimentary',
  (select (j->>'can_share')::boolean and j->'entitlement'->>'grant_type' = 'complimentary' and j->'entitlement'->>'source' = 'payments_off' and (j->>'amount_paise')::int = 0
     from (select public.campaign_start('22222222-0000-0000-0000-000000000001') j) x));
select pg_temp.ok('complimentary campaign has no payment', (select count(*) from public.payment_transactions where user_id = auth.uid()) = 0);
reset role;
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_set_pricing('{"payment_required":true}'); select public.admin_set_pricing('{"emergency_free":true}'); reset role;
update public.pricing_settings set mode = 'live' where id = (select max(id) from public.pricing_settings);
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('emergency switch makes sharing free', public.my_sharing_quote()->>'free_reason' = 'emergency');
reset role;
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_set_pricing('{"emergency_free":false}');
select pg_temp.ok('complimentary user: Super Admin grants K 1 free campaign', (public.admin_grant_exemption('host.k@example.com', 'Friend of the family', null, 1)->>'campaign_quota')::int = 1);
reset role;
update public.pricing_settings set mode = 'live' where id = (select max(id) from public.pricing_settings);
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('K quote: free by exemption', public.my_sharing_quote()->>'free_reason' = 'exemption');
reset role;
-- K starts a second campaign on their invitation: the exemption is used, then the next one costs money
update public.sharing_campaigns set campaign_status = 'completed' where invitation_id = '22222222-0000-0000-0000-000000000001';
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('K campaign unlocked by exemption', public.campaign_start('22222222-0000-0000-0000-000000000001')->'entitlement'->>'source' = 'exemption');
select pg_temp.ok('exemption quota used up: next campaign must be paid', (public.my_sharing_quote()->>'payment_required')::boolean);
reset role;
-- promotions
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_save_promotion(jsonb_build_object('name', 'Expired Diwali offer', 'starts_at', now() - interval '10 days', 'ends_at', now() - interval '1 day', 'audience', 'everyone'));
reset role;
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('free access expiry: an ended promotion gives nothing, normal price is back', (public.my_sharing_quote()->>'payment_required')::boolean and (public.my_sharing_quote()->>'charge_paise')::int = 3000);
reset role;
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
create temp table promo as select (public.admin_save_promotion(jsonb_build_object('name', 'Launch week', 'starts_at', now() - interval '1 hour', 'ends_at', now() + interval '7 days',
  'audience', 'selected', 'emails', jsonb_build_array('host.k@example.com', 'nobody@example.com'), 'total_quota', 5, 'per_user_quota', 1))->>'id')::uuid as id;
grant select on promo to public;
select pg_temp.ok('promotion lists the email that has no account', (select count(*) from jsonb_array_elements(public.admin_promotions()) p, jsonb_array_elements_text(p->'emails') e where e = 'host.k@example.com') = 1);
reset role;
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('promotional free access for a selected user', public.my_sharing_quote()->>'free_reason' = 'promotion');
reset role;
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok('a user not selected for the promotion still pays', (public.my_sharing_quote()->>'payment_required')::boolean);
reset role;
update public.sharing_campaigns set campaign_status = 'completed' where invitation_id = '22222222-0000-0000-0000-000000000001';
set role authenticated; select pg_temp.as_user('20000000-0000-0000-0000-000000000002');
select pg_temp.ok('promotion unlocks a campaign', public.campaign_start('22222222-0000-0000-0000-000000000001')->'entitlement'->>'source' = 'promotion');
select pg_temp.ok('per-person promotion limit reached', (public.my_sharing_quote()->>'payment_required')::boolean);
reset role;
-- new users free for 3 days, first campaign free for everyone
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_set_pricing('{"new_user_free_days":3}'); reset role;
update public.pricing_settings set mode = 'live' where id = (select max(id) from public.pricing_settings);
set role authenticated; select pg_temp.as_user('30000000-0000-0000-0000-000000000003');
select pg_temp.ok('free for new users (joined yesterday)', public.my_sharing_quote()->>'free_reason' = 'new_user');
reset role;
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok('an older account is not a new user', (public.my_sharing_quote()->>'payment_required')::boolean);
reset role;
-- a link shared while sharing is free keeps working: the first guest visit records a free campaign
set role anon; select pg_temp.as_user(null);
select pg_temp.ok('new user''s link opens for guests during the free period', public.get_public_invitation('n-puja')->>'status' = 'ok');
reset role;
select pg_temp.ok('…and is recorded as a complimentary campaign', (select source from public.campaign_entitlements where invitation_id = '33333333-0000-0000-0000-000000000001') = 'new_user');
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_set_pricing('{"new_user_free_days":0,"free_campaigns_per_user":10}'); reset role;
update public.pricing_settings set mode = 'live' where id = (select max(id) from public.pricing_settings);
set role authenticated; select pg_temp.as_user('10000000-0000-0000-0000-000000000001');
select pg_temp.ok('free for a limited number of campaigns', public.my_sharing_quote()->>'free_reason' = 'free_quota');
reset role;
set role authenticated; select pg_temp.as_user('50000000-0000-0000-0000-000000000005');
select public.admin_set_pricing('{"free_campaigns_per_user":0}');
-- revoke K's exemption: K's unlocked campaigns stay unlocked
select pg_temp.ok('exemption revoked', public.admin_revoke_exemption((select (x->>'id')::uuid from jsonb_array_elements(public.admin_exemptions()) x where x->>'reason' = 'Friend of the family'))->>'revoked_at' is not null);
reset role;
select pg_temp.ok('unlocks granted earlier are not revoked', (select count(*) from public.campaign_entitlements where user_id = '20000000-0000-0000-0000-000000000002' and status = 'active') = 3);

-- ===== Admin reports =====
set role authenticated; select pg_temp.as_user('a0000000-0000-0000-0000-00000000000a');
select pg_temp.ok('overview counts paid and complimentary campaigns',
  (select (o->'campaigns'->>'paid')::int = 2 and (o->'campaigns'->>'complimentary')::int >= 4 from (select public.admin_billing_overview() o) x));
select pg_temp.ok('revenue counts every captured payment, flagged ones too (₹20 + ₹20 duplicate + ₹1 mismatch + ₹30)', (public.admin_billing_overview()->'payments'->>'revenue_paise')::int = 7100);
select pg_temp.ok('refunds total', (public.admin_billing_overview()->'payments'->>'refunds_paise')::int = 3000);
select pg_temp.ok('payments list filters flagged (mismatch + duplicate)', (public.admin_payments('', 'flagged')->>'total')::int = 2);
select pg_temp.ok('payments list search by email: every attempt of H', (public.admin_payments('host.h')->>'total')::int = 6);
select pg_temp.ok('payments list filters failed', (public.admin_payments('', 'failed')->>'total')::int = 2);
select pg_temp.ok('test payments are kept apart', (public.admin_payments('', 'all', null, null, true)->>'total')::int = 0);
select pg_temp.ok('campaign list for admins', (public.admin_campaigns()->>'total')::int >= 6);
select pg_temp.ok('revenue by day has 30 days', jsonb_array_length(public.admin_revenue(30)->'days') = 30);
reset role;

-- ===== Re-running billing.sql is safe and does not open unpaid invitations =====
\i supabase/billing.sql
select pg_temp.ok('re-run does not create "existing" unlocks for new invitations', (select count(*) from public.campaign_entitlements where source = 'existing') = 1);
select pg_temp.ok('re-run keeps all unlocks', (select count(*) from public.campaign_entitlements) >= 7);
select 'billing tests finished';
