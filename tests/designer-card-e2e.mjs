/* Designer cards for hosts, end to end in a real browser: pick a marketplace design in step 1,
 * see your words in the designer's boxes, pay once by UPI at Publish, guests see the full artwork.
 * Against the REAL billing + marketplace SQL on a local Postgres and the REAL sharing-campaign
 * Edge Function code, with a FAKE Razorpay (no network, no money).
 *   PGHOST=… node tests/designer-card-e2e.mjs [output-folder]
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
const OUT = process.argv[2] || path.join(ROOT, 'tests', 'e2e-output', 'designer-card'); fs.mkdirSync(OUT, { recursive: true });
const DB = process.env.PGDATABASE || 'ivx';
const res = []; const ok = (t, c, n = '') => { res.push(!!c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const psql = (q) => execFileSync('psql', ['-d', DB, '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: q, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
const lit = (v) => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v)
  : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;

/* ---------- fresh database ---------- */
execFileSync('psql', ['-d', 'postgres', '-q', '-f', path.join(ROOT, 'tests/supabase-stubs.sql')], { stdio: 'ignore' });
try { psql('create role service_role nologin'); } catch { /* exists */ }
for (const f of ['schema.sql', 'admin.sql', 'ai-designs.sql', 'billing.sql', 'marketplace.sql']) execFileSync('psql', ['-d', DB, '-q', '-v', 'ON_ERROR_STOP=1', '-f', path.join(ROOT, 'supabase', f)], { stdio: ['ignore', 'ignore', 'pipe'] });
const U = { host: '5c000000-0000-0000-0000-000000000003', kiran: '5d000000-0000-0000-0000-000000000004', meera: '5e000000-0000-0000-0000-000000000005' };
const EMAIL = { [U.host]: 'anita.host@example.com', [U.kiran]: 'kiran.host@example.com', [U.meera]: 'meera@studio.test' };
const INV = { a: 'f2000000-0000-0000-0000-000000000001', k: 'f2000000-0000-0000-0000-000000000002' };
const G = 'a7000000-0000-0000-0000-000000000007';
psql(`grant select on all tables in schema public to service_role; alter role service_role bypassrls;
insert into auth.users(id, email, created_at) values ('${U.host}','anita.host@example.com', now() - interval '100 days'), ('${U.kiran}','kiran.host@example.com', now() - interval '90 days'), ('${U.meera}','meera@studio.test', now() - interval '90 days');
insert into designers(user_id, display_name, slug, city, state, referral_code, agreement_version, pilot_bonus_until) values ('${U.meera}', 'Meera Studio', 'meera-studio', 'Jaipur', 'Rajasthan', 'meeraref', '2026-11-pilot', null);
insert into designs(id, designer_id, title, occasion, price_paise, status, approved_at, font_pairing, palettes, pages) values ('${G}', '${U.meera}', 'Rajwada Gold', 'wedding', 14900, 'live', now(), 'classic',
  '[{"bg":"#3b0a16","text":"#f6e7c8","accent":"#d4a24c"},{"bg":"#102a43","text":"#ffffff","accent":"#c9a227"}]',
  '[{"role":"front","path":"${U.meera}/dRw7x/front.png","preview":"${U.meera}/dRw7x/front.webp","w":1000,"h":1400,"zones":[
     {"key":"title","x":0.15,"y":0.18,"w":0.7,"h":0.06,"align":"center"},{"key":"names","x":0.1,"y":0.3,"w":0.8,"h":0.13,"align":"center"},
     {"key":"date","x":0.15,"y":0.55,"w":0.7,"h":0.09,"align":"center"},{"key":"venue","x":0.15,"y":0.7,"w":0.7,"h":0.09,"align":"left"}]}]');`);
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
  if (req.url === '/fake-upsert') {   // insert-or-update as the signed-in user: RLS and triggers apply
    const { uid, table, row } = await body(req);
    if (!/^[a-z_]+$/.test(table)) return rsp.end('{}');
    const cols = Object.keys(row).filter((k) => /^[a-z_]+$/.test(k));
    const r = asUser(uid, `insert into public.${table} (${cols.join(',')}) select ${cols.join(',')} from jsonb_populate_record(null::public.${table}, ${lit(row)})
      on conflict (id) do update set ${cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')} returning to_jsonb(${table})::text;`);
    return rsp.end(JSON.stringify(r.error ? { data: null, error: r.error } : { data: JSON.parse(r.data), error: null }));
  }
  if (req.url.startsWith('/fake-storage/')) {   // designer previews and artwork (made at the start of the test)
    const f = req.url.startsWith('/fake-storage/designer-art/') ? IMG.art : req.url.startsWith('/fake-storage/designer-previews/') ? IMG.preview : null;
    if (!f) { rsp.statusCode = 404; return rsp.end(); }
    rsp.setHeader('content-type', 'image/png'); return rsp.end(f);
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
      upsert(row) { s.upsert = row; return q; },
      then(a, b) { return (s.upsert ? post('/fake-upsert', { uid: uid(), table, row: s.upsert }) : post('/fake-select', { uid: uid(), table, ...s })).then(a, b); } };
    return q; };
  return {
    auth: { getUser: async () => ({ data: { user: user() } }), getSession: async () => ({ data: { session: user() ? { access_token: uid(), user: user() } : null } }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => { localStorage.removeItem('fakeUid'); } },
    rpc, from, storage: { from: (bucket) => ({ list: async () => ({ data: [], error: null }), remove: async () => ({ data: [], error: null }), getPublicUrl: (p) => ({ data: { publicUrl: '/fake-storage/' + bucket + '/' + p } }) }) },
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


// card pictures: the watermarked preview and the full artwork (different, so the test can tell them apart)
const IMG = {};
{
  const bb = await chromium.launch(); const pg = await bb.newPage();
  const draw = (wm) => pg.evaluate((wm) => { const c = document.createElement('canvas'); c.width = 1000; c.height = 1400; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1000, 1400); g.addColorStop(0, '#5a0f24'); g.addColorStop(1, '#3b0a16'); x.fillStyle = g; x.fillRect(0, 0, 1000, 1400);
    x.strokeStyle = '#d4a24c'; x.lineWidth = 14; x.strokeRect(40, 40, 920, 1320); x.strokeRect(70, 70, 860, 1260);
    x.fillStyle = '#d4a24c'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(500 + 380 * Math.cos(i * Math.PI / 4), 700 + 560 * Math.sin(i * Math.PI / 4), 18, 0, 7); x.fill(); }
    if (wm) { x.save(); x.translate(500, 700); x.rotate(-0.5); x.font = '600 60px sans-serif'; x.fillStyle = 'rgba(255,255,255,.35)'; x.textAlign = 'center'; for (let y = -900; y < 900; y += 160) x.fillText('InviteX preview', 0, y); x.restore(); }
    return c.toDataURL('image/png').split(',')[1]; }, wm);
  IMG.preview = Buffer.from(await draw(true), 'base64'); IMG.art = Buffer.from(await draw(false), 'base64');
  await bb.close();
}

