/* Admin page end to end, against the real admin SQL on a local Postgres.
 * Setup (once): see docs/DEPLOYMENT.md "Testing the admin page". In short:
 *   psql -f tests/supabase-stubs.sql && psql -d ivx -c 'create role service_role nologin'
 *   psql -d ivx -f supabase/schema.sql -f supabase/admin.sql -f tests/admin-seed.sql
 * Then: node tests/admin-e2e.js
 * The browser gets a stand-in Supabase client whose rpc() calls run in Postgres as the
 * signed-in user (role "authenticated" + auth.uid()), so the database's own admin checks
 * are what is being tested. Static files are served by this script. */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(__dirname, 'e2e-output', 'admin'); fs.mkdirSync(OUT, { recursive: true });
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
  const mk = async (opts = {}) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1360, height: 900 } }, opts));
    await ctx.route(/js\/config\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: CONFIG }));
    await ctx.route(/supabase-js@/, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    return ctx;
  };
  const errs = [];
  // each person gets their own browser context (own sign-in)
  const open = async (opts, uid, hash) => {
    const ctx = await mk(opts);
    await ctx.addInitScript((u) => localStorage.setItem('fakeUid', u), uid);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(BASE + 'index.html' + hash); await p.waitForTimeout(500);
    return p;
  };
  const shot = async (p, name) => { await p.addStyleTag({ content: '.toast,[class*=toast]{display:none!important}' }); await p.screenshot({ path: path.join(OUT, name), fullPage: true }); };

  // 1. a host cannot use the admin page, and sees no Admin menu
  const host = await open({}, USERS.priya, '#/admin/users');
  ok('host: no Admin link in the top menu', await host.locator('#navAdmin').isHidden());
  ok('host: #/admin shows "for admins" and no data', /This page is for admins/.test(await host.locator('#view').innerText()) && (await host.locator('.ax').count()) === 0);
  const direct = await host.evaluate(async () => { try { await H.store.admin('users', {}); return 'got data'; } catch (e) { return e.message; } });
  ok('host: calling the admin function directly is refused by the database', /Only an InviteX admin/.test(direct), direct);
  await host.close();

  // 2. admin: users screen
  const p = await open({}, USERS.admin, '#/admin/users');
  await p.waitForSelector('#axRows tr[data-id]');
  ok('admin: Admin link shows in the top menu', await p.locator('#navAdmin').isVisible());
  ok('admin: left menu has the money screens, the marketplace screens and Users, Invitations, Usage, Audit log', (await p.locator('.ax-rail ul:first-of-type a').allInnerTexts()).map((s) => s.trim()).join(',') === 'Overview,Users,Invitations,Sharing campaigns,Pricing control,Free access,Payment transactions,Revenue reports,Designers,Design review,Usage analytics,System settings,Audit log');
  ok('users: lists every account', (await p.locator('#axRows tr[data-id]').count()) === 4, await p.locator('#axCount').innerText());
  const priyaRow = p.locator(`#axRows tr[data-id="${USERS.priya}"]`);
  ok('users: counts for Priya (2 invitations, 1 live, 2 replies, AI 3/3)', /2\s*· 1 live/.test(await priyaRow.innerText()) && /3 \/ 3/.test(await priyaRow.innerText()), (await priyaRow.innerText()).replace(/\s+/g, ' '));
  await shot(p, '1-users.png');
  await p.fill('#axQ', 'spam'); await p.waitForTimeout(700);
  ok('users: search by email', (await p.locator('#axRows tr[data-id]').count()) === 1);
  await p.fill('#axQ', ''); await p.waitForTimeout(700);

  // give Priya 5 AI tries
  await priyaRow.locator('[data-manage]').click(); await p.waitForSelector('.modal #mTries');
  await p.waitForTimeout(500); await shot(p, '2-manage.png');
  await p.fill('#mTriesN', '5'); await p.fill('#mTriesNote', 'Bought a pack'); await p.click('#mTries button[type=submit]'); await p.waitForTimeout(800);
  ok('users: AI tries added (3 / 8)', /3 \/ 8/.test(await p.locator(`#axRows tr[data-id="${USERS.priya}"]`).innerText()));

  // pause the spam account and take its invitation offline
  await p.locator(`#axRows tr[data-id="${USERS.spam}"] [data-manage]`).click(); await p.waitForSelector('.modal #mSus');
  await p.fill('#mWhy', 'Spam invitations'); await p.check('#mUnpub'); await p.click('#mSus'); await p.waitForTimeout(900);
  ok('users: spam account shows Paused', /Paused/.test(await p.locator(`#axRows tr[data-id="${USERS.spam}"]`).innerText()));
  // own account: no pause or role buttons
  await p.locator(`#axRows tr[data-id="${USERS.admin}"] [data-manage]`).click(); await p.waitForSelector('.modal #mTries');
  ok('users: your own account cannot be paused or demoted here', (await p.locator('.modal #mSus, .modal #mRole').count()) === 0);
  await p.keyboard.press('Escape');

  // the paused account is locked out
  const spam = await open({}, USERS.spam, '#/');
  ok('paused account sees "Your account is paused" with the reason', /Your account is paused/.test(await spam.locator('#view').innerText()) && /Spam invitations/.test(await spam.locator('#view').innerText()));
  const peek = await spam.evaluate(async () => (await fetch('/fake-sql', { method: 'POST', body: JSON.stringify({ uid: localStorage.getItem('fakeUid'), q: 'select count(*) from invitations;' }) })).json());
  ok('paused account: database returns none of its invitations', peek.data === '0', JSON.stringify(peek));
  await shot(spam, '6-paused.png');
  await spam.close();

  // 3. invitations screen
  await p.click('.ax-rail a[href="#/admin/invitations"]'); await p.waitForSelector('#axRows tr[data-id^="e1"]');
  ok('invitations: every account\'s invitations are listed', (await p.locator('#axRows tr[data-id]').count()) === 3);
  const spamInv = p.locator('#axRows tr[data-id="e1000000-0000-0000-0000-000000000003"]');
  ok('invitations: the spam invitation was taken offline when the account was paused', /Draft/.test(await spamInv.innerText()));
  await p.click('[data-st=published]'); await p.waitForTimeout(500);
  ok('invitations: Published filter', (await p.locator('#axRows tr[data-id]').count()) === 1 && /Priya weds Arjun/.test(await p.locator('#axRows').innerText()));
  await shot(p, '3-invitations.png');
  await p.click('[data-unpub="e1000000-0000-0000-0000-000000000001"]'); await p.waitForSelector('.modal #mWhy');
  await p.fill('#mWhy', 'Host asked'); await p.click('.modal-f .btn.primary'); await p.waitForTimeout(800);
  ok('invitations: unpublish works', (await p.locator('#axRows tr[data-id]').count()) === 0);
  await p.click('[data-st=all]'); await p.waitForTimeout(500);
  await p.click('[data-del="e1000000-0000-0000-0000-000000000003"]'); await p.waitForSelector('.modal #mWhy');
  await p.fill('#mWhy', 'Spam'); await p.click('.modal-f .btn.danger'); await p.waitForTimeout(900);
  ok('invitations: delete works (photos folder checked first)', (await p.locator('#axRows tr[data-id]').count()) === 2 && (await p.evaluate(() => window.__listed || 0)) >= 1);

  // 4. usage
  await p.click('.ax-rail a[href="#/admin/usage"]'); await p.waitForSelector('.hx-tiles');
  const tiles = await p.locator('.hx-tiles').innerText();
  ok('usage: totals (4 accounts, 2 invitations, 2 replies, 8 AI designs ≈ ₹28)', /Accounts\s*4/.test(tiles) && /Invitations\s*2/.test(tiles) && /Replies\s*2/.test(tiles) && /AI designs\s*8/.test(tiles) && /₹28/.test(tiles), tiles.replace(/\s+/g, ' '));
  ok('usage: 8 weeks listed', (await p.locator('.hx-panel tbody').first().locator('tr').count()) === 8);
  await shot(p, '4-usage.png');

  // 5. activity log
  await p.click('.ax-rail a[href="#/admin/activity"]'); await p.waitForSelector('#axRows li');
  const log = await p.locator('#axRows').innerText();
  ok('activity: every change is logged with who did it', ['Gave AI tries', 'Paused account', 'Unpublished invitation', 'Deleted invitation'].every((s) => log.includes(s)) && log.includes('rajeev.admin@example.com'), log.split('\n').slice(0, 4).join(' | '));
  ok('activity: reasons and notes are kept', /Bought a pack/.test(log) && /Spam invitations/.test(log) && /Host asked/.test(log));
  await p.click('[data-f="invitation."]'); await p.waitForTimeout(500);
  ok('activity: filter by invitations', (await p.locator('#axRows li').count()) === 2);
  await p.click('[data-f=""]'); await p.waitForTimeout(500);
  await shot(p, '5-activity.png');

  // re-activate the spam account (log + state)
  await p.click('.ax-rail a[href="#/admin/users"]'); await p.waitForSelector('#axRows tr[data-id]');
  await p.locator(`#axRows tr[data-id="${USERS.spam}"] [data-manage]`).click(); await p.waitForSelector('.modal #mAct');
  await p.click('#mAct'); await p.waitForTimeout(800);
  ok('users: re-activate works', !/Paused/.test(await p.locator(`#axRows tr[data-id="${USERS.spam}"]`).innerText()));

  // 6. phone layout: menu becomes a row of tabs, nothing wider than the screen
  const m = await open(devices['iPhone 13'], USERS.admin, '#/admin/users'); await m.waitForSelector('#axRows tr[data-id]');
  ok('phone: admin menu visible as tabs', await m.locator('.ax-rail').isVisible());
  ok('phone: page does not scroll sideways', await m.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, document.querySelector('.ax').scrollWidth) <= window.innerWidth + 1));
  await shot(m, '7-phone.png');

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close(); server.close();
  const pass = res.filter(Boolean).length;
  console.log(`\n${pass}/${res.length} passed`);
  process.exit(pass === res.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
