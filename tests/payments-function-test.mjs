// Tests the sharing-campaign and razorpay-webhook Edge Functions against the REAL
// billing SQL on a local Postgres, with a FAKE Razorpay (no network, no real money).
// Setup + run (see docs/PAYMENTS_SETUP.md, "Running the tests"):
//   PGHOST=… node tests/payments-function-test.mjs
// Node 22.18+ runs the .ts files directly.
import { execFileSync } from 'node:child_process';
import { handle as campaignFn, hmacHex } from '../supabase/functions/sharing-campaign/index.ts';
import { handle as webhookFn } from '../supabase/functions/razorpay-webhook/index.ts';

const DB = process.env.PGDATABASE || 'ivx';
let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : '')); };
const psql = (sql, file) => execFileSync('psql', ['-d', file ? 'postgres' : DB, '-Atq', '-v', 'ON_ERROR_STOP=1', ...(file ? ['-f', file] : [])], { input: sql || '', stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
const lit = (v) => v === null || v === undefined ? 'null' : `'${String(typeof v === 'object' ? JSON.stringify(v) : v).replace(/'/g, "''")}'`;
const asUser = (uid, q) => psql(`set role authenticated; select set_config('request.jwt.uid', ${lit(uid)}, false);\n${q}`).split('\n').pop();
const one = (q) => psql(q).split('\n').pop();

/* ---------- fresh database ---------- */
execFileSync('psql', ['-d', 'postgres', '-q', '-f', 'tests/supabase-stubs.sql'], { stdio: 'ignore' });  // roles may exist already
try { psql('create role service_role nologin'); } catch { /* exists */ }
for (const f of ['supabase/schema.sql', 'supabase/admin.sql', 'supabase/ai-designs.sql', 'supabase/billing.sql']) execFileSync('psql', ['-d', DB, '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { stdio: ['ignore', 'ignore', 'pipe'] });
const S = '50000000-0000-0000-0000-000000000005', H = '10000000-0000-0000-0000-000000000001', K = '20000000-0000-0000-0000-000000000002';
psql(`grant select on all tables in schema public to service_role; alter role service_role bypassrls;
insert into auth.users(id, email, created_at) values ('${S}','owner@example.com', now() - interval '400 days'), ('${H}','host.h@example.com', now() - interval '100 days'), ('${K}','host.k@example.com', now() - interval '100 days');
update profiles set role = 'super_admin' where user_id = '${S}';
insert into invitations(id, owner_id, slug, status, data, published, published_at)
select ('5555555' || n || '-0000-0000-0000-000000000001')::uuid, '${S}', 's-inv-' || n, 'published', '{"text":{"en":{"title":"Owner test"}}}', '{"text":{"en":{"title":"Owner test"}}}', now() from generate_series(1, 8) n;
insert into invitations(id, owner_id, slug, status, data, published, published_at)
values ('11111111-0000-0000-0000-000000000001', '${H}', 'h-wed', 'published', '{"text":{"en":{"title":"H"}}}', '{"text":{"en":{"title":"H"}}}', now());`);
const inv = (n) => `5555555${n}-0000-0000-0000-000000000001`;
const startCampaign = (uid, invitation) => JSON.parse(asUser(uid, `select public.campaign_start('${invitation}')::text;`));
const campaign = (uid, id) => JSON.parse(asUser(uid, `select c::text from jsonb_array_elements(public.my_campaigns()) c where c->>'id' = '${id}';`));

/* ---------- fake Supabase (REST rpc → Postgres as service_role) + fake Razorpay ---------- */
const SECRET = 'test_secret_xyz', WH = 'webhook_secret_abc';
const RZ = { orders: new Map(), payments: new Map(), calls: [] };
const TOKENS = { 'tok-S': S, 'tok-H': H, 'tok-K': K };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const fakeFetch = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith('/auth/v1/user')) { const t = (init.headers.authorization || '').replace('Bearer ', ''); return TOKENS[t] ? json({ id: TOKENS[t] }) : json({ msg: 'bad jwt' }, 401); }
  const m = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
  if (m) {
    if (init.headers.authorization !== 'Bearer service-key') return json({ message: 'denied' }, 401);
    const args = JSON.parse(init.body || '{}');
    const named = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}${typeof v === 'object' && v !== null ? '::jsonb' : ''}`).join(', ');
    try { return new Response(psql(`set role service_role; select to_json(public.${m[1]}(${named}))::text;`).split('\n').pop()); }
    catch (e) { return json({ message: e.stderr?.toString() }, 400); }
  }
  if (url.startsWith('https://api.razorpay.test/v1')) {
    RZ.calls.push(url.replace('https://api.razorpay.test/v1', '') + ' ' + (init.method || 'GET'));
    if (init.headers.authorization !== 'Basic ' + btoa('rzp_test_KEY:' + SECRET)) return json({ error: { description: 'auth' } }, 401);
    if (url.endsWith('/orders') && init.method === 'POST') {
      const b = JSON.parse(init.body); const id = 'order_' + (RZ.orders.size + 1);
      RZ.orders.set(id, { id, ...b, status: 'created' }); return json(RZ.orders.get(id));
    }
    let x = /\/orders\/(\w+)\/payments$/.exec(url);
    if (x) return json({ items: [...RZ.payments.values()].filter((p) => p.order_id === x[1]) });
    x = /\/payments\/(\w+)$/.exec(url);
    if (x) return RZ.payments.has(x[1]) ? json(RZ.payments.get(x[1])) : json({ error: { description: 'not found' } }, 404);
  }
  throw new Error('unexpected fetch ' + url);
};
const ENV = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key', RAZORPAY_KEY_ID: 'rzp_test_KEY', RAZORPAY_KEY_SECRET: SECRET,
  RAZORPAY_API_BASE: 'https://api.razorpay.test/v1', RAZORPAY_WEBHOOK_SECRET: WH };
const call = async (tok, body, env = ENV) => {
  const r = await campaignFn(new Request('https://fn.test', { method: 'POST', headers: tok ? { authorization: 'Bearer ' + tok } : {}, body: JSON.stringify(body) }), env, fakeFetch);
  return { status: r.status, body: await r.json() };
};
let evN = 0;
const hook = async (event, entity, { sign = true, id = 'evt_' + (++evN) } = {}) => {
  const raw = JSON.stringify({ event, payload: event.startsWith('refund') ? { refund: { entity } } : { payment: { entity } } });
  const sig = sign ? await hmacHex(WH, raw) : 'bad';
  const r = await webhookFn(new Request('https://fn.test', { method: 'POST', headers: { 'x-razorpay-signature': sig, 'x-razorpay-event-id': id }, body: raw }), ENV, fakeFetch);
  return { status: r.status, body: await r.json() };
};
const pay = (id, order_id, status, amount, extra = {}) => { RZ.payments.set(id, { id, order_id, status, amount, currency: 'INR', method: 'upi', ...extra }); return RZ.payments.get(id); };
const setPricing = (p) => asUser(S, `select public.admin_set_pricing(${lit(p)}::jsonb);`);

/* ================= tests ================= */
// test mode protects real hosts
let cH = startCampaign(H, '11111111-0000-0000-0000-000000000001');
ok('test mode: a host campaign is free at once', cH.can_share === true && cH.entitlement.source === 'test_mode');
let r = await call('tok-H', { action: 'order', campaign_id: cH.id });
ok('test mode: no Razorpay order for a host', r.body.status === 'unlocked' && RZ.calls.length === 0);

// auth
r = await call(null, { action: 'order', campaign_id: cH.id });
ok('no sign-in → 401', r.status === 401);
let c1 = startCampaign(S, inv(1));
ok('₹20 campaign awaiting payment', c1.status === 'awaiting_payment' && c1.amount_paise === 2000);
r = await call('tok-K', { action: 'order', campaign_id: c1.id });
ok('another user cannot pay for or see this campaign', r.status === 404);

// keys missing
r = await call('tok-S', { action: 'order', campaign_id: c1.id }, { ...ENV, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' });
ok('no Razorpay keys → not configured, nothing charged', r.status === 503 && r.body.code === 'not_configured' && RZ.orders.size === 0);

// ₹20 order with server amount
r = await call('tok-S', { action: 'order', campaign_id: c1.id, amount_paise: 1 });
ok('order created with the server amount ₹20 (the browser amount is ignored)', r.body.status === 'checkout' && r.body.amount_paise === 2000 && RZ.orders.get(r.body.order_id).amount === 2000);
ok('checkout gets the public key id only', r.body.key_id === 'rzp_test_KEY' && !JSON.stringify(r.body).includes(SECRET) && r.body.is_test === true);
ok('order receipt and notes carry the campaign', RZ.orders.get(r.body.order_id).receipt === c1.id && RZ.orders.get(r.body.order_id).notes.campaign_id === c1.id);
const o1 = r.body.order_id;
r = await call('tok-S', { action: 'order', campaign_id: c1.id });
ok('retry reuses the same order (no second charge)', r.body.order_id === o1 && RZ.orders.size === 1);

// invalid signature
pay('pay_1', o1, 'authorized', 2000);
r = await call('tok-S', { action: 'verify', campaign_id: c1.id, razorpay_order_id: o1, razorpay_payment_id: 'pay_1', razorpay_signature: 'forged' });
ok('invalid checkout signature is refused', r.status === 400 && r.body.code === 'invalid_signature');
ok('…and nothing is unlocked', campaign(S, c1.id).can_share === false);
r = await call('tok-S', { action: 'verify', campaign_id: c1.id, razorpay_order_id: 'order_other', razorpay_payment_id: 'pay_1', razorpay_signature: await hmacHex(SECRET, 'order_other|pay_1') });
ok('a signature for another order is refused', r.status === 400 && r.body.code === 'order_mismatch');

// pending, then captured
r = await call('tok-S', { action: 'verify', campaign_id: c1.id, razorpay_order_id: o1, razorpay_payment_id: 'pay_1', razorpay_signature: await hmacHex(SECRET, `${o1}|pay_1`) });
ok('valid signature but payment still pending → pending, locked', r.body.result === 'pending' && campaign(S, c1.id).status === 'payment_pending' && !campaign(S, c1.id).can_share);
RZ.payments.get('pay_1').status = 'captured';
r = await call('tok-S', { action: 'status', campaign_id: c1.id });
ok('status check after capture → unlocked', r.body.result === 'unlocked' && campaign(S, c1.id).can_share === true);
ok('₹20 payment recorded as paid', campaign(S, c1.id).entitlement.grant_type === 'paid' && campaign(S, c1.id).entitlement.amount_paise === 2000);
r = await hook('payment.captured', RZ.payments.get('pay_1'));
ok('webhook for the same payment changes nothing', r.status === 200 && r.body.result === 'already_unlocked');
r = await hook('payment.captured', RZ.payments.get('pay_1'), { id: 'evt_1' });
ok('the same webhook event again is skipped', r.body.duplicate === true);
r = await hook('payment.captured', RZ.payments.get('pay_1'), { sign: false });
ok('webhook with an invalid signature is refused', r.status === 400);
ok('one unlock for the campaign', one(`select count(*) from campaign_entitlements where campaign_id = '${c1.id}'`) === '1');

// browser callback lost: the webhook unlocks
const c2 = startCampaign(S, inv(2));
const o2 = (await call('tok-S', { action: 'order', campaign_id: c2.id })).body.order_id;
r = await hook('payment.captured', pay('pay_2', o2, 'captured', 2000));
ok('payment succeeded but the browser closed: the webhook unlocks', r.body.result === 'unlocked' && campaign(S, c2.id).can_share === true);

// failed payment, retry on the same campaign
const c3 = startCampaign(S, inv(3));
const o3 = (await call('tok-S', { action: 'order', campaign_id: c3.id })).body.order_id;
r = await hook('payment.failed', pay('pay_3f', o3, 'failed', 2000, { error_description: 'Payment was cancelled by the user' }));
ok('failed payment does not unlock', r.body.result === 'failed' && campaign(S, c3.id).status === 'payment_failed');
r = await call('tok-S', { action: 'order', campaign_id: c3.id });
ok('retry after failure uses the same campaign and order', r.body.order_id === o3);
pay('pay_3', o3, 'captured', 2000);
r = await call('tok-S', { action: 'verify', campaign_id: c3.id, razorpay_order_id: o3, razorpay_payment_id: 'pay_3', razorpay_signature: await hmacHex(SECRET, `${o3}|pay_3`) });
ok('retry succeeds', r.body.result === 'unlocked');

// amount mismatch
const c4 = startCampaign(S, inv(4));
const o4 = (await call('tok-S', { action: 'order', campaign_id: c4.id })).body.order_id;
r = await hook('payment.captured', pay('pay_4', o4, 'captured', 1000));
ok('amount mismatch never unlocks', r.body.result === 'mismatch' && campaign(S, c4.id).can_share === false);

// duplicate payment
r = await hook('payment.captured', pay('pay_2b', o2, 'captured', 2000));
ok('payment made twice: flagged for refund, still one unlock', r.body.result === 'duplicate' && one(`select flag from payment_transactions where provider_payment_id = 'pay_2b'`) === 'duplicate_refund_due');

// ₹10, ₹100 and a price change while pending
setPricing({ price_rupees: 10 });
const c5 = startCampaign(S, inv(5));
r = await call('tok-S', { action: 'order', campaign_id: c5.id });
ok('₹10 payment order', RZ.orders.get(r.body.order_id).amount === 1000);
const o5 = r.body.order_id;
setPricing({ price_rupees: 100 });
r = await call('tok-S', { action: 'order', campaign_id: c5.id });
ok('price changed while pending: the open order keeps ₹10', r.body.order_id === o5 && r.body.amount_paise === 1000);
const c6 = startCampaign(S, inv(6));
r = await call('tok-S', { action: 'order', campaign_id: c6.id });
ok('₹100 payment order for a new campaign', RZ.orders.get(r.body.order_id).amount === 10000);
const o6 = r.body.order_id;

// reconcile job finds a lost payment
pay('pay_6', o6, 'captured', 10000);
psql(`update payment_orders set created_at = now() - interval '40 minutes' where provider_order_id = '${o6}'`);
r = await call('tok-S', { action: 'reconcile' });
ok('reconcile needs the service key', r.status === 401);
r = await call('service-key', { action: 'reconcile' });
ok('reconcile unlocks a payment whose callback and webhook were both lost', r.status === 200 && campaign(S, c6.id).can_share === true);

// refund
r = await hook('refund.processed', { id: 'rfnd_1', payment_id: 'pay_6', amount: 10000, status: 'processed' });
ok('refund webhook recorded', r.body.result === 'refund ok' && campaign(S, c6.id).entitlement_status === 'refunded');

// live-mode guards
psql(`update pricing_settings set mode = 'live' where id = (select max(id) from pricing_settings)`);
const c7 = startCampaign(S, inv(7));
r = await call('tok-S', { action: 'order', campaign_id: c7.id });
ok('live mode without PAYMENTS_LIVE_ALLOWED: refused', r.status === 503 && r.body.code === 'live_not_allowed');
r = await call('tok-S', { action: 'order', campaign_id: c7.id }, { ...ENV, PAYMENTS_LIVE_ALLOWED: 'true' });
ok('live mode with test keys: refused', r.status === 503 && r.body.code === 'mode_mismatch');
psql(`update pricing_settings set mode = 'test' where id = (select max(id) from pricing_settings)`);
ok('no order reached Razorpay while refused', ![...RZ.orders.values()].some((o) => o.receipt === c7.id));

// admin reports see it, marked as test
const ov = JSON.parse(asUser(S, 'select public.admin_billing_overview()::text;'));
ok('test payments are counted apart from real revenue', ov.payments.revenue_paise === 0 && ov.test.successful >= 4);

console.log(`\n${pass} passed, ${fail} failed (all payments simulated with a fake Razorpay in test mode)`);
process.exit(fail ? 1 : 0);