// two draft invitations made by the app's own model, with a date and a link name
{
  const p0 = await open(null, 'index.html#/');
  const mk = await p0.evaluate(() => [['Anita & Rohan', 'anita-rohan'], ['Kiran & Dev', 'kiran-dev']].map(([t, slug]) => {
    const inv = IX.model.newInvitation('wedding'); inv.text.en = Object.assign({}, inv.text.en, { title: t, subtitle: 'Wedding Invitation' });
    Object.assign(inv.events[0], { date: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), start: '19:00', venue: 'Rambagh Palace', city: 'Jaipur' });
    delete inv.id; return [inv, slug];
  }));
  await p0.context().close();
  psql(`insert into invitations(id, owner_id, slug, status, data) values ('${INV.a}', '${U.host}', '${mk[0][1]}', 'draft', ${lit(mk[0][0])}), ('${INV.k}', '${U.kiran}', '${mk[1][1]}', 'draft', ${lit(mk[1][0])});`);
}

try {
  /* 1. the designer's sales link opens a new invitation and is remembered for this visit */
  let h = await open(U.host, 'index.html#/new?designer=meera-studio&ref=meeraref');
  await h.waitForURL(/#\/edit\/[0-9a-f-]{36}\/1/, { timeout: 8000 }).catch(() => {});
  ok('sales link: opens the editor for a new invitation', /#\/edit\/[0-9a-f-]{36}\/1/.test(h.url()), h.url());
  ok('sales link: designer and referral remembered', await h.evaluate(() => (IXMarket.referral() || {}).ref === 'meeraref'));

  /* 2. step 1 → Designer cards: tile, choose, preview shows the words in the boxes */
  await h.goto(BASE + `index.html#/edit/${INV.a}/1`); await h.waitForSelector('[data-way=market]');
  await h.click('[data-way=market]'); await h.waitForSelector('[data-mk]');
  const tile = await text(h, '#mkGrid');
  ok('gallery: the live design with designer and price', /Rajwada Gold/.test(tile) && /Meera Studio/.test(tile) && /₹149/.test(tile), tile.replace(/\s+/g, ' '));
  ok('gallery: tile uses the watermarked preview', /\/fake-storage\/designer-previews\//.test(await h.locator('[data-mk] img').getAttribute('src')));
  await h.click('[data-mk]'); await h.waitForSelector('.mk-cur');
  ok('chosen: "paid when you publish" shown', /₹149, paid when you publish/.test(await text(h, '.mk-cur')));
  await h.waitForTimeout(1200);
  const pv = h.frameLocator('#pvIframe');
  await pv.locator('.ix-mk-card').waitFor({ timeout: 6000 }).catch(() => {});
  const zt = await pv.locator('.ix-mk-z').allInnerTexts().catch(() => []);
  ok('preview: designer card with the host\'s words in 4 boxes', zt.length === 4 && zt.some((x) => /Anita & Rohan/.test(x)) && zt.some((x) => /Rambagh Palace/.test(x)) && zt.some((x) => /Wedding Invitation/.test(x)), JSON.stringify(zt));
  const fits = await pv.locator('.ix-mk-z').evaluateAll((els) => els.every((z) => z.firstElementChild.scrollHeight <= z.clientHeight + 1 && z.firstElementChild.scrollWidth <= z.clientWidth + 1));
  ok('preview: every box\'s words fit inside it', fits);
  ok('preview: words use the design\'s colour', (await pv.locator('.ix-mk-z').first().evaluate((z) => getComputedStyle(z).color)) === 'rgb(246, 231, 200)');
  await shot(h, '1-editor-designer-card.png');
  ok('nothing bought yet', psql(`select count(*) from template_licenses`) === '0');

  /* 3. Publish → pay ₹149 by UPI → published with the full artwork */
  await h.goto(BASE + `index.html#/edit/${INV.a}/5`); await h.waitForTimeout(800);
  await h.click('#pubBig'); await h.waitForSelector('#modalRoot .modal');
  const ask = await text(h, '#modalRoot .modal');
  ok('publish asks to buy first, with the price', /Buy “Rajwada Gold”/.test(ask) && /₹149/.test(ask) && /UPI/.test(ask), ask.replace(/\s+/g, ' ').slice(0, 200));
  await shot(h, '2-buy.png');
  await h.click('#modalRoot .modal [data-a="1"]');
  await h.waitForFunction(() => /Guests now see|published/i.test(document.body.innerText), null, { timeout: 10000 }).catch(() => {});
  await h.waitForTimeout(800);
  const opened = RZ.opened[0] || {};
  ok('checkout: server order for ₹149, UPI only, [TEST]', opened.amount === 14900 && /^\[TEST\] Designer card: Rajwada Gold/.test(opened.description || '') && opened.config?.display?.preferences?.show_default_blocks === false, JSON.stringify({ a: opened.amount, d: opened.description }));
  const pubRow = JSON.parse(psql(`select json_build_object('status', status, 'mk', published->'marketplace'->>'designId', 'img', published->'design'->'market'->>'image', 'owned', published->'design'->'market'->>'owned')::text from invitations where id = '${INV.a}'`));
  ok('published with the design id and the full artwork (not the preview)', pubRow.status === 'published' && pubRow.mk === G && /designer-art\//.test(pubRow.img) && pubRow.owned === 'true', JSON.stringify(pubRow));
  const sale = JSON.parse(psql(`select json_build_object('ref', l.referral_code, 'pct', e.share_pct, 'amt', e.amount_paise)::text from template_licenses l join designer_ledger e on e.license_id = l.id where l.user_id = '${U.host}'`));
  ok('sale booked through the sales link: 80% of net to the designer (₹98.20)', sale.ref === 'meeraref' && sale.pct === 80 && sale.amt === 9820, JSON.stringify(sale));
  await shot(h, '3-published.png');

  /* 4. guests see the full artwork with the words */
  const g = await open(null, 'invite.html?i=anita-rohan');
  await g.waitForSelector('.ix-mk-card', { timeout: 8000 }).catch(() => {});
  if (await g.locator('#openBtn').count()) { await g.click('#openBtn'); await g.waitForTimeout(600); }
  ok('guest: designer card with the full artwork', /\/fake-storage\/designer-art\//.test(await g.locator('.ix-mk-card img').getAttribute('src')));
  ok('guest: names and venue on the card', /Anita & Rohan/.test(await text(g, '.ix-mk-card')) && /Rambagh Palace/.test(await text(g, '.ix-mk-card')));
  await shot(g, '4-guest.png');
  await g.context().close();
  const gm = await open(null, 'invite.html?i=anita-rohan', { ...devices['Pixel 7'] });
  await gm.waitForSelector('.ix-mk-card', { timeout: 8000 }).catch(() => {});
  if (await gm.locator('#openBtn').count()) { await gm.click('#openBtn'); await gm.waitForTimeout(600); }
  ok('guest phone: no sideways scrolling, words fit', await noSideScroll(gm) && await gm.locator('.ix-mk-z').evaluateAll((els) => els.length === 4 && els.every((z) => z.firstElementChild.scrollHeight <= z.clientHeight + 1)));
  await shot(gm, '5-guest-phone.png');
  await gm.context().close();

  /* 5. owned designs: tile says Yours, a second invitation uses it with no new payment */
  await h.goto(BASE + `index.html#/edit/${INV.a}/1`); await h.waitForSelector('[data-mk]');
  ok('gallery: bought design marked Yours', /Yours/.test(await text(h, '#mkGrid')));
  await h.context().close();

  /* 6. another host closes the payment window: nothing is published or sold */
  const k = await open(U.kiran, `index.html#/edit/${INV.k}/1`);
  await k.waitForSelector('[data-way=market]'); await k.click('[data-way=market]'); await k.waitForSelector('[data-mk]');
  await k.click('[data-mk]'); await k.waitForSelector('.mk-cur'); await k.waitForTimeout(1800);   // autosave
  await k.goto(BASE + `index.html#/edit/${INV.k}/5`); await k.waitForTimeout(800);
  await k.evaluate(() => { window.__rzpMode = 'close'; });
  await k.click('#pubBig'); await k.waitForSelector('#modalRoot .modal'); await k.click('#modalRoot .modal [data-a="1"]');
  await k.waitForTimeout(1500);
  ok('payment window closed: still a draft, no licence', psql(`select status from invitations where id = '${INV.k}'`) === 'draft' && psql(`select count(*) from template_licenses where user_id = '${U.kiran}'`) === '0');
  const direct = asUser(U.kiran, `update invitations set status = 'published', published = data where id = '${INV.k}';`);
  ok('database refuses to publish an unbought designer card', !!direct.error, JSON.stringify(direct));
  await k.context().close();

  ok('no page errors', errs.length === 0, errs.join(' | '));
} catch (e) { console.error(e); ok('test ran to the end', false, e.message); }
await b.close(); server.close();
const pass = res.filter(Boolean).length;
console.log(`\n${pass}/${res.length} passed (payments simulated with a fake Razorpay in test mode)`);
process.exit(pass === res.length ? 0 : 1);
