/* Design studio check: occasion gallery, palette dots, "describe your card", font pairs, undo/redo.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/studio-e2e.js [outDir]. Forces Demo/Local mode. */
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/studio'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const stub = r => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" });
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
  await ctx.route(/js\/config\.js/, stub);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  const inv = () => p.waitForTimeout(1000).then(() => p.evaluate(async () => { const id = location.hash.split('/')[2]; const i = await H.store.getInvitation(id); return { theme: i.theme, pal: i.paletteIndex, fonts: i.design.fonts, bg: i.media.background, cat: i.category }; }));
  await p.goto(BASE + 'index.html#/new/wedding'); await p.waitForSelector('#designCard');
  // gallery
  const tabs = await p.locator('#galOcc option').allInnerTexts();
  ok('gallery occasion menu has Reception, Festivals, Family gatherings, Conferences', ['Reception', 'Festivals', 'Family gatherings', 'Conferences', 'Product launches', 'School & college'].every(t => tabs.includes(t)), tabs.join(', '));
  ok('opens on Wedding for a wedding', (await p.inputValue('#galOcc')) === 'wedding');
  const wed = await p.locator('.design-tile').count();
  await p.selectOption('#galOcc', 'corporate');
  const corp = await p.locator('.design-tile [data-theme-pick]:not([data-pal-pick])').evaluateAll(els => els.map(e => e.dataset.themePick));
  ok('Corporate tab shows business designs, not wedding ones', corp.includes('corporate-slate') && !corp.includes('royal-maroon'), corp.join());
  await p.selectOption('#galOcc', 'all');
  ok('All tab shows every design', await p.locator('.design-tile').count() === 14 && wed < 14, 'wedding tab ' + wed);
  ok('each design shows its style and colour choices', await p.locator('.design-tile .dp-style').count() === 14 && await p.locator('.dp-pal').count() >= 30);
  await p.click('[data-theme-pick="blush-rings"][data-pal-pick="1"]'); await p.waitForTimeout(300);
  let s = await inv();
  ok('a colour dot picks that design in that colour', s.theme === 'blush-rings' && s.pal === 1, s.theme + '/' + s.pal);
  // describe your card
  await p.fill('#descIn', 'Create an elegant Indian wedding invitation with ivory background, champagne-gold typography, floral borders and a royal traditional feel.');
  await p.click('#descGo'); await p.waitForSelector('.describe-pick');
  const first = await p.locator('.describe-pick').first();
  const fTheme = await first.getAttribute('data-theme-pick'), fPal = +(await first.getAttribute('data-pal-pick'));
  const palName = await p.evaluate(([t, i]) => IXT.THEMES[t].palettes[i].name, [fTheme, fPal]);
  ok('describe: royal ivory wedding → Royal Maroon Florals in an ivory palette', fTheme === 'royal-maroon' && /ivory/i.test(palName), fTheme + ' / ' + palName);
  ok('describe: says which words matched', /floral|royal|ivory/.test(await first.innerText()));
  ok('describe: offers AI painting in the Royal style with ivory & gold', /Royal/.test(await p.locator('.describe-ai').innerText()) && /ivory & gold/.test(await p.locator('.describe-ai').innerText()), await p.locator('.describe-ai').innerText());
  await p.screenshot({ path: OUT + '/1-describe.png' });
  await first.click(); await p.waitForTimeout(300);
  s = await inv();
  ok('tapping a match puts it on the card', s.theme === 'royal-maroon' && s.pal === fPal);
  await p.click('#descAi');
  const ai = await p.evaluate(() => ({ way: document.querySelector('.way.on').dataset.way }));
  ok('Paint with AI opens the AI way', ai.way === 'ai');
  await p.click('[data-way=ready]');
  await p.fill('#descIn', 'zz qq'); await p.click('#descGo');
  ok('describe: unclear words get a gentle hint, not an error', (await p.locator('.describe').innerText()).includes('Try a few words'));
  // undo / redo
  ok('undo is available after changes', !(await p.locator('#undoBtn').isDisabled()));
  await p.click('#undoBtn'); await p.waitForTimeout(400);
  s = await inv();
  ok('undo goes back to the previous design', s.theme === 'blush-rings' && s.pal === 1, s.theme + '/' + s.pal);
  await p.click('#redoBtn'); await p.waitForTimeout(400);
  s = await inv();
  ok('redo brings it forward again', s.theme === 'royal-maroon' && s.pal === fPal, s.theme + '/' + s.pal);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
  ok('Ctrl+Z undoes too', (await inv()).theme === 'blush-rings');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(400);
  // undo brings back a removed picture
  await p.click('[data-way=own]');
  const img = path.join(OUT, 'own.png');
  await p.screenshot({ path: img, clip: { x: 0, y: 0, width: 600, height: 800 } });
  await p.setInputFiles('#artIn', img);
  await p.waitForSelector('#stage'); await p.waitForTimeout(400);
  await p.click('.modal-f >> text=Apply');
  await p.waitForSelector('#artDel'); await p.waitForTimeout(800);
  const ref = (await inv()).bg;
  await p.click('#artDel'); await p.waitForTimeout(900);
  ok('picture removed', !(await inv()).bg);
  await p.click('#undoBtn'); await p.waitForTimeout(900);
  const back = await inv();
  const still = await p.evaluate(async (r) => !!(await H.store.resolveMedia(r)), ref);
  ok('undo puts the removed picture back (file kept)', back.bg === ref && still);
  // font pairs
  await p.click('.step-tab[data-step="2"]'); await p.waitForTimeout(400);
  await p.click('#fpLook summary');
  await p.waitForSelector('.pair');
  ok('three font pairings suggested for the design', await p.locator('.pair').count() === 3);
  const pid = await p.locator('.pair').nth(1).getAttribute('data-pair');
  await p.locator('.pair').nth(1).click(); await p.waitForTimeout(400);
  const want = await p.evaluate(id => IXGallery.FONT_PAIRS.find(x => x.id === id).fonts, pid);
  s = await inv();
  ok('a pairing sets all three fonts', JSON.stringify(s.fonts) === JSON.stringify({ ...s.fonts, ...want }), pid);
  await p.locator('.pair-grid').screenshot({ path: OUT + '/2-pairs.png' });
  // leaving the editor deletes only files no longer used
  await p.click('#artDel').catch(() => {});
  // phone
  const ph = await b.newContext({ ...devices['Pixel 7'] }); await ph.route(/js\/config\.js/, stub);
  const m = await ph.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto(BASE + 'index.html#/new/birthday'); await m.waitForSelector('.design-grid');
  const ov = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('phone: no sideways scroll on the design step', ov <= 0, 'overflow=' + ov);
  await m.screenshot({ path: OUT + '/3-phone.png', fullPage: false });
  await p.goto(BASE + 'index.html#/new/wedding'); await p.waitForSelector('.design-grid'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/0-gallery.png' });
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const f = res.filter(x => !x).length; console.log(f ? f + ' failed' : 'all passed'); process.exit(f ? 1 : 0);
})();
