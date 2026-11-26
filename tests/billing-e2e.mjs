/* Paid sharing end to end in a real browser, against the REAL billing SQL on a local Postgres
 * and the REAL sharing-campaign Edge Function code, with a FAKE Razorpay (no network, no money).
 *   PGHOST=… node tests/billing-e2e.mjs [output-folder]
 * What is fake: supabase-js (rpc and table reads run in Postgres as the signed-in user, so RLS
 * and the database's own checks apply), the Razorpay API and the Razorpay Checkout window. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const { chromium, devices } = createRequire(import.meta.url)('playwright')   // CommonJS package; NODE_PATH works here;
import { handle as campaignFn, hmacHex } from '../supabase/functions/sharing-campaign/index.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'e2e-output', 'billing'); fs.mkdirSync(OUT, { recursive: true });
const DB = process.env.PGDATABASE || 'ivx';
const res = []; const ok = (t, c, n = '') => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const psql = (q) => execFileSync('psql', ['-d', DB, '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: q, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
const lit = (v) => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;

/* ---------- fresh database ---------- */
execFileSync('psql', ['-d', 'postgres', '-q', '-f', path.join(ROOT, 'tests/supabase-stubs.sql')], { stdio: 'ignore' });
try { psql('create role service_role nologin'); } catch { /* exists */ }
for (const f of ['schema.sql', 'admin.sql', 'ai-designs.sql', 'billing.sql']) execFileSync('psql', ['-d', DB, '-q', '-v', 'ON_ERROR_STOP=1', '-f', path.join(ROOT, 'supabase', f)], { stdio: ['ignore', 'ignore', 'pipe'] });
const U = { sup: '5a000000-0000-0000-0000-000000000001', adm: '5b000000-0000-0000-0000-000000000002', host: '5c000000-0000-0000-0000-000000000003', kiran: '5d000000-0000-0000-0000-000000000004' };
const EMAIL = { [U.sup]: 'owner@example.com', [U.adm]: 'helper.admin@example.com', [U.host]: 'meera.host@example.com', [U.kiran]: 'kiran.host@example.com' };
const INV = { pay: 'f1000000-0000-0000-0000-000000000001', later: 'f1000000-0000-0000-0000-000000000002', host: 'f1000000-0000-0000-0000-000000000003' };
psql(`grant select on all tables in schema public to service_role; alter role service_role bypassrls;
insert into auth.users(id, email, created_at) values ('${U.sup}','owner@example.com', now() - interval '400 days'), ('${U.adm}','helper.admin@example.com', now() - interval '300 days'),
  ('${U.host}','meera.host@example.com', now() - interval '100 days'), ('${U.kiran}','kiran.host@example.com', now() - interval '90 days');
update profiles set role = 'super_admin' where user_id = '${U.sup}';
update profiles set role = 'admin' where user_id = '${U.adm}';
`);

/* ---------- fake Razorpay + Supabase REST for the Edge Function ---------- */
const SECRET = 'test_secret_e2e';
const RZ = { orders: new Map(), payments: new Map(), opened: [] };
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
const fnFetch = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith('/auth/v1/user')) { const t = (init.headers.authorization || '').replace('Bearer ', ''); return EMAIL[t] ? json({ id: t }) : json({ msg: 'bad jwt' }, 401); }
  const m = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
  if (m) {
    const named = Object.entries(JSON.parse(init.body || '{}')).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
    try { return new Response(psql(`set role service_role; select to_json(public.${m[1]}(${named}))::text;`).split('\n').pop()); } catch (e) { return json({ message: e.stderr?.toString() }, 400); }
  }
  if (url.startsWith('https://api.razorpay.test/v1')) {
    if (init.headers.authorization !== 'Basic ' + btoa('rzp_test_E2E:' + SECRET)) return json({ error: { description: 'auth' } }, 401);
    if (url.endsWith('/orders') && init.method === 'POST') { const b = JSON.parse(init.body); const id = 'order_E2E' + (RZ.orders.size + 1); RZ.orders.set(id, { id, ...b, status: 'created' }); return json(RZ.orders.get(id)); }
    let x = /\/orders\/(\w+)\/payments$/.exec(url); if (x) return json({ items: [...RZ.payments.values()].filter((p) => p.order_id === x[1]) });
    x = /\/payments\/(\w+)$/.exec(url); if (x) return RZ.payments.has(x[1]) ? json(RZ.payments.get(x[1])) : json({ error: { description: 'not found' } }, 404);
  }
  throw new Error('unexpected fetch ' + url);
};
const ENV = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'service-key', RAZORPAY_KEY_ID: 'rzp_test_E2E', RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_API_BASE: 'https://api.razorpay.test/v1' };
const capture = (order_id) => { const o = RZ.orders.get(order_id); const id = 'pay_E2E' + (RZ.payments.size + 1); RZ.payments.set(id, { id, order_id, status: 'captured', amount: o.amount, currency: 'INR', method: 'upi' }); return id; };

