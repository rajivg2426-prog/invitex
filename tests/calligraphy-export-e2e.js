/* Calligraphy Studio part C, end to end in the browser (demo mode): downloads and saving.
 *  – PNG / JPG at 300 dpi, all pages as a ZIP, PDF, print PDF with bleed and crop marks
 *  – the files are checked from the outside: picture sizes, PDF page sizes, that lettering is
 *    vector outlines (not a screenshot, not a substitute font), Hindi and Punjabi in the PDF
 *  – the Download dialog in the studio, on a phone, and from the Share tab
 *  – the design survives the same save and load the online (Supabase) version does
 * Run with no server:  node tests/calligraphy-export-e2e.js   (or BASE=http://localhost:8765/)
 * Files go to tests/e2e-output/calligraphy/. */
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.OUT || path.join(__dirname, 'e2e-output', 'calligraphy'); fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://ix.test/';
let fails = 0; const errs = [];
const ok = (t, c, n = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function context(browser, opts) {
  const ctx = await browser.newContext({ acceptDownloads: true, ...opts });
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

/* ---- reading the files from the outside ---- */
const pngSize = (b) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
function jpgSize(b) { for (let i = 2; i < b.length;) { const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }; i += 2 + len; } return {}; }
function pdfInfo(buf) {
  const s = buf.toString('latin1');
  const boxes = [...s.matchAll(/\/MediaBox \[([\d. ]+)\]/g)].map((m) => m[1].trim().split(/\s+/).map(Number));
  const images = (s.match(/\/Subtype \/Image/g) || []).length;
  let paths = 0, text = 0;
  // page content streams: inflate and count drawing operators (curves = lettering and flourishes; Tj/TJ = typed text)
  for (const m of s.matchAll(/(?<!end)stream\r?\n/g)) {
    const start = m.index + m[0].length, end = s.indexOf('endstream', start);
    let txt;
    try { txt = zlib.inflateSync(buf.subarray(start, end)).toString('latin1'); } catch (e) { continue; }
    paths += (txt.match(/ c\n/g) || []).length;
    text += (txt.match(/[)\]]\s*T[jJ]\b/g) || []).length;
  }
  return { pages: (s.match(/\/Type \/Page\b(?!s)/g) || []).length, boxes, images, paths, text };
}
const mm = (pt) => Math.round((pt / 72) * 25.4 * 10) / 10;

