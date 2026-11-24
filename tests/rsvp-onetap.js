/* One-tap RSVP check. Serve the repo (python3 -m http.server 8765) and run: node tests/rsvp-onetap.js
 * Forces Demo/Local mode by stubbing js/config.js, so no Supabase project is touched. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/rsvp-onetap'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 });
  await ctx.route(/wa\.me/, r => r.fulfill({ status: 200, body: 'stub' }));
  await ctx.route(/js\/config\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" }));
  const errs = []; ctx.on('page', p => p.on('pageerror', e => errs.push(e.message)));
  const host = await ctx.newPage(); host.on('pageerror', e => errs.push(e.message));
  await host.goto(BASE + 'index.html'); await host.waitForFunction(() => window.H && H.store);
  await host.evaluate(() => IXSamples.create(H.store));
  const info = await host.evaluate(async () => {
    const list = await H.store.listInvitations();
    const inv = list.find(i => i.category === 'wedding') || list[0];
    inv.contact = { name: 'Sharma family', phone: '+91 98111 22233' }; inv.settings.maxPerInvite = 0; inv.settings.rsvpDeadline = '2027-02-15';
    await H.store.publish(inv);
    await H.store.saveGuest({ invitationId: inv.id, name: 'Rakesh Verma', phone: '98765 43210', email: '', allowed: 4 });
    const g = (await H.store.listGuests(inv.id)).find(x => x.name === 'Rakesh Verma');
    return { id: inv.id, slug: inv.slug, token: g.token };
  });
  const open = async (url) => { const p = await ctx.newPage(); await p.goto(url); await p.waitForSelector('#openBtn, #sec-rsvp'); const ob = p.locator('#openBtn'); if (await ob.count()) await ob.click(); await p.locator('#sec-rsvp').scrollIntoViewIfNeeded(); await p.waitForTimeout(900); return p; };
  // 1. personal link: one tap
  let p = await open(`${BASE}invite.html?i=${info.slug}&g=${info.token}`);
  await p.locator('#rsvpBox').screenshot({ path: OUT + '/1-personal-link.png' });
  const typed = await p.locator('#rsvpForm input:not([type=hidden])').count();
  ok('personal link: greets guest, no name/number boxes', (await p.locator('.ix-who-name').innerText()).includes('Rakesh') && typed === 1, 'visible inputs=' + typed);
  ok('count starts at party size 4', (await p.inputValue('input[name=adults]')) === '4');
  await p.locator('.ix-yes').dblclick(); await p.waitForSelector('#thanks');
  await p.waitForTimeout(500); await p.locator('#rsvpBox').screenshot({ path: OUT + '/2-thanks.png' });
  let rs = await host.evaluate(async id => (await H.store.listRsvps(id)).map(r => [r.name, r.phone, r.status, r.adults + r.children, r.guestId ? 'g' : '-']), info.id);
  ok('one tap saved 1 RSVP with number from guest list', rs.length === 1 && rs[0][1].includes('98765') && rs[0][3] === 4, JSON.stringify(rs));
  // change reply -> decline
  await p.click('#changeBtn'); await p.click('.ix-no'); await p.waitForSelector('#thanks');
  rs = await host.evaluate(async id => (await H.store.listRsvps(id)).map(r => r.status), info.id);
  ok('change reply updates same record', rs.length === 1 && rs[0] === 'no', rs.join());
  await p.close();
  // 2. general link, fresh phone
  await host.evaluate(() => localStorage.clear());
  p = await open(`${BASE}invite.html?i=${info.slug}`);
  await p.locator('#rsvpBox').screenshot({ path: OUT + '/3-general-link.png' });
  ok('general link shows name + mobile (autocomplete tel) + WhatsApp alt', await p.locator('#r-phone[autocomplete=tel]').count() === 1 && await p.locator('.ix-wa-alt a').count() === 1);
  const wa = await p.locator('.ix-wa-alt a').getAttribute('href');
  ok('WhatsApp reply goes to host number', wa.startsWith('https://wa.me/919811122233?text='), decodeURIComponent(wa).slice(0, 80));
  await p.click('.ix-yes'); await p.waitForSelector('#rsvpErr:not([hidden])');
  ok('empty name blocked', /name/i.test(await p.locator('#rsvpErr').innerText()));
  await p.fill('#r-name', 'Pooja Nair'); await p.fill('#r-phone', '9123456780'); await p.click('.ix-yes'); await p.waitForSelector('#thanks');
  await p.close();
  // 3. same phone, next time: remembered
  p = await open(`${BASE}invite.html?i=${info.slug}`);
  ok('returning guest is recognised (one tap)', (await p.locator('.ix-who-name').innerText()).includes('Pooja'));
  await p.click('#notMe'); ok('"Not you?" brings back the boxes', await p.locator('#r-name').count() === 1);
  await p.close();
  // 4. Hindi
  p = await open(`${BASE}invite.html?i=${info.slug}&g=${info.token}&lang=hi`);
  if (await p.locator('[data-lang=hi]').count()) { await p.click('[data-lang=hi]'); await p.waitForTimeout(300); await p.locator('#sec-rsvp').scrollIntoViewIfNeeded(); }
  await p.locator('#rsvpBox').screenshot({ path: OUT + '/4-hindi.png' });
  rs = await host.evaluate(async id => (await H.store.listRsvps(id)).length, info.id);
  ok('2 RSVPs total, no page errors', rs === 2 && !errs.length, errs.join(' | '));
  await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
})().catch(e => { console.log('CRASH', e.message); process.exit(1); });