/* ---------- web server: static files, fake rpc, fake table reads, fake checkout payment ---------- */
function asUser(uid, q) {
  const who = uid ? `set role authenticated; select set_config('request.jwt.uid', ${lit(uid)}, false);` : "set role anon; select set_config('request.jwt.uid', '', false);";
  try { return { data: psql(`${who}\n${q}`).split('\n').pop() }; }
  catch (e) { const m = /ERROR:\s+(.*)/.exec(e.stderr.toString()); return { error: { message: m ? m[1] : e.stderr.toString() } }; }
}
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b ? JSON.parse(b) : {})); });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, rsp) => {
  rsp.setHeader('content-type', 'application/json');
  if (req.url === '/fake-rpc') {
    const { uid, fn, args } = await body(req);
    if (!/^[a-z_]+$/.test(fn)) return rsp.end(JSON.stringify({ error: { message: 'bad fn' } }));
    const r = asUser(uid, `select to_json(public.${fn}(${Object.entries(args || {}).map(([k, v]) => `${k} => ${lit(v)}`).join(', ')}))::text;`);
    return rsp.end(JSON.stringify(r.error ? { data: null, error: r.error } : { data: r.data === '' ? null : JSON.parse(r.data), error: null }));
  }
  if (req.url === '/fake-select') {
    const { uid, table, eq, order, single } = await body(req);
    if (!/^[a-z_]+$/.test(table)) return rsp.end('{}');
    const where = eq.length ? ' where ' + eq.map(([c, v]) => `${c.replace(/[^a-z_]/g, '')} = ${lit(v)}`).join(' and ') : '';
    const ord = order ? ` order by ${order[0].replace(/[^a-z_]/g, '')} ${order[1] ? 'asc' : 'desc'}` : '';
    const r = asUser(uid, `select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (select * from public.${table}${where}${ord}) t;`);
    const rows = r.error ? null : JSON.parse(r.data);
    return rsp.end(JSON.stringify(r.error ? { data: null, error: r.error } : { data: single ? rows[0] || null : rows, error: null }));
  }
  if (req.url === '/fake-checkout-pay') {   // the "customer pays in the UPI app" step of the fake Razorpay window
    const { order_id, opts } = await body(req); RZ.opened.push(opts);
    const pid = capture(order_id);
    return rsp.end(JSON.stringify({ razorpay_order_id: order_id, razorpay_payment_id: pid, razorpay_signature: await hmacHex(SECRET, order_id + '|' + pid) }));
  }
  if (req.url === '/fake-checkout-open') { const { opts } = await body(req); RZ.opened.push(opts); return rsp.end('{}'); }
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.statusCode = 404; return rsp.end(); }
  rsp.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(rsp);
});
const FAKE = `window.supabase = { createClient() {
  const uid = () => localStorage.getItem('fakeUid') || '';
  const emails = ${JSON.stringify(EMAIL)};
  const user = () => uid() ? { id: uid(), email: emails[uid()] || 'x@example.com', user_metadata: {} } : null;
  const post = async (u, b) => (await fetch(u, { method: 'POST', body: JSON.stringify(b) })).json();
  const rpc = (fn, args) => post('/fake-rpc', { uid: uid(), fn, args });
  const from = (table) => { const s = { eq: [], order: null, single: false };
    const q = { select() { return q; }, eq(c, v) { s.eq.push([c, v]); return q; }, order(c, o) { s.order = [c, !o || o.ascending !== false]; return q; },
      maybeSingle() { s.single = true; return q; }, single() { s.single = true; return q; },
      then(a, b) { return post('/fake-select', { uid: uid(), table, ...s }).then(a, b); } };
    return q; };
  return {
    auth: { getUser: async () => ({ data: { user: user() } }), getSession: async () => ({ data: { session: user() ? { access_token: uid(), user: user() } : null } }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => { localStorage.removeItem('fakeUid'); } },
    rpc, from, storage: { from: () => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ data: [], error: null }), getPublicUrl: (p) => ({ data: { publicUrl: '/' + p } }) }) },
  };
} };`;
// stand-in for https://checkout.razorpay.com/v1/checkout.js
const CHECKOUT = `window.Razorpay = function (opts) { this.opts = opts; this.h = {}; };
window.Razorpay.prototype.on = function (n, f) { this.h[n] = f; };
window.Razorpay.prototype.open = async function () {
  const o = this.opts, safe = JSON.parse(JSON.stringify(o));
  if (window.__rzpMode === 'close') { await fetch('/fake-checkout-open', { method: 'POST', body: JSON.stringify({ opts: safe }) }); setTimeout(() => o.modal.ondismiss(), 100); return; }
  const r = await (await fetch('/fake-checkout-pay', { method: 'POST', body: JSON.stringify({ order_id: o.order_id, opts: safe }) })).json();
  setTimeout(() => o.handler(r), 100);
};`;
const CONFIG = "window.INVITEX_CONFIG={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test',MEDIA_BUCKET:'invite-media',PUBLIC_BASE_URL:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};";