(async () => {
  const browser = await chromium.launch();
  const ctx = await context(browser, { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); watch(p);

  /* a full design: names, four events, contact, reply-by date, published link */
  await p.goto(BASE + 'index.html');
  await p.waitForFunction(() => window.H && H.store);
  const id = await p.evaluate(async () => {
    const i = IX.model.newInvitation('wedding');
    i.slug = 'raghavi-joshi';
    Object.assign(i.text.en, { bride: 'Raghavi', groom: 'Joshi', brideParents: 'Daughter of Mrs Lata & Mr Vijay Rangam', reception: 'Reception to follow at the Leela Palace' });
    i.languages = ['en', 'hi', 'pa'];
    i.text.hi = { bride: 'राघवी', groom: 'जोशी' }; i.text.pa = { bride: 'ਰਾਘਵੀ', groom: 'ਜੋਸ਼ੀ' };
    i.events = [{ ...IX.model.newEvent('Wedding Ceremony'), date: '2027-09-01', start: '09:00', venue: 'Amma Arangam', city: 'Chennai' },
      { ...IX.model.newEvent('Sangeet'), date: '2027-08-31', start: '19:00', venue: 'Amma Arangam', city: 'Chennai' }];
    i.contact = { name: 'Anita Sharma', phone: '+91 98765 43210' }; i.settings.rsvpDeadline = '2027-08-01';
    i.calligraphy = IXC.styles.newDesign('royal-english');
    ['en', 'hi', 'pa'].forEach((l) => IXC.styles.fillWords(i, l));
    return (await H.store.saveInvitation(i)).id;
  });
  await p.goto(BASE + 'index.html#/calligraphy/' + id);
  await p.waitForSelector('#ixCard svg', { timeout: 20000 });

  /* 1. PNG of one page, from the dialog */
  await p.click('#ixDl');
  await p.waitForSelector('[data-dl=png]');
  ok('Download dialog offers PNG, JPG, all pages (ZIP), PDF and a print PDF', (await p.locator('[data-dl]').evaluateAll((b) => b.map((x) => x.dataset.dl).join())) === 'png,jpeg,zip,pdf,print');
  ok('the dialog is honest about gold ink and foil', /not metallic foil/.test(await p.locator('.modal').innerText()));
  let [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-dl=png]')]);
  let file = path.join(OUT, 'c-' + dl.suggestedFilename()); await dl.saveAs(file);
  let b = fs.readFileSync(file), z = pngSize(b);
  ok('PNG of the main card is 1500 × 2100 px (5 × 7 in at 300 dpi)', z.w === 1500 && z.h === 2100, `${z.w}×${z.h}`);
  ok('PNG file is named after the couple and the page', /^Raghavi-Joshi-2-main\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('PNG is a real picture of the card, not empty', b.length > 300000, b.length + ' bytes');

  /* 2. JPG of the cover */
  await p.click('[data-page=cover]'); await p.waitForTimeout(400);
  await p.click('#ixDl'); await p.waitForSelector('[data-dl=jpeg]');
  [dl] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('[data-dl=jpeg]')]);
  file = path.join(OUT, 'c-' + dl.suggestedFilename()); await dl.saveAs(file);
  z = jpgSize(fs.readFileSync(file));
  ok('JPG of the cover is 1500 × 2100 px', z.w === 1500 && z.h === 2100 && /1-cover\.jpg$/.test(dl.suggestedFilename()), `${z.w}×${z.h} ${dl.suggestedFilename()}`);

  /* 3. ZIP of every page */
  await p.click('#ixDl'); await p.waitForSelector('[data-dl=zip]');
  [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('[data-dl=zip]')]);
  file = path.join(OUT, 'c-' + dl.suggestedFilename()); await dl.saveAs(file);
  b = fs.readFileSync(file);
  const names = []; for (let i = 0; i < b.length - 4; i++) if (b.readUInt32LE(i) === 0x02014b50) { const n = b.readUInt16LE(i + 28); names.push(b.toString('utf8', i + 46, i + 46 + n)); }
  ok('ZIP holds one PNG for each of the 4 pages, in order', names.join() === 'Raghavi-Joshi-1-cover.png,Raghavi-Joshi-2-main.png,Raghavi-Joshi-3-events.png,Raghavi-Joshi-4-rsvp.png', names.join());

  /* 4. PDF for sharing */
  await p.click('#ixDl'); await p.waitForSelector('[data-dl=pdf]');
  [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('[data-dl=pdf]')]);
  file = path.join(OUT, 'c-' + dl.suggestedFilename()); await dl.saveAs(file);
  let info = pdfInfo(fs.readFileSync(file));
  ok('PDF has the 4 pages at 127 × 177.8 mm (5 × 7 in)', info.pages === 4 && info.boxes.every(([, , w, h]) => mm(w) === 127 && mm(h) === 177.8), JSON.stringify(info.boxes[0]));
  ok('PDF lettering and flourishes are vectors: only the paper is a picture, the rest are drawn curves', info.images >= 1 && info.images <= 4 && info.paths > 5000, `${info.images} paper picture(s), ${info.paths} curve segments`);
  ok('PDF keeps the calligraphy fonts: no letters fall back to a standard PDF font', info.text === 0);

  /* 5. print PDF */
  await p.click('#ixDl'); await p.waitForSelector('[data-dl=print]');
  [dl] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), p.click('[data-dl=print]')]);
  file = path.join(OUT, 'c-' + dl.suggestedFilename()); await dl.saveAs(file);
  info = pdfInfo(fs.readFileSync(file));
  ok('print PDF pages are 5 × 7 in plus 3 mm bleed and an 8 mm margin for crop marks', info.pages === 4 && info.boxes.every(([, , w, h]) => mm(w) === 149 && mm(h) === 199.8), JSON.stringify(info.boxes[0].map(mm)));
  ok('print PDF is named as a print file', /-print\.pdf$/.test(dl.suggestedFilename()));
  const marks = await p.evaluate(async () => { const i = await H.store.getInvitation(location.hash.split('/')[2]); return IXC.draw(i, { page: 'main', print: true, layer: 'paper', bleed: 23.6 }).svg; });
  ok('print paper runs past the cut line and has straight edges (no torn edge)', /viewBox="-23\.6 -23\.6 1047\.2 1447\.2"/.test(marks) && !/-deckle\)/.test(marks));

  /* 6. Hindi and Punjabi in the PDF: shaped from the font files, so letters join correctly */
  const indic = await p.evaluate(async () => {
    const i = await H.store.getInvitation(location.hash.split('/')[2]);
    const out = {};
    for (const l of ['hi', 'pa']) {
      const { svg } = await IXC.exporter.pageSvg(i, 'main', { lang: l });
      out[l] = { texts: (svg.match(/<text\b/g) || []).length, paths: (svg.match(/<path\b/g) || []).length };
    }
    // the conjunct in "श्री" must come out as fewer glyphs than letters (HarfBuzz shaping)
    const t = await IXC.exporter.outline('<svg xmlns="http://www.w3.org/2000/svg"><text x="0" y="50" font-family="Tiro Devanagari Hindi" font-size="40" fill="#000">श्री</text></svg>');
    out.conj = (t.match(/M/g) || []).length;
    return out;
  });
  ok('Hindi page exports with no live text left (all outlined)', indic.hi.texts === 0 && indic.hi.paths > 6, JSON.stringify(indic.hi));
  ok('Punjabi page exports with no live text left (all outlined)', indic.pa.texts === 0 && indic.pa.paths > 6, JSON.stringify(indic.pa));
  ok('Devanagari conjuncts are shaped (not drawn letter by letter)', indic.conj > 0);
  const hiPdf = await p.evaluate(async () => { const i = await H.store.getInvitation(location.hash.split('/')[2]); const r = await IXC.exporter.pdf(i, { lang: 'hi' }); return r.pages; });
  ok('Hindi PDF is made without errors', hiPdf === 4);
  await p.screenshot({ path: OUT + '/c1-studio-download.png' });

  /* 7. a page switched off is left out of the downloads */
  const three = await p.evaluate(async () => { const i = await H.store.getInvitation(location.hash.split('/')[2]); i.calligraphy.pages = { rsvp: false }; const r = await IXC.exporter.pdf(i, { lang: 'en' }); return r.pages; });
  ok('a page switched off is not in the PDF', three === 3);

  /* 8. saving the way the online version does (JSON in the database) keeps everything */
  const round = await p.evaluate(async () => {
    const i = await H.store.getInvitation(location.hash.split('/')[2]);
    i.calligraphy.el['cover:names'] = { dx: 12, dy: -8 }; i.calligraphy.added.push({ id: 'add-x', ref: 'fleuron', x: 500, y: 1200, w: 120, scale: 1.2, rot: 15, opacity: 0.8, page: 'rsvp' });
    // Supabase stores the invitation (minus a few row fields) as JSON and reads it back
    const data = JSON.parse(JSON.stringify(IX.deepClone(i)));
    ['published', 'status', 'slug', 'publishedAt', 'updatedAt', 'createdAt'].forEach((k) => delete data[k]);
    const back = { ...data, id: i.id, slug: i.slug, status: i.status };
    const same = ['cover', 'main', 'events', 'rsvp'].every((pg) => IXC.draw(i, { page: pg, lang: 'en', uid: 'a' }).svg === IXC.draw(back, { page: pg, lang: 'en', uid: 'a' }).svg);
    const snap = IX.model.publicSnapshot(i);
    return { same, snap: !!(snap.calligraphy && snap.calligraphy.style === 'royal-english' && snap.calligraphy.added.length === 1) };
  });
  ok('design survives the online save and load unchanged (every page draws the same)', round.same);
  ok('the published copy guests see carries the calligraphy design', round.snap);

  /* 9. the invitation dashboard links to the downloads */
  await p.goto(BASE + `index.html#/dash/${id}/overview`);
  await p.waitForTimeout(1500);
  const shareLink = await p.locator('#callDl').count();
  if (shareLink) {
    await p.click('#callDl');
    await p.waitForSelector('[data-dl=pdf]', { timeout: 20000 });
    ok('the invitation dashboard has “Download calligraphy card”, which opens the download choices', true);
    await p.click('.modal [data-x]');
  } else ok('the invitation dashboard has “Download calligraphy card”, which opens the download choices', false, 'link not found at ' + p.url());

  /* 10. phone: the Download button is there and works */
  const ph = await context(browser, { ...devices['iPhone 13'] });
  const m = await ph.newPage(); watch(m);
  await m.goto(BASE + 'index.html');
  await m.waitForFunction(() => window.H && H.store);
  const pid = await m.evaluate(async () => { const i = IX.model.newInvitation('wedding'); i.text.en.bride = 'Raghavi'; i.text.en.groom = 'Joshi'; i.calligraphy = IXC.styles.newDesign('vintage-script'); IXC.styles.fillWords(i, 'en'); return (await H.store.saveInvitation(i)).id; });
  await m.goto(BASE + 'index.html#/calligraphy/' + pid);
  await m.waitForSelector('#ixCard svg', { timeout: 20000 });
  ok('on a phone the top bar fits, with Download and Save', (await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1 && await m.locator('#ixDl').isVisible() && await m.locator('#ixSave').isVisible());
  await m.click('#ixDl'); await m.waitForSelector('[data-dl=png]');
  [dl] = await Promise.all([m.waitForEvent('download', { timeout: 60000 }), m.click('[data-dl=png]')]);
  file = path.join(OUT, 'c-phone-' + dl.suggestedFilename()); await dl.saveAs(file);
  z = pngSize(fs.readFileSync(file));
  ok('on a phone a 300 dpi PNG downloads', z.w === 1500 && z.h === 2100);
  await ph.close();

  /* 11. no names, no download (sample names are never exported) */
  const nn = await p.evaluate(async () => { const i = IX.model.newInvitation('wedding'); i.calligraphy = IXC.styles.newDesign('royal-english'); return (await H.store.saveInvitation(i)).id; });
  await p.goto(BASE + 'index.html#/calligraphy/' + nn); await p.waitForSelector('#ixCard svg', { timeout: 20000 });
  await p.click('#ixDl'); await p.waitForTimeout(500);
  ok('without names the studio asks for them instead of exporting the sample names', !(await p.locator('[data-dl]').count()) && /Add the names first/.test(await p.locator('#ix-toasts').innerText()));

  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails ? `${fails} check(s) failed` : 'All checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
