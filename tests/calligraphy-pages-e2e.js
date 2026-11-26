/* Calligraphy Studio part B, end to end in the browser (demo mode):
 * the four matching pages (cover, main card, events, RSVP) and writing the words with Copy Studio
 * (including the new Poetic style), without ever writing over a line the host typed.
 * Run with no server:  node tests/calligraphy-pages-e2e.js   (or BASE=http://localhost:8765/ with a local server)
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
  const inv = () => p.evaluate(async () => { const id = location.hash.split('/')[2]; return H.store.getInvitation(id); });
  const settle = () => p.waitForTimeout(1300); // autosave runs 0.8 s after a change

  /* set up: a wedding with names, in the studio */
  await p.goto(BASE + 'index.html');
  await p.click('text=Create new invitation');
  await p.waitForSelector('[data-cat=wedding]');
  await p.click('[data-cat=wedding]');
  await p.click('[data-way=callig]');
  await p.waitForSelector('[data-callig=royal-english]');
  await p.click('[data-callig=royal-english]');
  await p.waitForSelector('#ixCard svg', { timeout: 20000 });
  await p.fill('#ixf-bride', 'Raghavi'); await p.fill('#ixf-groom', 'Joshi');
  await p.fill('#ixf-date', '2027-09-01');
  await settle();

  /* 1. four pages */
  ok('the studio shows four pages: Cover, Main card, Events, RSVP', (await p.locator('#ixPages [data-page]').allTextContents()).map((t) => t.replace(/\d|\(off\)/g, '').trim()).join('|') === 'Cover|Main card|Events|RSVP');

  /* 2. cover: names, cover line, date; names keep their own position per page */
  await p.click('[data-page=cover]');
  await p.waitForSelector('#ixCard [data-el="cover:names"]');
  let t = await svgText();
  ok('cover shows the names, the cover line and the date', /Raghavi/.test(t) && /Joshi/.test(t) && /Together with their families/.test(t) && /September 2027/.test(t), t.slice(0, 120));
  await p.fill('#ixf-coverLine', 'The wedding of');
  await p.waitForTimeout(200);
  ok('cover line can be edited', /The wedding of/.test(await svgText()));
  const g = p.locator('#ixCard [data-el="cover:names"]'); const bx = await g.boundingBox();
  await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.down(); await p.mouse.move(bx.x + bx.width / 2 + 40, bx.y + bx.height / 2 + 30, { steps: 6 }); await p.mouse.up();
  await settle();
  let d = await inv();
  ok('moving the names on the cover does not move them on the main card', (d.calligraphy.el['cover:names'] || {}).dx > 0 && !((d.calligraphy.el.names || {}).dx));
  await p.screenshot({ path: OUT + '/b1-cover.png' });

  /* 3. events page: every event, add one, edit it on the card */
  await p.click('[data-page=events]');
  await p.waitForSelector('#ixCard [data-el="events:eventsTitle"]');
  ok('events page has a title and the first event', /Order of Celebrations/.test(await svgText()) && (await p.locator('#ixCard [data-el^="events:ev0"]').count()) === 2);
  await p.click('#ixEvAdd');
  await p.fill('#ixf-e1-name', 'Sangeet'); await p.fill('#ixf-e1-date', '2027-08-31'); await p.fill('#ixf-e1-start', '19:00'); await p.fill('#ixf-e1-venue', 'Amma Arangam');
  await p.waitForTimeout(300);
  t = await svgText();
  ok('an added event appears on the events page with its date and place', /Sangeet/.test(t) && /31/.test(t) && /Amma Arangam/.test(t), t.slice(0, 200));
  await p.locator('#ixCard [data-el="events:ev1n"] text').first().click();
  ok('tapping an event on the card opens its settings', /Event name/.test(await p.locator('#ixRight').innerText()));
  await settle();
  d = await inv();
  ok('events are saved on the invitation itself (shared with RSVP and calendar)', d.events.length === 2 && d.events[1].name === 'Sangeet');
  await p.screenshot({ path: OUT + '/b2-events.png' });

  /* 4. RSVP page */
  await p.click('[data-page=rsvp]');
  await p.waitForSelector('#ixCard [data-el="rsvp:rsvpTitle"]');
  await p.fill('#ixf-s-deadline', '2027-08-01');
  await p.fill('#ixf-c-name', 'Anita Sharma'); await p.fill('#ixf-c-phone', '+91 98765 43210');
  await p.waitForTimeout(300);
  t = await svgText();
  ok('RSVP page shows the reply-by date and the contact', /reply is\s*requested by 1/.test(t) && /August 2027/.test(t) && /Anita Sharma/.test(t), t);
  ok('before publishing, the editor shows where the QR code will go (not a fake code)', (await p.locator('#ixCard [data-el="rsvp:qr"] rect[stroke-dasharray]').count()) === 1);
  const guestSvg = await p.evaluate(async () => { const i = await H.store.getInvitation(location.hash.split('/')[2]); i.slug = 'demo-slug'; return IXC.draw(i, { page: 'rsvp', lang: 'en' }).svg; });
  ok('once published, a real QR code is drawn in ink', /<path d="M[\d.]+ [\d.]+h/.test(guestSvg) && !/stroke-dasharray/.test(guestSvg));
  await settle();
  d = await inv();
  ok('reply-by date is the same setting that closes RSVP', d.settings.rsvpDeadline === '2027-08-01');
  await p.screenshot({ path: OUT + '/b3-rsvp.png' });

  /* 5. switch a page off, undo */
  await p.click('#ixPageOn');
  await settle();
  d = await inv();
  ok('a page can be left out of the set', d.calligraphy.pages && d.calligraphy.pages.rsvp === false && /\(off\)/.test(await p.locator('[data-page=rsvp]').innerText()));
  ok('pages switched on: cover, main, events', JSON.stringify(await p.evaluate(async () => IXC.styles.pagesOn((await H.store.getInvitation(location.hash.split('/')[2])).calligraphy))) === '["cover","main","events"]');
  await p.keyboard.press('Control+z'); await settle();
  d = await inv();
  ok('undo brings the page back', !d.calligraphy.pages || d.calligraphy.pages.rsvp !== false);

  /* 6. Copy Studio inside the calligraphy studio, Poetic style */
  await p.click('[data-page=main]');
  await p.click('[data-tab=words]');
  ok('words panel offers the 7 calligraphy writing styles', (await p.locator('[data-wstyle]').allTextContents()).join('|') === 'Royal|Romantic|Traditional|Formal|Poetic|Elegant|Minimal');
  await p.click('[data-wstyle=poetic]');
  await p.waitForSelector('#ixCopyOv #csGen');
  ok('Copy Studio opens beside the card with Poetic chosen', (await p.locator('#ixCopyOv .cs-style.on').getAttribute('data-csstyle')) === 'poetic' && await p.locator('#ixCard svg').isVisible());
  await p.click('#csGen'); await p.waitForSelector('.cs-card');
  const card0 = p.locator('.cs-card').nth(0);
  const top0 = (await card0.locator('[data-line$=".familyName"] .cs-text').innerText()).trim();
  const sub0 = (await card0.locator('[data-line$=".subtitle"] .cs-text').innerText()).trim();
  await card0.locator('[data-act=preview]').click(); await p.waitForTimeout(500);
  ok('preview puts the version on the calligraphy card', (await svgText()).includes(top0));
  d = await inv();
  ok('preview does not change the saved words', d.text.en.heading !== top0);
  await card0.locator('[data-act=use]').click();
  await p.waitForSelector('.cs-done'); await settle();
  d = await inv();
  t = await svgText();
  ok('using a version writes the heading, the line under the names and the blessing', d.text.en.heading === top0 && d.text.en.underNames === sub0 && d.text.en.blessing === d.text.en.thankyou, JSON.stringify([d.text.en.heading, top0]));
  ok('the new words are on the card, names unchanged', t.includes(top0) && t.includes(sub0) && /Raghavi/.test(t) && /Joshi/.test(t));
  await p.screenshot({ path: OUT + '/b4-copy-studio.png' });
  await p.click('#csBack2');
  ok('closing Copy Studio returns to the calligraphy tools', !(await p.locator('#ixCopyOv').count()) && await p.locator('#ixf-heading').isVisible());

  /* 7. manual edits are kept */
  await p.fill('#ixf-heading', 'With joy in our hearts we invite you'); await settle();
  await p.click('#ixCopy'); await p.waitForSelector('#ixCopyOv #csGen');
  await p.click('#csGen'); await p.waitForSelector('.cs-card');
  const card1 = p.locator('.cs-card').nth(1);
  const msg1 = (await card1.locator('[data-line$=".message"] .cs-text').innerText()).trim().slice(0, 30);
  await card1.locator('[data-act=use]').click();
  await p.waitForSelector('.cs-done'); await settle();
  d = await inv();
  ok('a heading typed in the calligraphy studio is not replaced', d.text.en.heading === 'With joy in our hearts we invite you');
  ok('the other lines still update', (await svgText()).replace(/\s+/g, ' ').includes(msg1.replace(/\s+/g, ' ').slice(0, 20)), msg1);
  await p.click('#csBack2');

  /* 8. Poetic wording in all three languages, never for business events */
  const poetic = await p.evaluate(() => {
    const i = { id: 'x', category: 'wedding', defaultLang: 'en', languages: ['en', 'hi', 'pa'], text: { en: { title: 'Raghavi & Joshi', hostName: 'The Sharma Family' }, hi: { title: 'राघवी संग जोशी', hostName: 'शर्मा परिवार' }, pa: { title: 'ਰਾਘਵੀ ਸੰਗ ਜੋਸ਼ੀ', hostName: 'ਸ਼ਰਮਾ ਪਰਿਵਾਰ' } }, events: [{ name: 'Wedding', date: '2027-09-01', time: '19:00', venue: 'Amma Arangam', city: 'Chennai' }] };
    return ['en', 'hi', 'pa'].map((l) => IXCopy.generate({ facts: IXCopy.factsFrom(i, l, {}), lang: l, style: 'poetic', length: 'standard', count: 3, seed: 't' + l }).versions);
  });
  ok('Poetic writes 3 versions in English, Hindi and Punjabi', poetic.every((v) => v.length === 3));
  ok('Hindi Poetic is in Devanagari, Punjabi Poetic in Gurmukhi', poetic[1].every((v) => /[ऀ-ॿ]/.test(v.fields.familyName)) && poetic[2].every((v) => /[਀-੿]/.test(v.fields.familyName)));
  ok('Poetic is offered for weddings, not for business events', await p.evaluate(() => IXCopy.stylesFor('wedding').some((s) => s.id === 'poetic') && !IXCopy.stylesFor('corporate').some((s) => s.id === 'poetic')));

  /* 9. saved and reopened: pages and words come back */
  await p.reload(); await p.waitForSelector('#ixCard svg', { timeout: 20000 });
  await p.click('[data-page=events]'); await p.waitForTimeout(600);
  ok('after reopening, the events page still has both events', /Sangeet/.test(await svgText()));
  await p.click('[data-page=cover]'); await p.waitForTimeout(600);
  ok('after reopening, the cover keeps its own line', /The wedding of/.test(await svgText()));

  /* 10. the guest page (the editor's live preview) still shows the main card */
  const id = p.url().split('/').pop();
  await p.goto(BASE + `index.html#/edit/${id}/1`);
  await p.waitForSelector('#pvIframe'); await p.waitForTimeout(3000);
  const fr = p.frameLocator('#pvIframe');
  ok('guest page shows the calligraphy main card with the new words', (await fr.locator('.ix-callig svg').first().evaluate((s) => s.textContent)).includes('With joy in our hearts'));

  /* 11. phone: page bar fits and works */
  const ph = await context(browser, { ...devices['iPhone 13'] });
  const m = await ph.newPage(); watch(m);
  await m.goto(BASE + 'index.html');
  await m.evaluate(async () => { const i = IX.model.newInvitation('wedding'); i.text.en.bride = 'Raghavi'; i.text.en.groom = 'Joshi'; i.calligraphy = IXC.styles.newDesign('vintage-script'); IXC.styles.fillWords(i, 'en'); const s = await H.store.saveInvitation(i); location.hash = '#/calligraphy/' + s.id; });
  await m.waitForSelector('#ixCard svg', { timeout: 20000 });
  await m.click('[data-page=events]'); await m.waitForTimeout(500);
  const over = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('on a phone the page bar fits without sideways scrolling', over <= 1, String(over));
  ok('on a phone the events page draws', (await m.locator('#ixCard [data-el="events:eventsTitle"]').count()) === 1);
  await m.screenshot({ path: OUT + '/b5-phone-events.png' });
  await ph.close();

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `${fails} check(s) failed` : 'All checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
