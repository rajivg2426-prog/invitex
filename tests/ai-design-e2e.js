/* "Design with AI" picker in step 1, end to end in the browser.
 * Forces Demo/Local mode and replaces the three AI store calls with fakes, so no
 * Supabase project or AI key is used. The server step has its own test:
 * node tests/ai-function-test.mjs */
const { chromium } = require('playwright');
const OUT = process.env.OUT || __dirname + '/e2e-output'; require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8765/';
let fails = 0; const errs = [];
const ok = (t, c, n = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + 'index.html');
  await p.click('text=Create new invitation');
  await p.waitForSelector('#designCard');
  ok('step 1 offers three ways: ready designs, your own design, AI', (await p.locator('[data-way]').count()) === 3);
  await p.click('.gal-tab >> text=All');
  ok('ready designs show as a gallery of small cards', (await p.locator('.design-pick .mini').count()) >= 14);
  await p.click('[data-way=ai]');
  await p.waitForSelector('#aiCard');
  ok('demo copy explains AI needs the online version', /online version/.test(await p.locator('#aiCard').innerText()));

  // switch on fake AI: placeholder "paintings" drawn on a canvas (light ones, to test palette matching)
  await p.evaluate(() => {
    const art = (i) => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 600, 800); g.addColorStop(0, ['#fde2e4', '#fff1d6', '#e2f0e8', '#f1e4f7'][i]); g.addColorStop(1, '#fffaf0'); x.fillStyle = g; x.fillRect(0, 0, 600, 800);
      x.strokeStyle = '#c9a15a'; x.lineWidth = 14; x.strokeRect(30, 30, 540, 740); x.fillStyle = '#c9a15a'; x.font = '48px serif'; x.textAlign = 'center'; x.fillText('placeholder ' + (i + 1), 300, 120); return c.toDataURL('image/jpeg', .9); };
    window.__aiCalls = [];
    let left = 3;
    Object.defineProperty(H.store, 'aiAvailable', { value: true });
    H.store.aiCredits = async () => ({ used: 3 - left, limit: 3, left });
    H.store.aiRecent = async () => [];
    H.store.aiGenerate = async (o) => { window.__aiCalls.push(o); await new Promise((r) => setTimeout(r, 400));
      if (left === 0) throw Object.assign(new Error('You have used all your free AI tries.'), { code: 'no_credits' });
      left--; return { images: [0, 1, 2, 3].map(art), used: 3 - left, limit: 3, left }; };
  });
  await p.click('[data-cat=housewarming]');
  await p.click('[data-way=ready]');
  await p.click('.gal-tab >> text=All');
  await p.click('.design-pick[data-theme-pick="royal-maroon"]'); // dark design first, to test the switch to light
  await p.click('[data-way=ai]');
  await p.waitForSelector('.ai-style');
  ok('AI card shows 8 ready styles', (await p.locator('.ai-style').count()) === 8);
  ok('style is suggested from the event type (Housewarming → Pichwai)', (await p.locator('.ai-style.on').innerText()).includes('Pichwai'));
  ok('free tries shown', /3 free tries left/.test(await p.locator('#aiLeft').innerText()));
  await p.click('[data-ai-style=temple]');
  await p.click('[data-ai-color=saffron-yellow]');
  await p.fill('#aiWords', 'Ganesha motif');
  await p.click('#aiGo');
  await p.waitForSelector('.ai-wait');
  ok('shows painting placeholders while waiting', (await p.locator('.ai-wait').count()) === 4);
  await p.screenshot({ path: OUT + '/ai-1-painting.png' });
  await p.waitForSelector('[data-ai-use]');
  const call = await p.evaluate(() => window.__aiCalls[0]);
  ok('sends style, colours, event type and words', call.style === 'temple' && call.colors === 'saffron-yellow' && call.category === 'housewarming' && call.words === 'Ganesha motif', JSON.stringify(call));
  ok('4 designs to choose from', (await p.locator('[data-ai-use]').count()) === 4);
  ok('tries left goes down', /2 free tries left/.test(await p.locator('#aiLeft').innerText()));
  const palBefore = await p.evaluate(() => H.store.getInvitation(location.hash.split('/')[2]).then((i) => i.paletteIndex));
  await p.locator('[data-ai-use]').nth(1).click();
  await p.waitForSelector('.ai-pick.on');
  await p.waitForTimeout(1200);
  const inv = await p.evaluate(() => H.store.getInvitation(location.hash.split('/')[2]));
  ok('picked design becomes the card background', /^idb:/.test(inv.media.background) && inv.design.bgMode === 'full', inv.media.background);
  ok('picked design is marked “On your card”', /On your card/.test(await p.locator('.ai-pick.on').innerText()));
  await p.click('[data-way=own]');
  ok('“Your own design” shows it as the current picture', await p.locator('.own-prev').count() === 1);
  await p.click('[data-way=ai]'); await p.waitForSelector('#aiGo');
  const lightBg = await p.evaluate((i) => { const h = IXT.THEMES[i.theme].palettes[i.paletteIndex].bg.slice(1); const n = parseInt(h, 16); return ((n >> 16) * .2126 + ((n >> 8) & 255) * .7152 + (n & 255) * .0722) / 255 > .55; }, inv);
  ok('light painting gets a light colour theme', lightBg, `${inv.theme} palette ${palBefore} → ${inv.paletteIndex}`);
  const fr = p.frameLocator('#pvIframe');
  await p.waitForTimeout(800);
  ok('live preview uses the AI background', await fr.locator('.ix-bgimg.full').count() === 1);
  await p.locator('#aiCard').scrollIntoViewIfNeeded();
  await p.screenshot({ path: OUT + '/ai-2-picked.png' });
  // use up tries
  await p.click('#aiGo'); await p.waitForSelector('[data-ai-use]:not([disabled])'); await p.waitForTimeout(300);
  await p.click('#aiGo'); await p.waitForSelector('[data-ai-use]:not([disabled])'); await p.waitForTimeout(300);
  ok('button is disabled once free tries are used', await p.locator('#aiGo').isDisabled() && /No free tries left/.test(await p.locator('#aiLeft').innerText()));
  // phone width
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('#aiCard').scrollIntoViewIfNeeded();
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('fits a phone screen (no sideways scroll)', !overflow);
  await p.screenshot({ path: OUT + '/ai-3-phone.png', fullPage: false });
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed'); process.exit(fails ? 1 : 0);
})();
