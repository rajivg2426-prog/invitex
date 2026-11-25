/* WhatsApp card format: the card image plus a short line and the RSVP link, in English, Hindi and Punjabi.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/whatsapp-card-e2e.js
 * Forces Demo/Local mode by stubbing js/config.js, so no Supabase project is touched. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/whatsapp-card'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const STUB = "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};";
const setup = async (ctx) => {
  await ctx.route(/wa\.me|calendar\.google|google\.com\/maps/, (r) => r.fulfill({ status: 200, body: 'stub' }));
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
};
(async () => {
  const b = await chromium.launch();
  const errs = [];
  /* ---- desktop host ---- */
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await setup(ctx); ctx.on('page', (p) => p.on('pageerror', (e) => errs.push(e.message)));
  const host = await ctx.newPage();
  await host.goto(BASE + 'index.html'); await host.waitForFunction(() => window.H && H.store);
  await host.evaluate(() => IXSamples.create(H.store));
  const info = await host.evaluate(async () => {
    const all = await H.store.listInvitations();
    const inv = all.find((i) => i.category === 'wedding');
    await H.store.saveGuest({ invitationId: inv.id, name: 'Rakesh Verma', phone: '98765 43210', email: '', allowed: 4 });
    const other = all.find((i) => i.id !== inv.id && i.status === 'published');
    other.shareTemplate = 'Hello {name}, my own long message. {link}'; await H.store.saveInvitation(other);
    return { id: inv.id, slug: inv.slug, other: other.id };
  });
  await host.goto(BASE + `index.html#/dash/${info.id}/share`); await host.waitForSelector('#msgPrev');
  const msg = () => host.inputValue('#msgPrev');
  let m = await msg();
  ok('short style is the default', await host.isChecked('[name=msgStyle][value=card]'));
  ok('English: one classy line, event and date, RSVP link', /^You're warmly invited to celebrate with us\.\n.+ · .+\nRSVP here: https?:\/\/\S+$/.test(m) && m.split('\n').length === 3, m.replace(/\n/g, ' | '));
  ok('general message has no "Dear friend" and no long venue lines', !/Dear|Venue:|Time:/.test(m));
  await host.waitForFunction(() => /^data:image\/jpeg/.test(document.getElementById('waImg').src));
  ok('WhatsApp preview shows the card image', true);
  ok('preview shows the message with the link highlighted', /warmly invited/.test(await host.locator('#waText').innerText()) && (await host.locator('#waText .wa-link').count()) === 1);
  await host.locator('.share-grid > .card').first().screenshot({ path: OUT + '/1-share-en.png' });

  // Desktop has no file sharing: the image is saved and WhatsApp opens with the message.
  const [dl, pop] = await Promise.all([host.waitForEvent('download'), host.waitForEvent('popup'), host.click('#waCard')]);
  ok('desktop: card image downloads as PNG', /\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('desktop: WhatsApp opens with the short message', decodeURIComponent(pop.url()).includes("You're warmly invited") && decodeURIComponent(pop.url()).includes('RSVP here:'), pop.url().slice(0, 90));
  await pop.close();
  ok('host is told how to attach the image', /attach it with the clip button/.test(await host.locator('.toast, [class*=toast]').first().innerText().catch(() => '')));

  await host.click('label:has([name=msgLang][value=hi])'); await host.waitForTimeout(400);
  m = await msg();
  ok('Hindi: short message in Hindi with a Hindi link', /^आप सादर आमंत्रित हैं।\n.+\nयहाँ जवाब दें: \S+lang=hi$/.test(m), m.replace(/\n/g, ' | '));
  await host.locator('.share-grid > .card').first().screenshot({ path: OUT + '/2-share-hi.png' });
  await host.click('label:has([name=msgLang][value=pa])'); await host.waitForTimeout(400);
  m = await msg();
  ok('Punjabi: short message in Punjabi with a Punjabi link, date in Punjabi', /^ਤੁਹਾਨੂੰ ਨਿੱਘਾ ਸੱਦਾ ਹੈ।\n.+ · [\u0A00-\u0A7F]+, \d{1,2} [\u0A00-\u0A7F]+ \d{4}\nਇੱਥੇ ਜਵਾਬ ਦਿਓ: \S+lang=pa$/.test(m), m.replace(/\n/g, ' | '));
  await host.locator('.share-grid > .card').first().screenshot({ path: OUT + '/3-share-pa.png' });

  // Personal invites use the same short style, with the guest's name and own link.
  await host.click('[data-tab=guests]'); await host.waitForSelector('[data-wa]');
  const [p1] = await Promise.all([host.waitForEvent('popup'), host.click('tr:has-text("Rakesh Verma") [data-wa]')]);
  const pm = decodeURIComponent(p1.url()); await p1.close();
  ok('personal Punjabi: name, short line, own link', /ਪਿਆਰੇ Rakesh Verma,/.test(pm) && /ਤੁਹਾਨੂੰ ਨਿੱਘਾ ਸੱਦਾ ਹੈ/.test(pm) && /g=/.test(pm) && pm.startsWith('https://wa.me/919876543210'), pm.slice(0, 120).replace(/\n/g, ' | '));
  ok('guest tab explains the card cannot ride along in a personal link', /send the card from/.test(await host.locator('#tabBody').innerText()));

  // Switch to full details; it is remembered.
  await host.click('[data-tab=share]'); await host.waitForSelector('#msgPrev');
  await host.click('label:has([name=msgLang][value=en])'); await host.waitForTimeout(300);
  await host.click('label:has([name=msgStyle][value=full])'); await host.waitForTimeout(400);
  ok('full details style: the longer message with venue', /We are delighted/.test(await msg()) && /Venue:/.test(await msg()));
  await host.reload(); await host.waitForSelector('#msgPrev');
  ok('message style is remembered', await host.isChecked('[name=msgStyle][value=full]'));
  await host.click('label:has([name=msgStyle][value=card])'); await host.waitForTimeout(300);

  // A host who already wrote a long message keeps it.
  await host.goto(BASE + `index.html#/dash/${info.other}/share`); await host.waitForSelector('#msgPrev');
  ok('existing custom message is kept (full style)', /my own long message/.test(await msg()) && await host.isChecked('[name=msgStyle][value=full]'));

  /* ---- phone: share sheet with the image file and the text ---- */
  const ph = await b.newContext({ ...devices['Pixel 7'] });
  await setup(ph); ph.on('page', (p) => p.on('pageerror', (e) => errs.push(e.message)));
  await ph.addInitScript(() => {
    window.__shared = null;
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = async (d) => { window.__shared = { text: d.text, files: (d.files || []).map((f) => [f.name, f.type, f.size]) }; };
  });
  const q = await ph.newPage();
  await q.goto(BASE + 'index.html'); await q.waitForFunction(() => window.H && H.store);
  const pid = await q.evaluate(async () => { await IXSamples.create(H.store); return (await H.store.listInvitations()).find((i) => i.category === 'wedding').id; });
  await q.goto(BASE + `index.html#/dash/${pid}/share`); await q.waitForSelector('#msgPrev');
  await q.waitForFunction(() => /^data:image/.test(document.getElementById('waImg').src));
  await q.click('#waCard'); await q.waitForFunction(() => window.__shared);
  const sh = await q.evaluate(() => window.__shared);
  ok('phone: share sheet gets the card image and the message together', sh.files.length === 1 && sh.files[0][1] === 'image/png' && sh.files[0][2] > 20000 && /RSVP here:/.test(sh.text), JSON.stringify(sh.files));
  ok('phone: no sideways scrolling', !(await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  const tap = await q.locator('#waCard').boundingBox();
  ok('phone: send button is big enough to tap', tap.height >= 36, 'h=' + tap.height);
  await q.locator('.share-grid > .card').first().screenshot({ path: OUT + '/4-phone.png' });

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const f = res.filter((x) => !x).length; console.log(f ? f + ' failed' : 'all passed'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