await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;
const b = await chromium.launch();
const errs = [];
const open = async (uid, url, opts = {}) => {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 900 }, acceptDownloads: true }, opts));
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: CONFIG }));
  await ctx.route(/supabase-js@/, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
  await ctx.route(/checkout\.razorpay\.com/, (r) => r.fulfill({ contentType: 'text/javascript', body: CHECKOUT }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await ctx.route(/\/functions\/v1\/sharing-campaign/, async (r) => {
    const q = r.request();
    const out = await campaignFn(new Request('https://fn.test', { method: 'POST', headers: { authorization: q.headers().authorization || '' }, body: q.postData() }), ENV, fnFetch);
    r.fulfill({ status: out.status, contentType: 'application/json', body: await out.text() });
  });
  if (uid) await ctx.addInitScript((u) => localStorage.setItem('fakeUid', u), uid);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + url); await p.waitForTimeout(600);
  return p;
};
const shot = async (p, name) => { await p.addStyleTag({ content: '.toast,[class*=toast]{display:none!important}' }); await p.screenshot({ path: path.join(OUT, name), fullPage: true }); };
const text = (p, sel = '#view') => p.locator(sel).innerText();
const noSideScroll = (p) => p.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1);

// invitations made by the app's own model, so they look like real ones
{
  const p0 = await open(null, 'index.html#/');
  const mk = await p0.evaluate(() => [['Anita weds Rohan'], ['Diwali party'], ['Meera weds Kabir']].map(([t]) => {
    const inv = IX.model.newInvitation('wedding'); inv.text = inv.text || {}; inv.text.en = Object.assign({}, inv.text.en, { title: t });
    (inv.events || [])[0] && Object.assign(inv.events[0], { date: new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10), time: '19:00' });
    delete inv.id; return inv;
  }));
  await p0.context().close();
  const row = (id, owner, slug, d) => `('${id}', '${owner}', '${slug}', 'published', ${lit(d)}, ${lit(d)}, now())`;
  psql(`insert into invitations(id, owner_id, slug, status, data, published, published_at) values ${row(INV.pay, U.sup, 'owner-wedding', mk[0])}, ${row(INV.later, U.sup, 'owner-party', mk[1])}, ${row(INV.host, U.host, 'meera-wedding', mk[2])};
insert into guests(invitation_id, name, phone) values ('${INV.pay}', 'Rakesh', '9876543210'), ('${INV.pay}', 'Sunita', '9876543211'), ('${INV.later}', 'Amit', '9876500001'), ('${INV.host}', 'Ravi', '9876500002');`);
}

