/* Calligraphy Studio, end to end in the browser (demo mode).
 * Run either against a local server:  python3 -m http.server 8765 &  then  BASE=http://localhost:8765/ node tests/calligraphy-e2e.js
 * or with no server at all:           node tests/calligraphy-e2e.js   (files are served straight from the repo)
 * Screenshots go to tests/e2e-output/calligraphy/. */
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(__dirname, 'e2e-output', 'calligraphy'); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://ix.test/';
let fails = 0; const errs = [];
const ok = (t, c, n = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function context(browser, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.fulfill({ status: 200, body: '' }));
  if (!process.env.BASE) {
    await ctx.route('http://ix.test/**', (r) => {
      const u = new URL(r.request().url());
      if (u.pathname === '/js/config.js') return r.fallback();
      const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      r.fulfill({ contentType: TYPES[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
  }
  return ctx;
}
const watch = (p) => { p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errs.push(m.text())); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); watch(p);
  const svgText = () => p.locator('#ixCard svg').evaluate((s) => s.textContent);
  const fontOf = (id) => p.locator(`#ixCard [data-el="${id}"] text`).first().getAttribute('font-family');

  /* 1. the category is in the gallery and in step 1 */
  await p.goto(BASE + 'index.html');
  await p.click('text=Create new invitation');
  await p.waitForSelector('[data-cat=wedding]');
  await p.click('[data-cat=wedding]');
  ok('“Calligraphy & Handwritten” tab is in the ready-design gallery', await p.locator('#galOcc option[value=calligraphy]').count() === 1);
  await p.selectOption('#galOcc', 'calligraphy');
  await p.waitForSelector('[data-callig]');
  ok('the tab shows all 10 styles', (await p.locator('[data-callig]').count()) === 10);
  await p.click('[data-way=callig]');
  await p.waitForFunction(() => document.querySelectorAll('[data-cthumb] svg').length === 10, null, { timeout: 20000 });
  ok('Calligraphy is a design choice with 10 live thumbnails', (await p.locator('[data-cthumb] svg').count()) === 10);
  await p.screenshot({ path: OUT + '/1-step1-styles.png' });

  /* open the studio with the reference-style design */
  await p.click('[data-callig=royal-english]');
  await p.waitForSelector('#ixCard svg', { timeout: 20000 });
  await p.waitForTimeout(800);
  ok('studio opens with the chosen style', /calligraphy/.test(p.url()));

  /* 2. fonts load (the real files, not a fallback) */
  const fontsLoaded = await p.evaluate(async () => { await IXC.fonts.ensure(IXC.fonts.LIST.map((f) => [f.name, f.w || f.weights[0]]), 20000); return IXC.fonts.LIST.filter((f) => !IXC.fonts.isLoaded(f.name, f.w || f.weights[0])).map((f) => f.name); });
  ok('all 33 library fonts load from fonts/calligraphy', fontsLoaded.length === 0, fontsLoaded.join(', '));
  await p.click('[data-tab=fonts]');
  const cats = await p.locator('.ixc-fcat summary').allTextContents();
  ok('font panel shows traditional, modern and serif categories', ['Traditional English', 'Modern', 'Classic'].every((c) => cats.some((x) => x.includes(c))), cats.join(' | '));

  /* 3. names render exactly as typed */
  await p.click('[data-tab=words]');
  await p.fill('#ixf-bride', 'Raghavi Vijayarangam');
  await p.fill('#ixf-groom', 'Joshi Kumar');
  await p.fill('#ixf-date', '2027-09-01');
  await p.fill('#ixf-start', '09:00');
  await p.fill('#ixf-venue', 'Amma Arangam');
  await p.fill('#ixf-address', 'Z-7, 3rd Avenue, Block E, Anna Nagar East');
  await p.fill('#ixf-city', 'Chennai, Tamil Nadu 600102');
  await p.fill('#ixf-reception', 'Reception 6:30 p.m., Saturday 31st August');
  await p.waitForTimeout(600);
  const namesText = await p.locator('#ixCard [data-el=names]').evaluate((g) => [...g.querySelectorAll('text')].map((t) => t.textContent).join('|'));
  ok('bride and groom names are spelled exactly as typed', namesText.replace(/\|/g, '').includes('RaghaviVijayarangam'.replace(/\s/g, '')) || /R\|aghavi Vijayarangam/.test(namesText), namesText);
  ok('decorated initial uses its own font', await p.locator('#ixCard [data-el=names] [data-init]').first().getAttribute('font-family').then((f) => /UnifrakturCook/.test(f)));
  await p.screenshot({ path: OUT + '/2-studio-desktop.png' });

  /* 4 + 5. editable text; different fonts per section */
  await p.click('#ixCard [data-el=heading]');
  await p.waitForSelector('#ixr-heading');
  await p.fill('#ixr-heading', 'Together with their families\nwe invite you');
  await p.waitForTimeout(400);
  ok('a line stays editable after the card is drawn', (await svgText()).includes('Together with their families'));
  await p.selectOption('#ixr-f', 'Pinyon Script');
  await p.waitForTimeout(600);
  ok('the heading can use a different font from the names', /Pinyon Script/.test(await fontOf('heading')) && !/Pinyon Script/.test(await p.locator('#ixCard [data-el=names] text:not([data-init])').first().getAttribute('font-family')));
  await p.click('#ixCard [data-el=venue]');
  await p.selectOption('#ixr-f', 'Cormorant Garamond');
  await p.waitForTimeout(500);
  ok('event details can use a third font', /Cormorant Garamond/.test(await fontOf('venue')));

  /* 11. colour controls */
  await p.click('#ixCard [data-el=names]');
  await p.click('[data-nb=burgundy]');
  await p.waitForTimeout(300);
  const fills = await p.locator('#ixCard [data-el=names] text:not([data-init])').evaluateAll((ts) => ts.map((t) => t.getAttribute('fill')));
  ok('bride’s ink changes only the bride’s name', fills[0] === '#7a1f2e' && fills[fills.length - 1] !== '#7a1f2e', fills.join(','));

  /* 12. undo and redo */
  await p.waitForTimeout(600);
  await p.click('#ixUndo'); await p.waitForTimeout(400);
  const afterUndo = await p.locator('#ixCard [data-el=names] text:not([data-init])').first().getAttribute('fill');
  await p.click('#ixRedo'); await p.waitForTimeout(400);
  const afterRedo = await p.locator('#ixCard [data-el=names] text:not([data-init])').first().getAttribute('fill');
  ok('undo puts the ink back, redo applies it again', afterUndo !== '#7a1f2e' && afterRedo === '#7a1f2e', afterUndo + ' → ' + afterRedo);

  /* 9. flourishes: add, move, resize, and they are kept off words */
  await p.click('[data-tab=orn]');
  await p.click('[data-add=vintage-rose]');
  await p.waitForTimeout(600);
  const addedId = await p.evaluate(() => document.querySelector('#ixCard [data-el^="add-"]').dataset.el);
  const box0 = await p.locator(`#ixCard [data-el="${addedId}"]`).boundingBox();
  await p.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
  await p.mouse.down(); await p.mouse.move(box0.x + box0.width / 2 + 120, box0.y + box0.height / 2 + 10, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(400);
  const box1 = await p.locator(`#ixCard [data-el="${addedId}"]`).boundingBox();
  ok('a flourish can be dragged', Math.abs(box1.x - box0.x - 120) < 30, `${Math.round(box0.x)} → ${Math.round(box1.x)}`);
  const h = await p.locator('#ixSel .h-size').boundingBox();
  await p.mouse.move(h.x + 9, h.y + 9); await p.mouse.down(); await p.mouse.move(h.x + 70, h.y + 60, { steps: 6 }); await p.mouse.up();
  await p.waitForTimeout(400);
  const box2 = await p.locator(`#ixCard [data-el="${addedId}"]`).boundingBox();
  ok('a flourish can be resized', box2.width > box1.width * 1.15, `${Math.round(box1.width)} → ${Math.round(box2.width)}`);
  // drop it on the names: it must slide off
  const nb = await p.locator('#ixCard [data-el=names]').boundingBox();
  const b2 = await p.locator(`#ixCard [data-el="${addedId}"]`).boundingBox();
  await p.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2); await p.mouse.down();
  await p.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(700);
  const b3 = await p.locator(`#ixCard [data-el="${addedId}"]`).boundingBox();
  const overlap = Math.max(0, Math.min(b3.x + b3.width, nb.x + nb.width) - Math.max(b3.x, nb.x)) * Math.max(0, Math.min(b3.y + b3.height, nb.y + nb.height) - Math.max(b3.y, nb.y));
  ok('a flourish dropped on the names is moved off them', overlap / (b3.width * b3.height) <= 0.13, (overlap / (b3.width * b3.height)).toFixed(2));
  ok('the flourish can be rotated and its transparency set', await (async () => { await p.locator('[data-sl=rot]').fill('25'); await p.locator('[data-sl=opacity]').fill('0.4'); await p.waitForTimeout(300); const tf = await p.locator(`#ixCard [data-el="${addedId}"]`).getAttribute('transform'); const op = await p.locator(`#ixCard [data-el="${addedId}"]`).getAttribute('opacity'); return /rotate\(25\)/.test(tf) && op === '0.6'; })());

  /* 10. paper */
  await p.click('[data-tab=paper]');
  const papers = await p.locator('[data-paper]').evaluateAll((bs) => bs.map((b) => b.dataset.paper));
  let paperOk = true;
  for (const id of papers) { await p.click(`[data-paper="${id}"]`); await p.waitForTimeout(120); const c = await p.locator('#ixCard svg > g rect').first().getAttribute('fill'); if (!c) paperOk = false; }
  ok('all 8 papers can be applied', papers.length === 8 && paperOk);
  await p.click('[data-paper=dark-luxury]'); await p.waitForTimeout(300);
  ok('dark paper switches unreadable inks to light ones', !(await p.locator('#ixWarn').innerText()).includes('hard to read'));
  await p.click('[data-paper=handmade-ivory]');
  await p.waitForTimeout(300);

  /* 6 + 7. Hindi and Punjabi */
  const scripts = await p.evaluate(async () => {
    const inv = IX.model.newInvitation('wedding'); inv.languages = ['en', 'hi', 'pa'];
    inv.text.hi = { bride: 'राघवी विजयरंगम', groom: 'जोशी कुमार' }; inv.text.pa = { bride: 'ਰਾਘਵੀ', groom: 'ਜੋਸ਼ੀ ਕੁਮਾਰ' };
    inv.calligraphy = IXC.styles.newDesign('royal-english'); IXC.styles.fillWords(inv, 'hi'); IXC.styles.fillWords(inv, 'pa');
    const hi = await IXC.render(inv, { lang: 'hi' }), pa = await IXC.render(inv, { lang: 'pa' });
    const f = (svg, word) => { const d = new DOMParser().parseFromString(svg, 'image/svg+xml'); const t = [...d.querySelectorAll('text')].find((x) => x.textContent.includes(word)); return t ? t.getAttribute('font-family') : ''; };
    return { hi: f(hi.svg, 'राघवी'), pa: f(pa.svg, 'ਰਾਘਵੀ'), hiLoaded: IXC.fonts.isLoaded('Amita'), paLoaded: IXC.fonts.isLoaded('Tiro Gurmukhi') };
  });
  ok('Hindi names use a Devanagari calligraphic font (Amita), not an English script', /^'Amita'/.test(scripts.hi) && scripts.hiLoaded, scripts.hi);
  ok('Punjabi names use a Gurmukhi font (Tiro Gurmukhi), not an English script', /^'Tiro Gurmukhi'/.test(scripts.pa) && scripts.paLoaded, scripts.pa);
  ok('English calligraphy fonts are not offered for Hindi text', await p.evaluate(() => IXC.fonts.forScript('deva').every((f) => f.script === 'deva') && IXC.fonts.pick('Tangerine', 'deva').name !== 'Tangerine'));

  /* 8. long names fit */
  await p.click('[data-tab=words]');
  await p.fill('#ixf-bride', 'Venkatalakshmi Subramaniam Ramanathapuram');
  await p.waitForTimeout(600);
  const fit = await p.evaluate(() => { const svg = document.querySelector('#ixCard svg'), sb = svg.getBoundingClientRect(), nb = svg.querySelector('[data-el=names]').getBoundingClientRect(); return nb.left >= sb.left - 2 && nb.right <= sb.right + 2; });
  ok('a 40-letter name stays inside the card', fit);
  await p.screenshot({ path: OUT + '/3-long-name.png' });
  await p.fill('#ixf-bride', 'Raghavi Vijayarangam');

  /* 13. save and reopen */
  await p.click('#ixSave'); await p.waitForTimeout(600);
  const before = await p.evaluate(() => document.querySelector('#ixCard svg').outerHTML.replace(/ixs-[\w-]+/g, ''));
  await p.reload(); await p.waitForSelector('#ixCard svg'); await p.waitForTimeout(1200);
  const after = await p.evaluate(() => document.querySelector('#ixCard svg').outerHTML.replace(/ixs-[\w-]+/g, ''));
  ok('the design reopens exactly as saved after a reload', before === after, before.length + ' vs ' + after.length);

  /* restore original layout */
  await p.click('.ixc-more summary'); await p.click('#ixRestore'); await p.click('.modal [data-a="1"]');
  await p.waitForTimeout(500);
  ok('Restore original layout removes added flourishes and keeps the words', (await p.locator('#ixCard [data-el^="add-"]').count()) === 0 && (await svgText()).includes('Amma Arangam'));
  await p.screenshot({ path: OUT + '/4-studio-final.png' });

  /* the invitation preview (the guest page) shows the calligraphy card, RSVP stays below */
  const invId = p.url().split('/').pop();
  await p.goto(BASE + `index.html#/edit/${invId}/1`);
  await p.waitForSelector('#pvIframe'); await p.waitForTimeout(3000);
  const fr = p.frameLocator('#pvIframe');
  const guest = { card: await fr.locator('.ix-callig svg').count(), rsvp: await fr.locator('#sec-rsvp').count() };
  ok('guest page shows the calligraphy card with RSVP below it', guest.card === 1 && guest.rsvp === 1, JSON.stringify(guest));
  ok('step 1 shows the calligraphy design as the current choice', await p.locator('.callig-on').count() === 1);
  await p.screenshot({ path: OUT + '/5-editor-preview.png' });

  /* 18. existing ready designs still work */
  await p.goto(BASE + 'index.html'); await p.click('text=Create new invitation'); await p.waitForSelector('[data-cat=wedding]');
  await p.selectOption('#galOcc', 'all');
  ok('all 19 ready designs are still offered', (await p.locator('.design-tile').count()) === 19);
  await p.click('[data-theme-pick=blush-rings]'); await p.waitForTimeout(800);
  const pv = await p.frameLocator('#pvIframe').locator('.ix-hero').count().catch(() => 0);
  ok('a ready design still previews normally', pv >= 1);

  /* 17. phone */
  const phone = await context(browser, { ...devices['iPhone 13'] });
  const m = await phone.newPage(); watch(m);
  await m.goto(BASE + 'index.html'); await m.click('text=Create new invitation'); await m.waitForSelector('[data-cat=wedding]');
  await m.click('[data-way=callig]'); await m.waitForSelector('[data-callig=golden-ink]'); await m.click('[data-callig=golden-ink]');
  await m.waitForSelector('#ixCard svg', { timeout: 20000 }); await m.waitForTimeout(1000);
  const noScroll = await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  ok('phone: studio fits the screen with no sideways scrolling', noScroll);
  await m.screenshot({ path: OUT + '/6-phone-card.png' });
  await m.click('[data-btab=words]'); await m.waitForTimeout(300);
  ok('phone: Words sheet opens from the bottom bar', await m.locator('.ixc.sheet-open #ixf-bride').isVisible());
  await m.fill('#ixf-bride', 'Ananya'); await m.fill('#ixf-groom', 'Kabir'); await m.waitForTimeout(500);
  await m.screenshot({ path: OUT + '/7-phone-words.png' });
  await m.click('[data-btab=ink]'); await m.waitForTimeout(300);
  await m.screenshot({ path: OUT + '/8-phone-ink.png' });
  await m.click('[data-close-sheet]'); await m.waitForTimeout(300);
  await m.locator('#ixCard [data-el=names]').click(); await m.waitForTimeout(400);
  ok('phone: tapping the names opens their settings', await m.locator('.ixc.sel-open #ixRight #ixr-b').isVisible());
  await m.screenshot({ path: OUT + '/9-phone-names.png' });

  ok('no script errors', errs.length === 0, errs.slice(0, 5).join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
