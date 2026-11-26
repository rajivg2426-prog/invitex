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
  /* ---------- gallery: filters, favourites, recently viewed, quick look, compare, reset ---------- */
  await p.evaluate(() => window.scrollTo(0, 0));
  ok('occasion is a menu, not a sideways strip', (await p.locator('#galOcc').count()) === 1 && (await p.locator('.gal-tab').count()) === 0);
  ok('occasion menu lists every occasion', (await p.locator('#galOcc option').count()) >= 15);
  await p.selectOption('#galOcc', 'all'); await p.waitForTimeout(200);
  ok('All shows the 14 ready designs', (await p.locator('.design-tile').count()) === 14 && /14 designs/.test(await p.innerText('.gal-sum')));
  ok('each card has a name, description, favourite, quick look and compare', (await p.locator('.design-tile .dp-desc').count()) === 14 && (await p.locator('.design-tile [data-fav]').count()) === 14 && (await p.locator('.design-tile [data-quick]').count()) === 14 && (await p.locator('.design-tile [data-cmp]').count()) === 14);
  ok('the chosen design shows a Selected badge', (await p.locator('.design-tile.on .dp-badge').innerText()).includes('Selected'));
  await p.click('[data-gstyle=modern]'); await p.waitForTimeout(200);
  const modern = await p.locator('.design-pick').evaluateAll((els) => els.map((e) => e.dataset.themePick));
  ok('Style: Modern hides traditional designs', modern.length > 0 && modern.length < 14 && !modern.includes('saffron-puja') && modern.includes('corporate-slate'), modern.join());
  await p.click('[data-gcol=blue]'); await p.waitForTimeout(200);
  const blue = await p.locator('.design-pick').evaluateAll((els) => els.map((e) => [e.dataset.themePick, e.dataset.palPick]));
  ok('Colour: Blue narrows further and shows each design in its blue colours', blue.length > 0 && blue.length < modern.length && blue.every(([, pal]) => pal != null), JSON.stringify(blue));
  await p.click('[data-gcol=pink]'); await p.click('[data-gstyle=modern]'); await p.click('[data-gstyle=vintage]'); await p.click('[data-gstyle=luxury]'); await p.click('[data-gcol=blue]'); await p.click('[data-gcol=pink]'); await p.click('[data-gcol=green]'); await p.waitForTimeout(200);
  const nGreen = await p.locator('.design-tile').count();
  await p.click('[data-gfav]'); await p.waitForTimeout(200);
  ok('empty state explains no match and offers Show all', (await p.locator('.gal-empty').count()) === 1, 'tiles before ' + nGreen);
  await p.click('#galClear2'); await p.waitForTimeout(200);
  ok('Show all designs clears every filter', (await p.locator('.design-tile').count()) === 14 && (await p.locator('.gal-bar .chip.on').count()) === 0);
  await p.click('[data-fav="golden-anniversary"]'); await p.waitForTimeout(200);
  ok('heart saves a favourite', (await p.getAttribute('[data-fav="golden-anniversary"]', 'aria-pressed')) === 'true');
  await p.selectOption('#galSort', 'fav'); await p.waitForTimeout(200);
  ok('Favourites first puts it at the top', (await p.locator('.design-pick').first().getAttribute('data-theme-pick')) === 'golden-anniversary');
  // quick look: opens a large preview without choosing the design
  await p.click('[data-quick="golden-anniversary"]'); await p.waitForSelector('.ql-modal iframe');
  const ql = p.frameLocator('.ql-modal iframe');
  await ql.locator('body.motif-leaves').waitFor({ timeout: 5000 });
  ok('Quick look shows that design large with the host names', /Meera & Dev/.test(await ql.locator('#sec-opening').innerText()));
  await p.click('.ql-pal >> nth=1'); await p.waitForTimeout(600);
  ok('Quick look can switch its colours', (await ql.locator('html').evaluate((e) => getComputedStyle(e).getPropertyValue('--bg').trim())) === '#141414');
  ok('Quick look did not change the card', (await saved(p)).theme === 'blush-rings');
  await p.click('.ql-modal [data-a="1"]'); await p.waitForTimeout(800);
  let st = await p.evaluate(async () => { const i = await H.store.getInvitation(location.hash.split('/')[2]); return [i.theme, i.paletteIndex]; });
  ok('Use this design from quick look chooses it in the colour shown', st[0] === 'golden-anniversary' && st[1] === 1, st.join('/'));
  ok('recently viewed lists it', (await p.locator('.recent-chip[data-quick="golden-anniversary"]').count()) === 1);
  // compare
  await p.check('[data-cmp="royal-maroon"]'); await p.check('[data-cmp="blush-rings"]'); await p.check('[data-cmp="minimal-ivory"]');
  ok('compare allows up to three', (await p.locator('[data-cmp]:disabled').count()) === 11 && /3<\/b> of 3|3 of 3/.test(await p.innerText('.cmp-tray')));
  await p.click('#cmpGo'); await p.waitForSelector('.cmp-modal');
  ok('compare shows three designs with colours, fonts and style', (await p.locator('.cmp-col').count()) === 3 && (await p.locator('.cmp-col .ql-facts').first().innerText()).includes('Fonts'));
  await p.screenshot({ path: OUT + '/4-compare.png' });
  await p.click('[data-cmp-use="1"]'); await p.waitForTimeout(800);
  ok('Use this one picks it and clears the compare list', (await saved(p)).theme === 'blush-rings' && (await p.locator('.cmp-tray').count()) === 0);
  // reset design
  await p.evaluate(async () => { const i = await H.store.getInvitation(location.hash.split('/')[2]); i.design.fonts.script = 'Pacifico'; await H.store.saveInvitation(i); });
  await p.reload(); await p.waitForSelector('#designCard'); await p.waitForTimeout(800);
  await p.click('#resetDesign'); await p.click('.modal [data-a="1"]'); await p.waitForTimeout(900);
  const fonts = await p.evaluate(async () => (await H.store.getInvitation(location.hash.split('/')[2])).design.fonts.script);
  ok('Reset design puts back the original fonts', fonts === 'Parisienne', fonts);
  // remembered on this device
  await p.click('[data-gcol=gold]'); await p.waitForTimeout(200);
  const p2 = await ctx.newPage(); await p2.goto(BASE + 'index.html#/new/anniversary'); await p2.waitForSelector('#designCard'); await p2.waitForTimeout(800);
  ok('favourites and filters are remembered for the next invitation', (await p2.locator('[data-gcol=gold].on').count()) === 1 && (await p2.locator('[data-fav="golden-anniversary"][aria-pressed=true]').count()) === 1);
  await p2.close();
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
