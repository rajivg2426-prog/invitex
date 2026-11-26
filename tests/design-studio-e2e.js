/* Design Studio (step 1) check: real live preview, preview pages, zoom, full screen,
 * sample details (never saved), four design options, bottom bar.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/design-studio-e2e.js [outDir]. Forces Demo/Local mode. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/design-studio'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const stub = (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" });
const saved = (p) => p.evaluate(async () => { const id = location.hash.split('/')[2]; const i = await H.store.getInvitation(id); return { title: i.text.en.title, host: i.text.en.hostName, date: i.events[0].date, venue: i.events[0].venue, theme: i.theme }; });
(async () => {
  const b = await chromium.launch(); const errs = [];
  /* ---------- laptop ---------- */
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } }); await ctx.route(/js\/config\.js/, stub);
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + 'index.html#/new/wedding'); await p.waitForSelector('#designCard'); await p.waitForTimeout(1800);
  const fr = p.frameLocator('#pvIframe');
  ok('preview shows the card itself, not the closed opening screen', (await fr.locator('#opener').count()) === 0 && (await fr.locator('#sec-opening').count()) === 1);
  ok('preview shows sample names before the host types', /Priya & Rohan/.test(await fr.locator('#sec-opening').innerText()));
  ok('preview says sample details are shown', await p.locator('#pvSample').isVisible());
  ok('four design options sit on one row', await p.evaluate(() => new Set([...document.querySelectorAll('.way')].map((w) => Math.round(w.getBoundingClientRect().top))).size === 1));
  await p.evaluate(() => window.scrollTo(0, 400)); await p.waitForTimeout(300);
  ok('preview frame fits on screen while choosing', await p.evaluate(() => { const r = document.getElementById('pvFrame').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 2; }));
  await p.click('[data-pg=events]'); await p.waitForTimeout(1200);
  const evTop = await fr.locator('#sec-schedule').evaluate((e) => Math.round(e.getBoundingClientRect().top));
  ok('Events page button moves the preview to the schedule', evTop >= -5 && evTop < 120, 'top ' + evTop);
  ok('Events page button is marked', (await p.getAttribute('[data-pg=events]', 'aria-pressed')) === 'true');
  await p.click('[data-pg-step="1"]'); await p.waitForTimeout(1200);
  ok('next-page arrow goes to RSVP', (await p.getAttribute('[data-pg=rsvp]', 'aria-pressed')) === 'true' && (await fr.locator('#sec-rsvp').evaluate((e) => e.getBoundingClientRect().top)) < 200);
  await p.click('[data-zoom="-1"]'); await p.click('[data-zoom="-1"]'); await p.waitForTimeout(300);
  ok('zoom out to 80%', (await p.innerText('#pvZoomVal')) === '80%' && (await fr.locator('html').evaluate((e) => e.style.zoom)) === '0.8');
  await p.click('#pvFull'); await p.waitForTimeout(400);
  ok('full-screen preview opens', await p.evaluate(() => getComputedStyle(document.getElementById('pvPane')).position === 'fixed'));
  await p.screenshot({ path: OUT + '/1-full-screen.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok('Esc closes full-screen preview', !(await p.evaluate(() => document.getElementById('pvPane').classList.contains('open'))));
  await p.click('#replayOpen'); await p.waitForTimeout(600);
  ok('Play opening shows the opening screen again', (await fr.locator('#opener').count()) === 1);
  await fr.locator('#openBtn').click(); await p.waitForTimeout(1500);
  await p.locator('[data-theme-pick="blush-rings"]').first().click(); await p.waitForTimeout(1000);
  ok('choosing another design updates the preview straight away', (await fr.locator('body').getAttribute('class')).includes('motif-rings') && (await fr.locator('#opener').count()) === 0);
  let s = await saved(p);
  ok('sample details are never saved', !s.title && !s.host && !s.date && !s.venue && s.theme === 'blush-rings', JSON.stringify(s));
  await p.screenshot({ path: OUT + '/2-desktop.png' });
  // typing on a sample line starts empty, so sample words never mix with the host's own
  await fr.locator('[data-edit=title]').first().click(); await p.keyboard.type('Meera & Dev'); await p.waitForTimeout(1500);
  s = await saved(p);
  ok('typing on the sample title replaces it', s.title === 'Meera & Dev', s.title);
  ok('sample note goes away once the host has a title', !(await p.locator('#pvSample').isVisible()));
  // the bottom bar never hides the last design card when scrolled to the end
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(400);
  ok('bottom bar does not cover the page end', await p.evaluate(() => { const f = document.querySelector('.wiz-foot').getBoundingClientRect(); const last = [...document.querySelectorAll('#stepBody > .card')].pop().getBoundingClientRect(); return last.bottom <= f.top + 1; }));
  /* ---------- phone ---------- */
  for (const [name, dev] of [['phone', devices['iPhone 13']], ['tablet', { viewport: { width: 820, height: 1180 } }]]) {
    const c2 = await b.newContext(dev); await c2.route(/js\/config\.js/, stub);
    const m = await c2.newPage(); m.on('pageerror', (e) => errs.push(e.message));
    await m.goto(BASE + 'index.html#/new/birthday'); await m.waitForSelector('#designCard'); await m.waitForTimeout(1500);
    ok(name + ': no sideways scrolling', await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    ok(name + ': Preview button sits in the bottom bar, not over Next', await m.evaluate(() => { const a = document.getElementById('fabPv').getBoundingClientRect(), n = document.getElementById('nextBtn').getBoundingClientRect(); return a.width > 0 && (a.right <= n.left || a.left >= n.right); }));
    if (name === 'phone') ok('phone: design options in two rows of two', await m.evaluate(() => new Set([...document.querySelectorAll('.way')].map((w) => Math.round(w.getBoundingClientRect().top))).size === 2));
    await m.click('#fabPv'); await m.waitForTimeout(1200);
    ok(name + ': Preview opens the card full screen with page buttons', await m.locator('.pv-pages').isVisible() && (await m.frameLocator('#pvIframe').locator('#opener').count()) === 0);
    await m.screenshot({ path: OUT + `/3-${name}-preview.png` });
    await m.click('#pvClose');
    await c2.close();
  }
  ok('no page errors', !errs.length, errs.join(' | '));
  await b.close();
  const f = res.filter((x) => !x).length;
  console.log(`\n${res.length - f}/${res.length} passed`);
  process.exit(f ? 1 : 0);
})();
