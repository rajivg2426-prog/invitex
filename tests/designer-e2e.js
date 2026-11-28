/* Designer page (#/designer) end to end, against the real SQL on a local Postgres:
 * apply → admin approves → agreement → upload artwork → mark text boxes → submit → see it in the list.
 * Setup: sh tests/run-marketplace-sql.sh, then psql -d ivx -f tests/admin-seed.sql
 * Then: node tests/designer-e2e.js
 * Uses the same stand-in Supabase client as tests/admin-e2e.js: rpc() runs in Postgres as the signed-in user. */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(__dirname, 'e2e-output', 'designer'); fs.mkdirSync(OUT, { recursive: true });
const DB = process.env.PGDATABASE || 'ivx';
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const USERS = { designer: 'd1000000-0000-0000-0000-000000000004',  admin: 'a1000000-0000-0000-0000-000000000001', priya: 'b1000000-0000-0000-0000-000000000002', spam: 'c1000000-0000-0000-0000-000000000003' };
const EMAIL = { 'd1000000-0000-0000-0000-000000000004': 'new.host@example.com',  [USERS.admin]: 'rajeev.admin@example.com', [USERS.priya]: 'priya.host@example.com', [USERS.spam]: 'spam.account@example.com' };

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const lit = (v) => v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : typeof v === 'object' ? q(JSON.stringify(v)) + '::jsonb' : q(v);
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
    storage: { from: (bucket) => ({ upload: async (p, blob) => { (window.__uploads = window.__uploads || []).push({ bucket, path: p, type: blob.type, size: blob.size }); return { data: { path: p }, error: null }; }, createSignedUrl: async (p) => ({ data: { signedUrl: '/' + p }, error: null }), list: async () => { window.__listed = (window.__listed || 0) + 1; return { data: [], error: null }; }, remove: async () => ({ data: [], error: null }), getPublicUrl: (p) => ({ data: { publicUrl: '/' + p } }) }) },
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
  const shot = async (p, name) => { await p.addStyleTag({ content: '.toast,[class*=toast]{display:none!important}' }); await p.screenshot({ path: path.join(OUT, name), fullPage: true }); };
  const me = USERS.designer;
  const art = async (p, w, h) => Buffer.from((await p.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#5a0f24'); g.addColorStop(1, '#d4a24c'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#f6e7c8'; x.lineWidth = 12; x.strokeRect(40, 40, w - 80, h - 80); return c.toDataURL('image/png').split(',')[1]; }, [w, h])), 'base64');

  // 1. help page links to the designer page; the application form
  const p = await open({}, me, '#/help');
  ok('help page links to the designer page', (await p.locator('a[href="#/designer"]').count()) === 1);
  await p.goto(BASE + 'index.html#/designer'); await p.waitForSelector('#dzApply');
  await shot(p, '1-apply.png');
  await p.click('#dzApply button[type=submit]'); await p.waitForTimeout(300);
  ok('empty form is not sent', !(await p.locator('#dzErr').isHidden()) && sql(me, `select count(*) from public.designer_applications where user_id='${me}';`).data === '0');
  await p.fill('#dzName', 'Meera Studio'); await p.fill('#dzCity', 'Jaipur'); await p.selectOption('#dzState', 'Rajasthan');
  await p.fill('#dzPortfolio', 'https://www.behance.net/meerastudio');
  await p.locator('[name=occ]').first().check();
  await p.click('#dzApply button[type=submit]'); await p.waitForTimeout(900);
  ok('application sent, waiting screen shown', /Thanks for applying/.test(await p.locator('#view').innerText()));
  const appId = sql(me, `select id from public.designer_applications where user_id='${me}';`).data;
  ok('application stored with state Rajasthan', sql(me, `select state from public.designer_applications where id='${appId}';`).data === 'Rajasthan');

  // 2. admin approves; designer sees the agreement and accepts
  const dec = sql(USERS.admin, `select public.admin_decide_application('${appId}', true, 'ok')::text;`);
  ok('admin approves', dec.data && JSON.parse(dec.data).ok, JSON.stringify(dec));
  await p.reload(); await p.waitForSelector('#dzAgree');
  ok('agreement shown, Continue locked until ticked', await p.locator('#dzAgreeBtn').isDisabled());
  ok('agreement shows the real shares and pilot bonus', /60%/.test(await p.locator('#view').innerText()) && /plus 10 points/.test(await p.locator('#view').innerText()));
  await shot(p, '2-agreement.png');
  await p.check('#dzAgree'); await p.click('#dzAgreeBtn'); await p.waitForSelector('a[href="#/designer/design/new"]');
  ok('home shows earnings tiles and empty list', (await p.locator('.dz .hx-tiles > div').count()) === 4 && /No designs yet/.test(await p.locator('#view').innerText()));
  ok('sales link has the referral code', /ref=[a-z0-9]+/i.test(await p.locator('.copyrow input').inputValue()));

  // 3. editor: bad artwork is refused, good artwork uploaded with a watermarked preview and a hash
  await p.click('a[href="#/designer/design/new"]'); await p.waitForSelector('#dzArt');
  await p.setInputFiles('#dzArt', { name: 'small.png', mimeType: 'image/png', buffer: await art(p, 900, 1200) });
  await p.waitForTimeout(500);
  ok('artwork under 1500px is refused', /900 pixels wide/.test(await p.locator('#dzArtErr').innerText()));
  await p.setInputFiles('#dzArt', { name: 'front.png', mimeType: 'image/png', buffer: await art(p, 1600, 2240) });
  await p.waitForSelector('#dzStage:not([hidden])'); await p.waitForTimeout(400);
  const ups = await p.evaluate(() => window.__uploads);
  ok('artwork to designer-art and a webp preview to designer-previews', ups.some((u) => u.bucket === 'designer-art' && /front\.png$/.test(u.path)) && ups.some((u) => u.bucket === 'designer-previews' && u.type === 'image/webp' && /front\.webp$/.test(u.path)), JSON.stringify(ups));
  ok('uploads go in the designer\'s own folder', ups.every((u) => u.path.startsWith(me + '/')));
  ok('earning estimate shown', /You earn about ₹/.test(await p.locator('#dzEarn').innerText()), await p.locator('#dzEarn').innerText());

  // drag two boxes on the card
  const box = await p.locator('#dzStage').boundingBox();
  const drag = async (x1, y1, x2, y2) => { await p.mouse.move(box.x + box.width * x1, box.y + box.height * y1); await p.mouse.down(); await p.mouse.move(box.x + box.width * x2, box.y + box.height * y2, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(100); };
  await drag(0.15, 0.2, 0.85, 0.3); await drag(0.2, 0.4, 0.8, 0.5);
  await drag(0.5, 0.6, 0.51, 0.605); // a click, not a box
  ok('two boxes drawn, a stray click ignored', (await p.locator('.dz-zone:not(.ghost)').count()) === 2);
  ok('boxes labelled Title and Names', (await p.locator('.dz-zone span').allInnerTexts()).join(',') === 'Title,Names');
  await p.selectOption('[data-za="1"]', 'left');

  // 4. submit checks, then a real submit
  await p.fill('#dzTitle', 'Rajwada Gold');
  await p.click('#dzPalAdd');
  ok('a second colour choice can be added', (await p.locator('#dzPals [data-i]').count()) === 2);
  await p.click('#dzSubmit'); await p.waitForTimeout(300);
  ok('new designer must upload a source file', /source file/.test(await p.locator('#dzSubErr').innerText()));
  await p.setInputFiles('#dzSrc', { name: 'Rajwada Gold.psd', mimeType: 'application/octet-stream', buffer: Buffer.from('8BPS fake') });
  await p.waitForTimeout(400);
  await p.click('#dzSubmit'); await p.waitForTimeout(300);
  ok('all five statements must be ticked', /all five/.test(await p.locator('#dzSubErr').innerText()));
  await shot(p, '3-editor.png');
  for (const c of await p.locator('[name=rights]').all()) await c.check();
  await p.click('#dzSubmit'); await p.waitForSelector('a[href="#/designer/design/new"]', { timeout: 5000 });
  const row = JSON.parse(sql(me, `select json_build_object('status', status, 'title', title, 'zones', pages->0->'zones', 'phash', phash, 'src', source_path, 'pals', jsonb_array_length(palettes), 'rights', rights)::text from public.designs where designer_id='${me}';`).data);
  ok('design in review with title, 2 zones, a hash, source and 2 palettes', row.status === 'in_review' && row.title === 'Rajwada Gold' && row.zones.length === 2 && /^[0-9a-f]{16}$/.test(row.phash[0]) && /source-/.test(row.src) && row.pals === 2, JSON.stringify(row).slice(0, 300));
  ok('zone stored as fractions with alignment', row.zones[1].align === 'left' && row.zones[0].x > 0.1 && row.zones[0].x < 0.2 && row.zones[0].w > 0.6 && row.zones[0].w < 0.75, JSON.stringify(row.zones));
  ok('rights declaration stored', row.rights && Object.values(row.rights.items || row.rights).filter((v) => v === true).length >= 5, JSON.stringify(row.rights));
  const homeTxt = await p.locator('#view').innerText();
  ok('home lists it as In review', /Rajwada Gold/.test(homeTxt) && /In review/.test(homeTxt));
  ok('in-review design cannot be edited from the list', (await p.locator('a[href^="#/designer/design/"]:not([href$="/new"])').count()) === 0);
  await shot(p, '4-home.png');

  // 5. reviewer asks for changes; designer sees the note and can edit
  const did = sql(me, `select id from public.designs where designer_id='${me}';`).data;
  sql(USERS.admin, `select public.admin_review_design('${did}', 'changes', 'Text areas do not fit on a phone', 'Make the names box wider.');`);
  await p.reload(); await p.waitForTimeout(800);
  ok('reviewer note shown on home', /Make the names box wider/.test(await p.locator('#view').innerText()));
  await p.click(`a[href="#/designer/design/${did}"]`); await p.waitForSelector('#dzTitle');
  ok('editor reopens with saved title, zones and note', (await p.inputValue('#dzTitle')) === 'Rajwada Gold' && (await p.locator('.dz-zone').count()) === 2 && /names box wider/.test(await p.locator('#view').innerText()));

  // 6. phone
  const m = await open({ ...devices['Pixel 7'] }, me, '#/designer/design/' + did);
  await m.waitForSelector('#dzTitle');
  ok('phone: editor has no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await shot(m, '5-phone-editor.png');
  await m.goto(BASE + 'index.html#/designer'); await m.waitForTimeout(700);
  ok('phone: home has no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  // 7. Demo mode explains that the marketplace needs Production
  const ctx = await b.newContext(); const dp = await ctx.newPage(); dp.on('pageerror', (e) => errs.push(e.message));
  await dp.route(/js\/config\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.INVITEX_CONFIG={};' }));
  await dp.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await dp.goto(BASE + 'index.html#/designer'); await dp.waitForTimeout(900);
  ok('demo mode shows the Production-only note', /only in the live app/.test(await dp.locator('#view').innerText()));

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close(); server.close();
  const pass = res.filter(Boolean).length;
  console.log(`\n${pass}/${res.length} passed`);
  process.exit(pass === res.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
