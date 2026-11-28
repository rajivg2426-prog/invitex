// Buying a marketplace design through the sharing-campaign and razorpay-webhook Edge Functions,
// against the REAL billing + marketplace SQL on a local Postgres, with a FAKE Razorpay (no real money).
// Setup + run (see docs/PAYMENTS_SETUP.md, "Running the tests"):
//   PGHOST=… node tests/design-purchase-function-test.mjs
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
for (const f of ['supabase/schema.sql', 'supabase/admin.sql', 'supabase/ai-designs.sql', 'supabase/billing.sql', 'supabase/marketplace.sql']) execFileSync('psql', ['-d', DB, '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { stdio: ['ignore', 'ignore', 'pipe'] });
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
const D = '30000000-0000-0000-0000-000000000003';
psql(`insert into auth.users(id, email) values ('${D}', 'meera@studio.test');
insert into designers(user_id, display_name, slug, city, state, referral_code, agreement_version) values ('${D}', 'Meera Studio', 'meera-studio', 'Jaipur', 'Rajasthan', 'meeraref', '2026-11-pilot');
insert into designs(id, designer_id, title, occasion, price_paise, status, approved_at, pages, palettes)
values ('40000000-0000-0000-0000-000000000004', '${D}', 'Rajwada Gold', 'wedding', 14900, 'live', now(),
        '[{"role":"front","path":"${D}/dx/front.png","preview":"${D}/dx/front.webp","zones":[]}]', '[{"bg":"#300"}]');`);
const G = '40000000-0000-0000-0000-000000000004';
const lic = (uid) => one(`select count(*) from template_licenses where user_id = '${uid}' and design_id = '${G}' and status = 'active'`);

let r = await call(null, { action: 'design_order', design_id: G });
ok('no sign-in → 401', r.status === 401);
r = await call('tok-H', { action: 'design_order', design_id: 'nope' });
ok('bad design id → 400', r.status === 400);
r = await call('tok-H', { action: 'design_order', design_id: G }, { ...ENV, RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' });
ok('no Razorpay keys → not configured', r.status === 503 && r.body.code === 'not_configured' && RZ.orders.size === 0);
r = await call('tok-H', { action: 'design_order', design_id: G, amount_paise: 100, ref: 'meeraref' });
ok('order for the server price ₹149, browser amount ignored', r.body.status === 'checkout' && r.body.amount_paise === 14900 && RZ.orders.get(r.body.order_id).amount === 14900, JSON.stringify(r.body));
ok('order notes say it is a design', RZ.orders.get(r.body.order_id).notes.kind === 'design' && RZ.orders.get(r.body.order_id).notes.design_id === G);
const o1 = r.body.order_id;
r = await call('tok-H', { action: 'design_order', design_id: G });
ok('retry reuses the order', r.body.order_id === o1 && RZ.orders.size === 1);

pay('pay_d1', o1, 'captured', 14900, { fee: 352 });
r = await call('tok-H', { action: 'design_verify', design_id: G, razorpay_order_id: o1, razorpay_payment_id: 'pay_d1', razorpay_signature: 'forged' });
ok('forged signature refused, no licence', r.status === 400 && lic(H) === '0');
r = await call('tok-K', { action: 'design_verify', design_id: G, razorpay_order_id: o1, razorpay_payment_id: 'pay_d1', razorpay_signature: await hmacHex(SECRET, `${o1}|pay_d1`) });
ok('another user cannot claim the payment', r.status === 404 && lic(K) === '0');
r = await call('tok-H', { action: 'design_verify', design_id: G, razorpay_order_id: o1, razorpay_payment_id: 'pay_d1', razorpay_signature: await hmacHex(SECRET, `${o1}|pay_d1`) });
ok('verified capture grants the licence', r.body.result === 'unlocked' && lic(H) === '1', JSON.stringify(r.body));
const led = one(`select json_build_object('amt', amount_paise, 'pct', share_pct, 'net', net_paise)::text from designer_ledger where designer_id = '${D}' and kind = 'sale'`);
ok('designer earns 80% of net on a referred sale (₹98.20)', JSON.parse(led).amt === 9820 && JSON.parse(led).pct === 80, led);
r = await hook('payment.captured', RZ.payments.get('pay_d1'));
ok('webhook for the same payment changes nothing', r.body.result === 'design already_unlocked' && lic(H) === '1', JSON.stringify(r.body));
r = await call('tok-H', { action: 'design_order', design_id: G });
ok('owned design: no new order', r.body.status === 'owned' && RZ.orders.size === 1);

// browser closed: webhook unlocks; amount mismatch never unlocks
let o2 = (await call('tok-K', { action: 'design_order', design_id: G })).body.order_id;
r = await hook('payment.captured', pay('pay_d2', o2, 'captured', 14900));
ok('webhook alone unlocks when the browser closed', r.body.result === 'design unlocked' && lic(K) === '1');
ok('fee estimated when Razorpay has not reported it', one(`select fee_paise from template_licenses where provider_payment_id = 'pay_d2'`) === '352');
psql(`insert into auth.users(id, email) values ('60000000-0000-0000-0000-000000000006', 'x@example.com'); insert into profiles(user_id) values ('60000000-0000-0000-0000-000000000006') on conflict do nothing;`);
TOKENS['tok-X'] = '60000000-0000-0000-0000-000000000006';
const o3 = (await call('tok-X', { action: 'design_order', design_id: G })).body.order_id;
r = await hook('payment.captured', pay('pay_d3', o3, 'captured', 100));
ok('wrong amount: flagged for refund, no licence', r.body.result === 'design refund_due' && lic(TOKENS['tok-X']) === '0');

// pending UPI then status check; reconcile
psql(`update design_orders set status = 'expired' where provider_order_id = '${o3}'`);
const o4 = (await call('tok-X', { action: 'design_order', design_id: G })).body.order_id;
pay('pay_d4', o4, 'authorized', 14900);
r = await call('tok-X', { action: 'design_status', design_id: G });
ok('UPI still pending → pending', r.body.result === 'pending' && lic(TOKENS['tok-X']) === '0');
RZ.payments.get('pay_d4').status = 'captured';
psql(`update design_orders set created_at = now() - interval '40 minutes' where provider_order_id = '${o4}'`);
r = await call('service-key', { action: 'reconcile' });
ok('reconcile picks up a lost design payment', r.status === 200 && lic(TOKENS['tok-X']) === '1', JSON.stringify(r.body).slice(0, 200));

// refund ends the licence and reverses the pending earning
r = await hook('refund.processed', { id: 'rfnd_d1', payment_id: 'pay_d2', amount: 14900, status: 'processed' });
ok('refund webhook ends the licence', r.body.result === 'design refund ok' && lic(K) === '0', JSON.stringify(r.body));
ok('designer earning for that sale reversed', one(`select count(*) from designer_ledger where kind = 'refund' and amount_paise < 0`) === '1');

// campaign payments still work beside design payments
r = await hook('refund.processed', { id: 'rfnd_x', payment_id: 'pay_unknown', amount: 1, status: 'processed' });
ok('unknown refund is harmless', r.status === 200 && r.body.result === 'design refund unknown_payment');

// design paused after the order: never sold
psql(`update designs set status = 'paused' where id = '${G}'`);
r = await call('tok-S', { action: 'design_order', design_id: G });
ok('paused design cannot be bought', r.status === 404);

console.log(`\n${pass} passed, ${fail} failed (design purchases simulated with a fake Razorpay)`);
process.exit(fail ? 1 : 0);
