/* Settings page: Account, Language, WhatsApp, Plan. Preferences apply to new invitations.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/settings-e2e.js
 * Forces Demo/Local mode by stubbing js/config.js, so no Supabase project is touched. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/settings'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const shot = async (pg, path) => { await pg.addStyleTag({ content: '.toast,[class*=toast]{display:none!important}' }); await pg.screenshot({ path, fullPage: true }); };
const STUB = "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  const errs = []; ctx.on('page', (p) => p.on('pageerror', (e) => errs.push(e.message)));
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html#/settings'); await p.waitForSelector('#stBody');
  ok('four tabs: Account, Language, WhatsApp, Plan', (await p.locator('[data-stab]').allInnerTexts()).join(',') === 'Account,Language,WhatsApp,Plan');
  ok('Account opens first and keeps backup, restore and delete', (await p.locator('[data-stab=account].on').count()) === 1 && (await p.locator('#exp, #imp, #wipe').count()) === 3 && /Demo \/ Local/.test(await p.locator('#stBody').innerText()));
  ok('no emoji on the settings page', !/[\u{1F300}-\u{1FAFF}⬆⬇]/u.test(await p.locator('.st').innerText()));
  await p.fill('#stPhone', '12'); await p.click('#acc button[type=submit]'); await p.waitForTimeout(300);
  ok('a wrong number is not saved', !(await p.evaluate(() => (JSON.parse(localStorage.getItem('ivx-prefs') || '{}').phone))));
  await p.fill('#stName', 'Sharma family'); await p.fill('#stPhone', '+91 98111 22233'); await p.click('#acc button[type=submit]'); await p.waitForTimeout(300);
  ok('your details are saved', await p.evaluate(() => { const x = JSON.parse(localStorage.getItem('ivx-prefs')); return x.name === 'Sharma family' && x.phone === '+91 98111 22233'; }));
  await shot(p, OUT + '/1-account.png');

  await p.click('[data-stab=language]'); await p.waitForSelector('[name=stLang]');
  ok('Language: English, Hindi, Punjabi', (await p.locator('[name=stLang]').count()) === 3);
  await p.check('[name=stLang][value=hi]'); await p.waitForTimeout(300);
  await p.check('[name=stLang][value=pa]'); await p.waitForTimeout(300);
  await p.selectOption('#stDef', 'hi'); await p.waitForTimeout(300);
  await p.uncheck('[name=stLang][value=en]'); await p.waitForTimeout(300);
  await p.uncheck('[name=stLang][value=pa]'); await p.waitForTimeout(300);
  await p.click('[name=stLang][value=hi]'); await p.waitForTimeout(300);
  ok('at least one language stays ticked', await p.isChecked('[name=stLang][value=hi]'));
  await p.check('[name=stLang][value=en]'); await p.check('[name=stLang][value=pa]'); await p.waitForTimeout(300);
  ok('main language saved', (await p.inputValue('#stDef')) === 'hi');
  await shot(p, OUT + '/2-language.png');

  await p.click('[data-stab=whatsapp]'); await p.waitForSelector('[name=stStyle]');
  ok('WhatsApp: short style is the default, with a sample in the main language', await p.isChecked('[name=stStyle][value=card]') && /सादर आमंत्रित/.test(await p.locator('#stSample').innerText()));
  await p.selectOption('#stMsgLang', 'pa'); await p.waitForTimeout(300);
  ok('message language changes the sample', /ਨਿੱਘਾ ਸੱਦਾ/.test(await p.locator('#stSample').innerText()));
  await shot(p, OUT + '/3-whatsapp.png');
  await p.click('label:has([name=stStyle][value=full])'); await p.waitForTimeout(300);
  ok('full details hides the short sample', (await p.locator('#stSample').count()) === 0);
  await p.click('label:has([name=stStyle][value=card])'); await p.waitForTimeout(300);

  await p.click('[data-stab=plan]'); await p.waitForSelector('.st-plan');
  const pl = await p.locator('.st-plan').innerText();
  ok('Plan shows Free, with no payment buttons or card fields', /Free/.test(pl) && /nothing to pay/.test(pl) && (await p.locator('.st-plan button, .st-plan input, .st-plan a').count()) === 0);
  await shot(p, OUT + '/4-plan.png');

  await p.reload(); await p.waitForSelector('.st-plan');
  ok('tab is kept in the link (#/settings/plan)', /#\/settings\/plan$/.test(p.url()));

  // A new invitation picks up the preferences; a sample (existing) one does not change.
  await p.goto(BASE + 'index.html#/new/wedding'); await p.waitForFunction(() => /#\/edit\//.test(location.hash));
  const inv = await p.evaluate(async () => (await H.store.getInvitation(location.hash.split('/')[2])));
  ok('new invitation: contact from Account', inv.contact.name === 'Sharma family' && inv.contact.phone === '+91 98111 22233');
  ok('new invitation: languages and main language from Language', inv.languages.slice().sort().join() === 'en,hi,pa' && inv.defaultLang === 'hi' && !!(inv.text.hi && inv.text.hi.title !== undefined) && !!inv.text.pa, inv.languages.join());
  ok('new invitation: WhatsApp style and language from WhatsApp', inv.msgStyle === 'card' && inv.shareLang === 'pa');

  // Phone layout
  const ph = await b.newContext({ ...devices['Pixel 7'] });
  await ph.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  const q = await ph.newPage(); q.on('pageerror', (e) => errs.push(e.message));
  await q.goto(BASE + 'index.html#/settings/whatsapp'); await q.waitForSelector('[name=stStyle]');
  ok('phone: no sideways scrolling', !(await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  await shot(q, OUT + '/5-phone.png');

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const f = res.filter((x) => !x).length; console.log(f ? f + ' failed' : 'all passed'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
