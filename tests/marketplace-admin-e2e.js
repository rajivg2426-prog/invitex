/* Admin marketplace screens (Designers, Design review) end to end, against the real SQL on a local Postgres.
 * Setup: sh tests/run-marketplace-sql.sh, then psql -d ivx -f tests/admin-seed.sql
 * Then: node tests/marketplace-admin-e2e.js
 * Uses the same stand-in Supabase client as tests/admin-e2e.js: rpc() runs in Postgres as the signed-in user. */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(__dirname, 'e2e-output', 'marketplace-admin'); fs.mkdirSync(OUT, { recursive: true });
const DB = process.env.PGDATABASE || 'ivx';
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const USERS = { admin: 'a1000000-0000-0000-0000-000000000001', priya: 'b1000000-0000-0000-0000-000000000002', spam: 'c1000000-0000-0000-0000-000000000003' };
const EMAIL = { [USERS.admin]: 'rajeev.admin@example.com', [USERS.priya]: 'priya.host@example.com', [USERS.spam]: 'spam.account@example.com' };

const lit = (v) => v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
function sql(uid, q) {
  const s = `set role authenticated; select set_config('request.jwt.uid', ${lit(uid)}, false);\n${q}`;
  try { return { data: execFileSync('psql', ['-d', DB, '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: s, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim().split('\n').pop() }; }
  catch (e) { const m = /ERROR:\s+(.*)/.exec(e.stderr.toString()); return { error: { message: m ? m[1] : e.stderr.toString() } }; }
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.md': 'text/plain', '.png': 'image/png' };
const server = http.createServer((req, rsp) => {
  if (req.url === '/fake-rpc') {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const { uid, fn, args } = JSON.parse(b);
      if (!/^[a-z_]+$/.test(fn)) { rsp.end(JSON.stringify({ error: { message: 'bad fn' } })); return; }
      const named = Object.entries(args || {}).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
      const r = sql(uid, `select public.${fn}(${named})::text;`);
      rsp.setHeader('content-type', 'application/json');
      rsp.end(JSON.stringify(r.error ? { data: null, error: r.error } : { data: JSON.parse(r.data), error: null }));
    });
    return;
  }
  if (req.url.startsWith('/fake-sql')) { // test-only peek at the table as a given user
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { const { uid, q } = JSON.parse(b); rsp.end(JSON.stringify(sql(uid, q))); });
    return;
  }
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.statusCode = 404; rsp.end(); return; }
  rsp.setHeader('content-type', MIME[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(rsp);
});
// stand-in for supabase-js: auth from localStorage, rpc() into Postgres, table reads as the user
const FAKE = `window.supabase = { createClient() {
  const uid = () => localStorage.getItem('fakeUid') || '';
  const emails = ${JSON.stringify(EMAIL)};
  const user = () => uid() ? { id: uid(), email: emails[uid()] || 'x@example.com', user_metadata: {} } : null;
  const rpc = async (fn, args) => (await fetch('/fake-rpc', { method: 'POST', body: JSON.stringify({ uid: uid(), fn, args }) })).json();
  const q = { select() { return q; }, eq() { return q; }, order() { return Promise.resolve({ data: [], error: null }); }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } };
  return {
    auth: { getUser: async () => ({ data: { user: user() } }), getSession: async () => ({ data: { session: user() ? { access_token: 't', user: user() } : null } }), onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => { localStorage.removeItem('fakeUid'); } },
    rpc, from: () => q,
    storage: { from: () => ({ list: async () => { window.__listed = (window.__listed || 0) + 1; return { data: [], error: null }; }, remove: async () => ({ data: [], error: null }), getPublicUrl: (p) => ({ data: { publicUrl: '/' + p } }) }) },
  };
} };`;
const CONFIG = "window.INVITEX_CONFIG={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test',MEDIA_BUCKET:'invite-media',PUBLIC_BASE_URL:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};";


(async () => {
  await new Promise((r) => server.listen(0, r));
  const BASE = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch();
  const errs = [];
  const open = async (opts, uid, hash) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 900 } }, opts));
    await ctx.route(/js\/config\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: CONFIG }));
    await ctx.route(/supabase-js@/, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    await ctx.route(/example\.supabase\.co/, (r) => r.fulfill({ status: 404, body: '' }));
    await ctx.addInitScript((u) => localStorage.setItem('fakeUid', u), uid);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + 'index.html' + hash); await p.waitForTimeout(700);
    return p;
  };
  const rpc = (uid, q) => sql(uid, q);
  const shot = async (p, name) => { await p.addStyleTag({ content: '.toast,[class*=toast]{display:none!important}' }); await p.screenshot({ path: path.join(OUT, name), fullPage: true }); };
  const designer = USERS.priya;

  // 1. Priya applies to be a designer
  const ap = rpc(designer, `select public.designer_apply('{"displayName":"Priya Paper Co","city":"Pune","state":"Maharashtra","portfolioUrl":"https://behance.net/priyapaper","occasions":["wedding","birthday"]}')::text;`);
  ok('designer applies', ap.data && JSON.parse(ap.data).ok, JSON.stringify(ap));

  // 2. a host cannot see the queue; the admin approves on the Designers screen
  const hostTry = rpc(USERS.spam, `select public.admin_design_queue()::text;`);
  ok('host cannot read the review queue', hostTry.error && /admin/i.test(hostTry.error.message), JSON.stringify(hostTry));
  const p = await open({}, USERS.admin, '#/admin/designers');
  await p.waitForSelector('.mk-app');
  ok('admin menu has Designers and Design review', (await p.locator('.ax-rail a[href="#/admin/designers"]').count()) === 1 && (await p.locator('.ax-rail a[href="#/admin/review"]').count()) === 1);
  ok('application listed with portfolio link', (await p.locator('.mk-app').innerText()).includes('Priya Paper Co') && (await p.locator('.mk-app a[href^="https://behance.net"]').count()) === 1);
  await shot(p, '1-applications.png');
  await p.fill('.mk-app [data-note]', 'Pilot designer, Pune');
  await p.click('.mk-app [data-approve]'); await p.waitForTimeout(800);
  const ds = rpc(designer, `select json_build_object('slug', slug, 'bonus', pilot_bonus_until is not null)::text from public.designers where user_id = '${designer}';`);
  ok('approving creates the designer with the pilot bonus', ds.data && JSON.parse(ds.data).bonus === true, ds.data);

  // 3. Priya signs the agreement and submits a design
  rpc(designer, `select public.designer_accept_agreement('2026-11-pilot');`);
  const pages = JSON.stringify([{ role: 'front', path: `${designer}/d1-x7/front.png`, preview: `${designer}/d1-x7/front.webp`, zones: [{ key: 'title', x: 0.1, y: 0.3, w: 0.8, h: 0.1 }] }]);
  const sv = rpc(designer, `select public.designer_save_design(jsonb_build_object('title','Peacock Gold','occasion','wedding','price',19900,'pages','${pages}'::jsonb,'palettes','[{"bg":"#123"}]'::jsonb,'fonts','royal','sourcePath','${designer}/d1-x7/source.psd','aiUse','assisted'))::text;`);
  const designId = JSON.parse(sv.data).id;
  const sub = rpc(designer, `select public.designer_submit_design('${designId}', '{"own":true,"noThirdParty":true,"noLikeness":true,"notSoldExclusive":true,"understandsLiability":true}')::text;`);
  ok('design submitted', JSON.parse(sub.data).ok, sub.data);

  // 4. review: a reason is required to send back; then approve
  await p.goto(BASE + 'index.html#/admin/review'); await p.waitForSelector('.mk-design');
  const cardTxt = await p.locator('.mk-design').innerText();
  ok('review card shows title, price, designer and the AI flag', /Peacock Gold/.test(cardTxt) && /₹199/.test(cardTxt) && /Priya Paper Co/.test(cardTxt) && /AI-assisted/.test(cardTxt), cardTxt.replace(/\n/g, ' | ').slice(0, 200));
  ok('source file and full artwork buttons', (await p.locator('.mk-design [data-source]').count()) === 1 && (await p.locator('.mk-design [data-full]').count()) === 1);
  await shot(p, '2-review.png');
  await p.click('.mk-design [data-d=changes]'); await p.waitForTimeout(400);
  const st1 = rpc(designer, `select status from public.designs where id = '${designId}';`).data;
  ok('sending back without a reason does nothing', st1 === 'in_review', st1);
  await p.selectOption('.mk-design [data-reason]', 'Text areas do not fit on a phone');
  await p.fill('.mk-design [data-note]', 'The names box is too narrow for long Hindi names.');
  await p.click('.mk-design [data-d=changes]'); await p.waitForTimeout(800);
  const st2 = rpc(designer, `select status || '|' || review_note from public.designs where id = '${designId}';`).data;
  ok('changes requested with the note for the designer', /^changes_requested\|The names box/.test(st2), st2);
  rpc(designer, `select public.designer_submit_design('${designId}', '{"own":true,"noThirdParty":true,"noLikeness":true,"notSoldExclusive":true,"understandsLiability":true}');`);
  await p.click('[data-f=in_review]'); await p.waitForSelector('.mk-design [data-d=approve]');
  await p.click('.mk-design [data-d=approve]'); await p.waitForTimeout(800);
  const st3 = rpc(designer, `select status from public.designs where id = '${designId}';`).data;
  ok('approved design is live', st3 === 'live', st3);
  const gal = rpc(USERS.spam, `select public.marketplace_designs('wedding')::text;`).data;
  ok('it shows in the gallery for hosts', JSON.parse(gal).some((g) => g.title === 'Peacock Gold'));
  await p.click('[data-f=live]'); await p.waitForSelector('.mk-design [data-d=pause]');
  ok('live tab offers Pause sales', true);

  // 5. activity log names the marketplace actions
  await p.goto(BASE + 'index.html#/admin/activity'); await p.waitForTimeout(900);
  const log = await p.locator('#view').innerText();
  ok('activity log shows design approval and designer approval', /Approved design/.test(log) && /Approved designer/.test(log));

  // 6. phone
  const m = await open({ ...devices['Pixel 7'] }, USERS.admin, '#/admin/review');
  await m.click('[data-f=live]').catch(() => {}); await m.waitForTimeout(700);
  const wide = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok('phone: no sideways scrolling', wide);
  await shot(m, '3-phone.png');

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close(); server.close();
  const pass = res.filter(Boolean).length;
  console.log(`\n${pass}/${res.length} passed`);
  process.exit(pass === res.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
