const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || __dirname + '/e2e-output'; fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8765/';
const results = []; const errs = [];
const ok = (t, cond, note = '') => { results.push([t, !!cond, note]); console.log((cond ? 'PASS ' : 'FAIL ') + t + (note ? ' — ' + note : '')); };
(async () => {
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;
  const browser = await chromium.launch({ proxy });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  // block third-party popups like wa.me/calendar from actually loading
  await ctx.route(/wa\.me|calendar\.google|google\.com\/maps|maps\.google/, r => r.fulfill({ status: 200, body: 'stub' }));
  const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + ' PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/maps|fonts|ERR_|403/.test(m.text())) errs.push(tag + ' ' + m.text()); }); };
  const host = await ctx.newPage(); watch(host, 'host');
  // test images
  await host.goto(BASE + 'index.html');
  const mk = async (name, color, w, h) => { const b64 = await host.evaluate(([c, w, h]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); const g = x.createLinearGradient(0,0,w,h); g.addColorStop(0,c); g.addColorStop(1,'#fff'); x.fillStyle = g; x.fillRect(0,0,w,h); x.fillStyle='#333'; x.font='120px sans-serif'; x.fillText('IMG',w/3,h/2); return cv.toDataURL('image/jpeg', .95).split(',')[1]; }, [color, w, h]); fs.writeFileSync(OUT + '/' + name, Buffer.from(b64, 'base64')); return OUT + '/' + name; };
  const cover = await mk('cover.jpg', '#a33', 2400, 3000), g1 = await mk('g1.jpg', '#3a3', 3000, 2000), g2 = await mk('g2.jpg', '#33a', 1800, 1800);
  fs.writeFileSync(OUT + '/fake.jpg', 'this is not an image');

  /* TEST 1 */
  await host.click('text=Create invitation');
  await host.waitForSelector('.cat-grid');
  await host.click('[data-cat=wedding]');
  await host.click('[data-pal="1"]'); // emerald palette
  await host.click('#nextBtn'); await host.waitForSelector('text=Cover photo');
  await host.setInputFiles('input[data-slot=cover]', cover);
  await host.waitForSelector('#stage'); await host.waitForTimeout(400);
  await host.click('.modal-f >> text=Apply');
  await host.waitForSelector('[data-recrop=cover]');
  await host.setInputFiles('#dzGallery input', [g1, g2]);
  await host.waitForFunction(() => document.querySelectorAll('#dzGallery ~ .thumbs .thumb').length === 2, null, { timeout: 15000 });
  // invalid file
  await host.setInputFiles('#dzHosts input', OUT + '/fake.jpg');
  await host.waitForTimeout(600);
  const toastTxt = await host.locator('#ix-toasts').innerText().catch(() => '');
  ok('TEST 13a: rejects invalid image file', /does not look like a valid/.test(toastTxt), toastTxt.split('\n').pop());
  await host.screenshot({ path: OUT + '/t1-media.png', fullPage: false });
  await host.click('#nextBtn'); await host.waitForSelector('#tf-title');
  await host.fill('#tf-title', 'Kabir & Ananya');
  await host.fill('#tf-subtitle', 'Invite you to celebrate their wedding');
  await host.fill('#tf-hostName', 'The Malhotra & Sethi Families');
  await host.fill('#tf-familyName', 'Together with their families');
  await host.fill('[data-ev="0.name"]', 'Wedding Ceremony');
  await host.fill('[data-ev="0.date"]', '2027-02-14');
  await host.fill('[data-ev="0.start"]', '19:00');
  await host.fill('[data-ev="0.end"]', '23:30');
  await host.fill('[data-ev="0.venue"]', 'The Leela Palace');
  await host.fill('[data-ev="0.address"]', 'Diplomatic Enclave, Chanakyapuri');
  await host.fill('[data-ev="0.city"]', 'New Delhi');
  await host.fill('[data-ev="0.pin"]', '110023');
  await host.click('[data-addev=Reception]');
  await host.fill('[data-ev="1.date"]', '2027-02-15');
  await host.fill('[data-ev="1.start"]', '20:00');
  await host.click('[data-evact="copy.1"]');
  await host.click('#nextBtn'); await host.waitForSelector('#rte');
  await host.click('#rte'); await host.keyboard.type('We joyfully invite you to our wedding.');
  await host.selectOption('#aiStyle', 'royal'); await host.click('#aiGen'); await host.click('#aiIns');
  const msgHtml = await host.locator('#rte').innerHTML();
  ok('TEST 1b: AI assistant inserts without overwriting user text', msgHtml.includes('We joyfully invite you') && /families request the honour/.test(msgHtml));
  await host.click('#nextBtn'); await host.waitForSelector('#secList');
  await host.click('#nextBtn'); await host.waitForSelector('#slug');
  await host.fill('#slug', 'kabir-ananya');
  await host.waitForSelector('text=Available', { timeout: 5000 });
  await host.waitForTimeout(900);
  await host.click('#nextBtn');
  await host.waitForSelector('text=Guests are seeing the latest version', { timeout: 8000 });
  ok('TEST 1: wedding invitation created with photos and published', true);
  await host.screenshot({ path: OUT + '/t1-published.png', fullPage: true });
  const editUrl = host.url();
  const invId = editUrl.split('/')[2] === undefined ? null : editUrl.match(/edit\/([^/]+)/)[1];

  /* TEST 2 */
  const mob = await ctx.newPage(); watch(mob, 'guest');
  await mob.setViewportSize({ width: 390, height: 844 });
  await mob.goto(BASE + 'invite.html?i=kabir-ananya');
  await mob.waitForSelector('#openBtn');
  await mob.screenshot({ path: OUT + '/t2-opener.png' });
  await mob.click('#openBtn'); await mob.waitForTimeout(1500);
  await mob.screenshot({ path: OUT + '/t2-hero.png' });
  const title = await mob.locator('.ix-title').first().innerText();
  const hasEvents = await mob.locator('.ix-event').count();
  const hasGallery = await mob.locator('.ix-gitem').count();
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok('TEST 2: mobile invitation renders (title, 2 events, gallery, no horizontal scroll)', title.includes('Kabir') && hasEvents === 2 && hasGallery === 2 && !overflow, `title=${title} events=${hasEvents} gallery=${hasGallery} overflow=${overflow}`);
  let i = 0; for (const sec of ['message', 'countdown', 'schedule', 'venue', 'gallery', 'rsvp']) { await mob.locator('#sec-' + sec).scrollIntoViewIfNeeded(); await mob.waitForTimeout(1000); await mob.screenshot({ path: OUT + `/t2-${++i}-${sec}.png` }); }
  // lightbox
  await mob.click('[data-lb="0"]'); const lb = await mob.locator('#lightbox:not([hidden]) img').count(); await mob.keyboard.press('Escape');
  ok('TEST 2b: gallery lightbox opens and closes', lb === 1 && await mob.locator('#lightbox').isHidden());

  /* TEST 3 */
  await host.goto(BASE + 'index.html#/dash/' + invId + '/guests'); await host.waitForSelector('#gf');
  await host.fill('#g-n', 'Rakesh Verma'); await host.fill('#g-p', '98765 43210'); await host.fill('#g-a', '4'); await host.click('#gf button[type=submit]');
  await host.waitForSelector('[data-wa]');
  const [wa] = await Promise.all([ctx.waitForEvent('page'), host.click('[data-wa]')]);
  const waUrl = decodeURIComponent(wa.url()); await wa.close();
  const guestLink = (waUrl.match(/http:\/\/localhost\S+/) || [''])[0];
  ok('TEST 3: WhatsApp click-to-chat opens with personalised message', waUrl.startsWith('https://wa.me/919876543210?text=') && waUrl.includes('Dear Rakesh Verma') && waUrl.includes('Kabir & Ananya') && guestLink.includes('&g='), waUrl.slice(0, 120).replace(/\n/g, ' | '));
  await host.waitForSelector('text=WhatsApp/email opened');
  ok('TEST 3b: status shows "WhatsApp opened", not "delivered"', !(await host.content()).match(/delivered on/i));

  /* TEST 4 */
  await mob.goto(guestLink); await mob.waitForSelector('#openBtn');
  const greet = await mob.locator('.ix-op-greet').innerText(); await mob.click('#openBtn');
  await mob.locator('#sec-rsvp').scrollIntoViewIfNeeded();
  ok('TEST 4a: personalised greeting', greet.includes('Rakesh Verma'), greet);
  const prefilled = await mob.inputValue('#r-name');
  await mob.fill('#r-phone', '9876543210'); await mob.check('input[name=status][value=yes]');
  await mob.fill('input[name=adults]', '2'); await mob.click('[data-step=children][data-d="1"]');
  await mob.selectOption('#r-food', 'veg'); await mob.check('input[name=consent]');
  const tot = await mob.locator('#r-total').innerText();
  await mob.locator('.ix-submit').dblclick();
  await mob.waitForSelector('#thanks');
  const ref = await mob.locator('[data-ref]').innerText();
  await mob.screenshot({ path: OUT + '/t4-thanks.png' });
  ok('TEST 4: guest confirms with 3 attendees, gets reference + QR', prefilled === 'Rakesh Verma' && tot === '3' && /^IVX-/.test(ref) && await mob.locator('.ix-qr svg').count() === 1, `ref=${ref}`);

  /* TEST 5 */
  await host.goto(BASE + 'index.html#/dash/' + invId + '/overview'); await host.waitForSelector('.kpi.hl');
  const att = await host.locator('.kpi.hl .v').innerText();
  const respCount = await host.evaluate(async (id) => (await H.store.listRsvps(id)).length, invId);
  ok('TEST 5: dashboard shows 3 confirmed attendees (double-click created 1 record)', att === '3' && respCount === 1, `attendees=${att} records=${respCount}`);
  await host.screenshot({ path: OUT + '/t5-dashboard.png', fullPage: true });

  /* TEST 6 + 13 duplicate */
  await mob.evaluate(() => localStorage.clear());
  await mob.goto(BASE + 'invite.html?i=kabir-ananya'); await mob.click('#openBtn');
  await mob.fill('#r-name', 'Imposter'); await mob.fill('#r-phone', '+91 98765-43210'); await mob.check('input[name=status][value=yes]'); await mob.check('input[name=consent]');
  await mob.click('.ix-submit'); await mob.waitForSelector('#rsvpErr:not([hidden])');
  ok('TEST 13b: duplicate RSVP from same mobile number blocked', /already exists/.test(await mob.locator('#rsvpErr').innerText()));
  await mob.fill('#r-name', 'Pooja Nair'); await mob.fill('#r-phone', '9123456780'); await mob.check('input[name=status][value=no]');
  await mob.click('.ix-submit'); await mob.waitForSelector('#thanks');
  await host.reload(); await host.waitForSelector('.kpi.hl');
  const kp = await host.$$eval('.kpi', els => Object.fromEntries(els.map(e => [e.querySelector('.l').innerText, e.querySelector('.v').innerText])));
  ok('TEST 6: decline recorded, attendees still 3', kp['Declined'] === '1' && kp['Confirmed attendees'] === '3' && kp['Total responses'] === '2', JSON.stringify(kp));

  /* edit via edit link */
  const editLink = await mob.locator('.ix-editlink input').inputValue();
  /* TEST 7 */
  await host.click('[data-tab=responses]'); await host.waitForSelector('#csv');
  const [dl] = await Promise.all([host.waitForEvent('download'), host.click('#csv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8'); fs.writeFileSync(OUT + '/rsvps.csv', csv);
  ok('TEST 7: CSV export contains both responses with BOM & totals', csv.charCodeAt(0) === 0xFEFF && csv.includes('Rakesh Verma') && csv.includes('Pooja Nair') && /Attending,2,1,3/.test(csv) && /Declined,0,0,0/.test(csv), dl.suggestedFilename());

  /* TEST 8 & 9 */
  await mob.goto(BASE + 'invite.html?i=kabir-ananya'); await mob.click('#openBtn');
  const dir = await mob.getAttribute('#directionsBtn', 'href');
  const [mp] = await Promise.all([ctx.waitForEvent('page'), mob.click('#directionsBtn')]); const mpUrl = mp.url(); await mp.close();
  ok('TEST 8: Directions opens Google Maps with venue', mpUrl.startsWith('https://www.google.com/maps/dir/?api=1&destination=') && decodeURIComponent(dir).includes('The Leela Palace'), mpUrl.slice(0, 110));
  const gc = await mob.getAttribute('.ix-event a[href*="calendar.google.com"]', 'href');
  const u = new URL(gc);
  ok('TEST 9: Google Calendar link has correct UTC times + timezone', u.searchParams.get('dates') === '20270214T133000Z/20270214T180000Z' && u.searchParams.get('ctz') === 'Asia/Kolkata' && u.searchParams.get('location').includes('Leela'), u.searchParams.get('dates'));
  const [icsDl] = await Promise.all([mob.waitForEvent('download'), mob.click('[data-ics=all]')]);
  const ics = fs.readFileSync(await icsDl.path(), 'utf8');
  ok('TEST 9b: ICS file with both events', (ics.match(/BEGIN:VEVENT/g) || []).length === 2 && ics.includes('DTSTART:20270214T133000Z') && ics.includes('DTSTART:20270215T143000Z'));

  /* TEST 10 */
  await host.goto(BASE + 'index.html#/edit/' + invId + '/3'); await host.waitForSelector('#tf-title');
  await host.fill('#tf-title', 'Kabir & Ananya – Forever'); await host.fill('[data-ev="0.start"]', '18:30');
  await host.waitForTimeout(1200);
  await mob.reload(); const before = await mob.locator('.ix-title').first().innerText();
  await host.click('[data-step="6"]'); await host.waitForSelector('text=edits that guests cannot see');
  await host.click('#nextBtn'); await host.waitForSelector('text=Guests are seeing the latest version');
await mob.reload(); await mob.waitForSelector('.ix-title'); const after = await mob.locator('.ix-title').first().innerText();
  const tm = await mob.locator('.ix-datebar').innerText();
  ok('TEST 10: edits stay draft until "Update published", then guests see them', !before.includes('Forever') && after.includes('Forever') && /6:30/.test(tm), `before="${before}" after="${after}"`);

  /* edit RSVP via private link */
  await mob.goto(editLink); await mob.click('#openBtn');
  await mob.check('input[name=status][value=maybe]'); await mob.fill('input[name=adults]', '1'); await mob.click('.ix-submit'); await mob.waitForSelector('#thanks');
  const recs = await host.evaluate(async (id) => (await H.store.listRsvps(id)).map(r => r.name + ':' + r.status), invId);
  ok('TEST 13c: guest updates RSVP via private edit link (no duplicate)', recs.length === 2 && recs.includes('Pooja Nair:maybe'), recs.join(','));

  /* TEST 11 */
  await host.goto(BASE + 'index.html#/new'); await host.waitForSelector('.cat-grid');
  await host.click('[data-cat=corporate]'); await host.click('[data-pal="1"]'); await host.click('label:has(input[name=layout][value=landscape])');
  await host.click('[data-step="3"]'); await host.waitForSelector('#tf-title');
  await host.fill('#tf-title', 'Q1 Leadership Offsite'); await host.fill('[data-ev="0.date"]', '2027-03-10'); await host.fill('[data-ev="0.start"]', '10:00'); await host.fill('[data-ev="0.venue"]', 'Taj Lands End'); await host.fill('[data-ev="0.city"]', 'Mumbai');
  await host.click('[data-step="6"]'); await host.fill('#slug', 'q1-offsite'); await host.waitForSelector('text=Available'); await host.waitForTimeout(900);
  await host.click('#nextBtn'); await host.waitForSelector('text=Guests are seeing the latest version');
  const inv2 = host.url().match(/edit\/([^/]+)/)[1];
  const corp = await ctx.newPage(); await corp.goto(BASE + 'invite.html?i=q1-offsite'); await corp.waitForSelector('#main');
  const theme = await corp.evaluate(() => [document.body.className, getComputedStyle(document.documentElement).getPropertyValue('--accent')]);
  await corp.screenshot({ path: OUT + '/t11-corporate.png' });
  ok('TEST 11: second invitation with corporate theme & landscape', theme[0].includes('layout-landscape') && theme[0].includes('motif-geometric'), theme.join(' '));

  /* TEST 12 */
  await host.goto(BASE + 'index.html#/dash/' + inv2 + '/overview'); await host.waitForSelector('.kpi.hl');
  const r2 = await host.evaluate(async ([a, b]) => [(await H.store.listRsvps(a)).length, (await H.store.listRsvps(b)).length, (await H.store.listGuests(b)).length], [invId, inv2]);
  // same phone RSVP on second invitation must be allowed (separate lists)
  await corp.click('#openBtn').catch(() => {});
  await corp.fill('#r-name', 'Rakesh Verma'); await corp.fill('#r-phone', '9876543210'); await corp.check('input[name=status][value=yes]'); await corp.check('input[name=consent]'); await corp.click('.ix-submit'); await corp.waitForSelector('#thanks');
  const r3 = await host.evaluate(async ([a, b]) => [(await H.store.listRsvps(a)).length, (await H.store.listRsvps(b)).length], [invId, inv2]);
  ok('TEST 12: invitations have separate guest lists & RSVP data', r2[0] === 2 && r2[1] === 0 && r2[2] === 0 && r3[0] === 2 && r3[1] === 1, JSON.stringify({ before: r2, after: r3 }));

  /* TEST 13 language switch */
  await mob.goto(BASE + 'invite.html?i=kabir-ananya'); await mob.click('#openBtn');
  await host.goto(BASE + 'index.html#/edit/' + invId + '/3'); await host.waitForSelector('[data-langtoggle=hi]');
  await host.check('[data-langtoggle=hi]'); await host.waitForSelector('[data-lt=hi]'); await host.click('[data-lt=hi]'); await host.fill('#tf-title', 'कबीर और अनन्या'); await host.waitForTimeout(1000);
  await host.click('[data-step="6"]'); await host.click('#nextBtn'); await host.waitForSelector('text=Guests are seeing the latest version');
  await mob.reload(); await mob.click('#openBtn'); await mob.click('[data-lang=hi]'); await mob.waitForTimeout(400);
  const hiTitle = await mob.locator('.ix-title').first().innerText(); const hiBtn = await mob.locator('.ix-submit').innerText();
  await mob.screenshot({ path: OUT + '/t13-hindi.png' });
  await mob.locator('#sec-rsvp').scrollIntoViewIfNeeded(); await mob.waitForTimeout(900); await mob.screenshot({ path: OUT + '/t13-hindi-rsvp.png' });
  ok('TEST 13d: language switch shows Hindi text and labels', hiTitle === 'कबीर और अनन्या' && /उत्तर/.test(hiBtn), hiTitle + ' / ' + hiBtn);

  /* print & image */
  await host.goto(BASE + 'index.html#/dash/' + invId + '/share'); await host.waitForSelector('#dlImg'); await host.waitForTimeout(1500);
  const [img] = await Promise.all([host.waitForEvent('download'), host.click('#dlImg')]);
  fs.copyFileSync(await img.path(), OUT + '/card.png');
  ok('Extra: download invitation image & QR present', fs.statSync(OUT + '/card.png').size > 20000 && await host.locator('#qr svg').count() === 1);
  await host.screenshot({ path: OUT + '/share.png', fullPage: true });
  await host.goto(BASE + 'index.html#/dash/' + invId + '/checkin'); await host.waitForSelector('#cref');
  await host.fill('#cref', 'IVX:kabir-ananya:' + ref); await host.click('#cf button[type=submit]'); await host.waitForSelector('text=Welcome');
  ok('Extra: QR/ref check-in works', true);
  // phone device emulation of host wizard
  const ph = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const pp = await ph.newPage(); watch(pp, 'hostmobile'); await pp.goto(BASE + 'index.html#/new'); await pp.waitForSelector('.cat-grid');
  const ov = await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await pp.screenshot({ path: OUT + '/host-mobile.png' });
  ok('TEST 13e: host wizard usable on phone (no horizontal scroll)', !ov);
  console.log('\nERRORS:\n' + (errs.join('\n') || 'none'));
  fs.writeFileSync(OUT + '/results.json', JSON.stringify({ results, errs }, null, 1));
  await browser.close();
})().catch(async e => { console.error('CRASH', e.message.split('\n')[0]); console.log(errs.join('\n')); process.exit(1); });