try {
  /* 1. A host in test mode is never held back: sharing opens free by itself */
  const guestPage = async (slug) => { const p = await open(null, 'invite.html?i=' + slug); await p.waitForFunction(() => !/Opening your invitation/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {}); const t = await p.locator('body').innerText(); await p.context().close(); return t; };
  let gt = await guestPage('meera-wedding');
  ok('guest: a free host\'s link opens straight away (test mode: only admins pay)', /Meera weds Kabir/.test(gt) && !/not open yet/i.test(gt), gt.replace(/\s+/g, ' ').slice(0, 80));
  let h = await open(U.host, `index.html#/dash/${INV.host}/share`);
  await h.waitForSelector('.cm-strip');
  ok('host: Share tab shows an open free campaign, no price, no pay button', /Free|free/.test(await text(h, '#cmBox')) && !/₹/.test(await text(h, '#cmBox')) && (await h.locator('#cmPay, #cmStart').count()) === 0, (await text(h, '#cmBox')).replace(/\s+/g, ' ').slice(0, 160));
  ok('host: sharing tools are there', (await h.locator('#shareBox').innerText()).length > 20);
  await shot(h, '1-host-free.png');
  await h.context().close();
  gt = await guestPage('owner-wedding');
  ok('guest: a paying host\'s link says "not open yet" before payment', /not open yet/i.test(gt), gt.replace(/\s+/g, ' ').slice(0, 80));

  /* 2. The Super Admin pays ₹20 (test money) through Razorpay Checkout */
  let s = await open(U.sup, `index.html#/dash/${INV.pay}/guests`);
  await s.waitForTimeout(500);
  await s.waitForSelector('.cm-locked', { timeout: 5000 }).catch(() => {});
  ok('guest list: locked note and "Start sharing" instead of WhatsApp buttons', /start sharing/i.test(await text(s)) && (await s.locator('.cm-locked').count()) >= 1);
  await s.goto(BASE + `index.html#/dash/${INV.pay}/share`); await s.waitForSelector('#cmStart');
  const card = await text(s, '#cmBox');
  ok('pay card: ₹20 once by UPI, TEST MODE badge', /₹20/.test(card) && /once, by UPI/.test(card) && /TEST MODE/.test(card), card.replace(/\s+/g, ' ').slice(0, 200));
  await shot(s, '3-pay-card.png');
  await s.click('#cmStart'); await s.waitForSelector('.cm-strip', { timeout: 8000 });
  const opened = RZ.opened[0] || {};
  ok('checkout: opened with the server order, test key, ₹20 in paise', opened.order_id === 'order_E2E1' && opened.key === 'rzp_test_E2E' && opened.amount === 2000, JSON.stringify({ o: opened.order_id, k: opened.key, a: opened.amount }));
  ok('checkout: UPI only', JSON.stringify(opened.config?.display?.blocks) === JSON.stringify({ upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] } }) && opened.config.display.preferences.show_default_blocks === false);
  ok('checkout: test payments labelled [TEST]', /^\[TEST\]/.test(opened.description || ''));
  ok('after paying: strip shows Paid ₹20 and sharing tools open', /Paid ₹20/.test(await text(s, '.cm-strip')) && (await s.locator('#shareBox').innerText()).length > 20);
  gt = await guestPage('owner-wedding');
  ok('guest: link opens after payment', /Anita weds Rohan/.test(gt) && !/not open yet/i.test(gt), gt.replace(/\s+/g, ' ').slice(0, 80));
  ok('database: one paid entitlement, verified by checkout', psql(`select count(*) || ':' || max(t.verified_via::text) from campaign_entitlements e join payment_transactions t on t.id = e.transaction_id where e.grant_type = 'paid';`) === '1:{checkout}');
  await shot(s, '4-paid-open.png');
  await s.click('[data-tab=guests]'); await s.waitForTimeout(500);
  ok('guest list: WhatsApp buttons back after payment', (await s.locator('.cm-locked').count()) === 0);

  /* 3. Closed the payment window, paid in the UPI app anyway, then "I already paid" */
  await s.goto(BASE + `index.html#/dash/${INV.later}/share`); await s.waitForSelector('#cmStart');
  await s.evaluate(() => { window.__rzpMode = 'close'; });
  await s.click('#cmStart'); await s.waitForSelector('#cmCheck', { timeout: 8000 });
  ok('closed window: pay card stays, with "I already paid" and "Not now"', /Pay ₹20 by UPI/.test(await text(s, '#cmBox')) && (await s.locator('#cmCancel').count()) === 1);
  await shot(s, '5-pay-again.png');
  const order2 = [...RZ.orders.keys()].pop();
  capture(order2);   // the payment reached Razorpay although the browser never heard back
  await s.click('#cmCheck'); await s.waitForSelector('.cm-strip', { timeout: 8000 });
  ok('"I already paid": server checks Razorpay and opens sharing', /Paid ₹20/.test(await text(s, '.cm-strip')));
  ok('database: same order reused, never two orders for one campaign', psql(`select count(*) from payment_orders where campaign_id = (select id from sharing_campaigns where invitation_id = '${INV.later}');`) === '1');

  /* 4. The browser cannot unlock or set prices by itself */
  const forged = await s.evaluate(async (inv) => { try { await H.store.payment('verify', { campaign_id: 'x', razorpay_order_id: 'order_fake', razorpay_payment_id: 'pay_fake', razorpay_signature: 'f'.repeat(64) }); return 'accepted'; } catch (e) { return e.message; } }, INV.pay);
  ok('forged checkout signature is refused', forged !== 'accepted', forged);
  const direct = await s.evaluate(async () => (await fetch('/fake-select', { method: 'POST', body: JSON.stringify({ uid: localStorage.getItem('fakeUid'), table: 'pricing_settings', eq: [] }) })).json());
  ok('host session cannot read pricing tables directly', !!direct.error || (direct.data || []).length === 0, JSON.stringify(direct).slice(0, 120));

  /* 5. Super Admin money screens */
  await s.goto(BASE + 'index.html#/admin'); await s.waitForSelector('.hx-tiles');
  ok('admin menu: money screens in order', (await s.locator('.ax-rail a').allInnerTexts()).map((x) => x.trim()).join(',').startsWith('Overview,Users,Invitations,Sharing campaigns,Pricing control,Free access,Payment transactions,Revenue reports,Usage analytics,System settings,Audit log'),
    (await s.locator('.ax-rail a').allInnerTexts()).map((x) => x.trim()).join(','));
  const ov = await text(s);
  ok('overview: charging on ₹20, TEST MODE, 3 campaigns', /Charging ON · ₹20/.test(ov) && /TEST MODE/.test(ov) && /Sharing campaigns\s*3/.test(ov), ov.replace(/\s+/g, ' ').slice(0, 300));
  ok('overview: test payments kept apart from real revenue', /Revenue\s*₹0/.test(ov) && /Test payments: 2 \(₹40\)/.test(ov));
  await shot(s, '6-admin-overview.png');

  await s.click('.ax-rail a[href="#/admin/pricing"]'); await s.waitForSelector('#pPrice');
  await s.fill('#pPrice', '5'); await s.click('#pf button[type=submit]'); await s.waitForTimeout(700);
  ok('pricing: ₹5 refused (₹10 to ₹100)', psql('select price_paise from pricing_settings order by id desc limit 1') === '2000');
  await s.fill('#pPrice', '35'); await s.fill('#pNote', 'Diwali price'); await s.click('#pf button[type=submit]'); await s.waitForTimeout(900);
  ok('pricing: ₹35 saved as a new version', psql('select price_paise || \':\' || note from pricing_settings order by id desc limit 1') === '3500:Diwali price');
  await shot(s, '7-admin-pricing.png');

  await s.click('.ax-rail a[href="#/admin/free"]'); await s.waitForSelector('#fxE');
  await s.fill('#fxE', 'kiran.host@example.com'); await s.fill('#fxR', 'Friend of the family');
  await s.click('#fx button[type=submit]'); await s.waitForTimeout(900);
  ok('free access: granted to a selected person and listed', /kiran\.host@example\.com/.test(await text(s)) && psql(`select count(*) from user_access_exemptions where user_id = '${U.kiran}' and revoked_at is null`) === '1');
  await shot(s, '8-admin-free.png');

  await s.click('.ax-rail a[href="#/admin/payments"]'); await s.waitForSelector('#axRows');
  await s.waitForTimeout(400);
  ok('payments: real-money list is empty in test mode', /No payments match/.test(await text(s, '#axRows')));
  await s.check('#pTest'); await s.waitForTimeout(700);
  ok('payments: test list shows both ₹20 payments with Razorpay ids', (await s.locator('#axRows tr').count()) === 2 && /pay_E2E/.test(await text(s, '#axRows')) && /TEST/.test(await text(s, '#axRows')));
  const [dl] = await Promise.all([s.waitForEvent('download'), s.click('#pCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  ok('payments: CSV export has a header and both rows', csv.split('\n').filter(Boolean).length === 3 && /Razorpay payment id/.test(csv) && /owner@example\.com/.test(csv), dl.suggestedFilename());
  await shot(s, '9-admin-payments.png');

  await s.click('.ax-rail a[href="#/admin/revenue"]'); await s.waitForSelector('#rBody .hx-tiles');
  await s.check('#rTest'); await s.waitForTimeout(700);
  ok('revenue: test revenue ₹40 from 2 payments', /₹40/.test(await text(s, '#rBody')) && /2 payments/.test(await text(s, '#rBody')));
  await shot(s, '10-admin-revenue.png');

  await s.click('.ax-rail a[href="#/admin/campaigns"]'); await s.waitForTimeout(800);
  ok('campaigns: all three campaigns listed', (await s.locator('#axRows tr').count()) === 3, (await text(s, '#axRows')).replace(/\s+/g, ' ').slice(0, 200));

  await s.click('.ax-rail a[href="#/admin/system"]'); await s.waitForSelector('#sConfirm');
  await s.fill('#sConfirm', 'yes'); await s.click('#sLive button[type=submit]'); await s.waitForTimeout(400);
  const dlg = s.locator('.modal .btn.danger, .modal .btn.primary').last(); if (await dlg.count()) await dlg.click(); await s.waitForTimeout(800);
  ok('system: live switch refused without the exact approval sentence', psql('select mode from pricing_settings order by id desc limit 1') === 'test');
  await shot(s, '11-admin-system.png');

  await s.click('.ax-rail a[href="#/admin/activity"]'); await s.waitForSelector('#axRows li');
  ok('audit log: price change recorded with old and new price', /₹20.*₹35|20.*→.*35/s.test(await text(s, '#axRows')), (await text(s, '#axRows')).split('\n').slice(0, 3).join(' | '));
  await s.context().close();

  /* 6. A plain admin can look but not change money settings */
  const a = await open(U.adm, 'index.html#/admin/pricing'); await a.waitForSelector('#pPrice');
  ok('plain admin: pricing is view only', await a.locator('#pPrice').isDisabled() && /Only the Super Admin/.test(await text(a)));
  const refused = await a.evaluate(async () => { try { await H.store.admin('set_pricing', { p: { price_rupees: 10 } }); return 'saved'; } catch (e) { return e.message; } });
  ok('plain admin: database refuses a price change', refused !== 'saved' && psql('select price_paise from pricing_settings order by id desc limit 1') === '3500', refused);
  await a.context().close();

  /* 7. Phone layout */
  const m = await open(U.sup, `index.html#/dash/${INV.pay}/share`, devices['iPhone 13']); await m.waitForSelector('.cm-strip');
  ok('phone: share panel fits the screen', await noSideScroll(m));
  await shot(m, '12-phone-share.png');
  await m.goto(BASE + 'index.html#/admin/pricing'); await m.waitForSelector('#pPrice');
  ok('phone: pricing screen fits the screen', await noSideScroll(m));
  await shot(m, '13-phone-pricing.png');
  await m.context().close();

  ok('no page errors', errs.length === 0, errs.join(' | '));
} catch (e) { console.error(e); res.push(false); }
await b.close(); server.close();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
