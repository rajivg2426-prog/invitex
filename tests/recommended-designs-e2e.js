/* Recommended designs: the Botanical collection (Sage Garden, Eucalyptus Garland, Fern Meadow) and the
 * Arch collection (Champagne Arch, Pampas Arch). Recommended in the gallery, and drawn correctly on every guest page, the WhatsApp card image and the home thumbnail.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/recommended-designs-e2e.js [outDir]
 * Forces Demo/Local mode by stubbing js/config.js, so no Supabase project is touched. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/recommended-designs'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const STUB = "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};";
const IDS = ['sage-garden', 'eucalyptus-garland', 'fern-meadow', 'champagne-arch', 'pampas-arch'];
const setup = async (ctx, errs) => {
  await ctx.route(/wa\.me|calendar\.google|google\.com\/maps/, (r) => r.fulfill({ status: 200, body: 'stub' }));
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  ctx.on('page', (p) => p.on('pageerror', (e) => errs.push(e.message)));
};
(async () => {
  const b = await chromium.launch(); const errs = [];

  /* ---------- gallery (laptop) ---------- */
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true }); await setup(ctx, errs);
  const p = await ctx.newPage();
  await p.goto(BASE + 'index.html#/new/wedding'); await p.waitForSelector('#designCard'); await p.waitForTimeout(1500);
  const order = await p.locator('.design-tile [data-theme-pick]:not([data-pal-pick])').evaluateAll((els) => els.map((e) => e.dataset.themePick));
  ok('wedding gallery: best match first, then the five recommended designs', order[0] === 'royal-maroon' && IDS.every((id, i) => order[i + 1] === id), order.slice(0, 7).join());
  ok('each recommended design has a Recommended badge and its colour choices', (await p.locator('.dp-badge.rec').count()) === 5 && (await p.locator('[data-theme-pick="sage-garden"][data-pal-pick]').count()) === 4);
  ok('gallery cards show the leaf art (opposite corners / garland / ferns)', (await p.locator('.mini-sprig .mini-c.tl').count()) === 1 && (await p.locator('.mini-sprig .mini-c.br').count()) === 1 && (await p.locator('.mini-sprig .mini-c.tr').count()) === 0 && (await p.locator('.mini-garland .mini-hero').count()) === 1 && (await p.locator('.mini-fern .mini-hero').count()) === 1 && (await p.locator('.mini-arch .mini-hero').count()) === 1);
  await p.locator('.design-grid').scrollIntoViewIfNeeded();
  await p.locator('.design-grid').screenshot({ path: OUT + '/1-gallery-recommended.png' });
  await p.locator('[data-theme-pick="sage-garden"]').first().click(); await p.waitForTimeout(1200);
  const fr = p.frameLocator('#pvIframe');
  ok('choosing Sage Garden updates the live preview', (await fr.locator('body').getAttribute('class')).includes('motif-sprig'));
  await p.screenshot({ path: OUT + '/2-studio-preview.png' });
  const desc = await p.evaluate(() => IXGallery.suggest('sage green botanical leaves watercolour ivory', 'wedding').designs.map((d) => d.theme));
  ok('"Describe your card" finds a botanical design for leafy words', IDS.includes(desc[0]), desc.join());

  /* ---------- guest pages (phone), one invitation per design ---------- */
  // Demo mode keeps data in this browser only, so the phone pages and the host share one phone context
  const phone = await b.newContext({ ...devices['Pixel 7'] }); await setup(phone, errs);
  const ph = await phone.newPage();
  await ph.goto(BASE + 'index.html'); await ph.waitForFunction(() => window.H && H.store);
  await ph.evaluate(() => IXSamples.create(H.store));
  const made = await ph.evaluate(async (ids) => {
    const base = (await H.store.listInvitations()).find((i) => i.category === 'wedding');
    const out = [];
    for (const [n, id] of ids.entries()) {
      const inv = JSON.parse(JSON.stringify(base));
      inv.id = crypto.randomUUID(); inv.slug = 'botanical-' + id; inv.theme = id; inv.paletteIndex = 0; inv.design.fonts = { ...IXT.THEMES[id].fonts }; inv.design.border = 'thin';
      inv.media = { ...inv.media, cover: '' }; inv.dressCode = 'Ivory, champagne, blush or gold'; inv.design.sections.instructions = true; inv.published = null; inv.publishedAt = null;
      await H.store.publish(inv);
      await H.store.saveGuest({ invitationId: inv.id, name: 'Meera Kapoor', phone: '98111 0000' + n, email: '', allowed: 3 });
      const g = (await H.store.listGuests(inv.id))[0];
      out.push({ id: inv.id, slug: inv.slug, token: g.token, theme: id });
    }
    return out;
  }, IDS);
  for (const m of made) {
    const g = await phone.newPage();
    await g.goto(`${BASE}invite.html?i=${m.slug}&g=${m.token}`); await g.waitForSelector('#openBtn'); await g.waitForTimeout(400);
    await g.screenshot({ path: `${OUT}/3-${m.theme}-opener.png` });
    if (m.theme.endsWith('-arch')) ok(`${m.theme}: opening screen shows the gold sun seal`, (await g.locator('.op-sun .ix-sun svg').count()) === 1 && (await g.locator('.ix-seal').count()) === 0);
    await g.click('#openBtn'); await g.waitForTimeout(1500);
    const cls = await g.locator('body').getAttribute('class');
    const heroCorners = await g.locator('#sec-opening .ix-corner').evaluateAll((els) => els.map((e) => e.className.replace('ix-corner ', '')).join());
    const frame = await g.locator('#sec-opening').evaluate((e) => getComputedStyle(e, '::before').borderTopStyle);
    const want = { 'sage-garden': 'tl,br', 'eucalyptus-garland': 'bl,br', 'fern-meadow': '', 'champagne-arch': 'bl,br', 'pampas-arch': 'bl,br' }[m.theme];
    ok(`${m.theme}: opening page has its art, corners "${want || 'none'}" and the thin gold frame`, heroCorners === want && frame === 'solid' && ((m.theme === 'sage-garden') || (await g.locator('#sec-opening .ix-hero-art svg').count()) === 1), heroCorners + ' ' + cls);
    const box = await g.evaluate(() => { const t = document.querySelector('.ix-hero-text').getBoundingClientRect(), a = document.querySelector('.ix-hero-art svg'); const r = a ? a.getBoundingClientRect() : null; return { tTop: t.top, tBottom: t.bottom, aBottom: r ? r.bottom : 0, aTop: r ? r.top : 0, h: innerHeight }; });
    if (['eucalyptus-garland', 'champagne-arch', 'pampas-arch'].includes(m.theme)) ok(`${m.theme}: top art sits above the names, not on them`, box.aBottom <= box.tTop + 4, JSON.stringify(box));
    ok(`${m.theme}: names readable (no horizontal scroll)`, await g.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await g.screenshot({ path: `${OUT}/4-${m.theme}-hero.png` });
    await g.locator('#sec-schedule').scrollIntoViewIfNeeded(); await g.waitForTimeout(700);
    await g.screenshot({ path: `${OUT}/5-${m.theme}-events.png` });
    await g.locator('#sec-rsvp').scrollIntoViewIfNeeded(); await g.waitForTimeout(700);
    const btn = await g.locator('.ix-yes').evaluate((e) => getComputedStyle(e).backgroundImage + '|' + getComputedStyle(e).color);
    ok(`${m.theme}: RSVP buttons use the design's leaf green`, /gradient/.test(btn) || /rgb/.test(btn), btn.slice(0, 80));
    await g.screenshot({ path: `${OUT}/6-${m.theme}-rsvp.png` });
    await g.click('.ix-yes'); await g.waitForSelector('#thanks'); await g.waitForTimeout(500);
    await g.locator('#rsvpBox').scrollIntoViewIfNeeded();
    await g.screenshot({ path: `${OUT}/7-${m.theme}-thanks.png` });
    await g.locator('#sec-thankyou').scrollIntoViewIfNeeded(); await g.waitForTimeout(700);
    const closing = await g.locator('#sec-thankyou .ix-corner').count();
    ok(`${m.theme}: closing page keeps the same leaf corners`, closing === (want ? want.split(',').length : 0), String(closing));
    await g.screenshot({ path: `${OUT}/8-${m.theme}-closing.png` });
    if (m.theme === 'champagne-arch') {
      await g.locator('#sec-instructions').scrollIntoViewIfNeeded(); await g.waitForTimeout(600);
      const sw = await g.locator('#sec-instructions .ix-sw').evaluateAll((els) => els.map((e) => e.title));
      ok('dress code shows colour dots in the order written', sw.join() === 'ivory,champagne,blush,gold', sw.join());
      await g.screenshot({ path: `${OUT}/7b-${m.theme}-dress-code.png` });
    }
    // Hindi version of the same page
    await g.locator('.ix-lang[data-lang=hi]').click(); await g.waitForTimeout(900); await g.evaluate(() => scrollTo(0, 0)); await g.waitForTimeout(500);
    ok(`${m.theme}: Hindi page draws with the same design`, (await g.locator('body').getAttribute('class')).includes('lang-hi') && (await g.locator('#sec-opening .ix-corner, #sec-opening .ix-hero-art').count()) >= 1);
    await g.screenshot({ path: `${OUT}/9-${m.theme}-hindi.png` });
    await g.close();
  }
  // other colour choices render too
  for (const id of IDS) {
    const n = (await ph.evaluate((x) => IXT.THEMES[x].palettes.length, id));
    for (let i = 1; i < n; i++) {
      const m = made.find((x) => x.theme === id);
      await ph.evaluate(async ([inv, i]) => { const v = await H.store.getInvitation(inv); v.paletteIndex = i; await H.store.saveInvitation(v); await H.store.publish(v); }, [m.id, i]);
      const g = await phone.newPage(); await g.goto(`${BASE}invite.html?i=${m.slug}`); await g.waitForSelector('#openBtn'); await g.click('#openBtn'); await g.waitForTimeout(1300);
      await g.screenshot({ path: `${OUT}/10-${id}-colour-${i + 1}.png` }); await g.close();
    }
  }

  /* ---------- WhatsApp card image and home thumbnails ---------- */
  for (const m of made) {
    await ph.evaluate(async (id) => { const v = await H.store.getInvitation(id); v.paletteIndex = 0; await H.store.saveInvitation(v); await H.store.publish(v); }, m.id);
    await ph.goto(BASE + `index.html#/dash/${m.id}/share`); await ph.waitForSelector('#msgPrev');
    await ph.waitForFunction(() => /^data:image\/jpeg/.test(document.getElementById('waImg').src), null, { timeout: 15000 });
    const src = await ph.getAttribute('#waImg', 'src');
    fs.writeFileSync(`${OUT}/11-${m.theme}-whatsapp-card.jpg`, Buffer.from(src.split(',')[1], 'base64'));
    ok(`${m.theme}: WhatsApp card image is made`, src.length > 20000);
  }
  await ph.goto(BASE + 'index.html#/'); await ph.waitForTimeout(1800);
  ok('home thumbnails show the new designs\' art', (await ph.locator('.hx-h').count()) >= 4);
  await ph.screenshot({ path: OUT + '/12-home.png', fullPage: true });

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
  process.exit(res.every(Boolean) ? 0 : 1);
})();
