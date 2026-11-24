/* V2 guest page, RSVP details, guest list filters and sharing centre.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/guest-v2-e2e.js
 * Forces Demo/Local mode by stubbing js/config.js, so no Supabase project is touched. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/guest-v2'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const STUB = "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 });
  await ctx.route(/wa\.me|calendar\.google|google\.com\/maps/, (r) => r.fulfill({ status: 200, body: 'stub' }));
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: STUB }));
  const errs = []; ctx.on('page', (p) => p.on('pageerror', (e) => errs.push(e.message)));
  const host = await ctx.newPage();
  await host.goto(BASE + 'index.html'); await host.waitForFunction(() => window.H && H.store);
  await host.evaluate(() => IXSamples.create(H.store));
  const info = await host.evaluate(async () => {
    const inv = (await H.store.listInvitations()).find((i) => i.category === 'wedding');
    inv.settings.maxPerInvite = 0;
    await H.store.publish(inv);
    for (const g of [['Rakesh Verma', '98765 43210', 4], ['Kavita Zutshi', '91234 56789', 2], ['Sunil Arora', '99887 76655', 2]]) await H.store.saveGuest({ invitationId: inv.id, name: g[0], phone: g[1], email: '', allowed: g[2] });
    const gs = await H.store.listGuests(inv.id);
    return { id: inv.id, slug: inv.slug, token: gs.find((x) => x.name === 'Rakesh Verma').token, events: inv.events.map((e) => [e.id, e.name]) };
  });
  const rsvps = () => host.evaluate((id) => H.store.listRsvps(id), info.id);
  const open = async (url, c = ctx) => { const p = await c.newPage(); await p.goto(url); await p.waitForSelector('#openBtn, #sec-rsvp'); const ob = p.locator('#openBtn'); if (await ob.count()) { await ob.click(); await p.waitForTimeout(1400); } return p; };

  /* ---- 1. one tap stays one tap; details are optional ---- */
  let p = await open(`${BASE}invite.html?i=${info.slug}&g=${info.token}`);
  await p.locator('#sec-rsvp').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  ok('one tap: details closed, only the count box shows', (await p.locator('#rsvpMore[open]').count()) === 0 && (await p.locator('#rsvpForm input:not([type=hidden]):visible').count()) === 1);
  ok('three clear choices: yes, not sure yet, can\'t come', (await p.locator('[data-status]').count()) === 3 && /Not sure yet/i.test(await p.locator('.ix-maybe').innerText()));
  await p.locator('#rsvpBox').screenshot({ path: OUT + '/1-rsvp-one-tap.png' });
  await p.locator('#rsvpMore summary').click();
  const evBoxes = await p.locator('[name=eventIds]').count();
  ok('details: children, events, food, other names, needs, message', (await p.locator('[name=children]').count()) === 1 && evBoxes === 4 && (await p.locator('#r-food option').count()) === 6 && (await p.locator('#r-extra, #r-req, #r-msg').count()) === 3, 'events=' + evBoxes);
  await p.locator('[data-step=children][data-d="1"]').click();
  await p.locator('[name=eventIds]').nth(1).uncheck();
  await p.selectOption('#r-food', 'veg');
  await p.fill('#r-extra', 'Asha, Kabir');
  await p.fill('#r-req', 'Wheelchair access');
  await p.fill('#r-msg', 'So happy for you both!');
  await p.locator('#rsvpBox').screenshot({ path: OUT + '/2-rsvp-details.png' });
  await p.click('.ix-yes'); await p.waitForSelector('#thanks');
  let r = (await rsvps())[0];
  ok('details saved with the reply (4 coming = 3 adults + 1 child)', r && r.status === 'yes' && r.adults === 3 && r.children === 1 && r.food === 'veg' && r.extraNames === 'Asha, Kabir' && r.requirements === 'Wheelchair access' && r.message === 'So happy for you both!', JSON.stringify(r && [r.adults, r.children, r.food]));
  ok('events: the one unticked is left out', r.eventIds.length === 3 && !r.eventIds.includes(info.events[1][0]));
  const th = await p.locator('#thanks').innerText();
  ok('thank-you shows total with adults / children', /4/.test(th) && /Adults 3/.test(th) && /Children 1/.test(th));
  ok('thank-you offers Save the date and Get directions', (await p.locator('.ix-thanks-links a').count()) === 2);
  ok('thank-you uses a drawn icon, not an emoji', (await p.locator('.ix-thanks-ic svg').count()) === 1 && !/[\u{1F300}-\u{1FAFF}]/u.test(th));
  await p.locator('#rsvpBox').screenshot({ path: OUT + '/3-thanks.png' });

  /* ---- 2. change reply: details come back filled; "not sure yet" keeps the count ---- */
  await p.click('#changeBtn');
  ok('changing the reply reopens details with what was given', (await p.locator('#rsvpMore[open]').count()) === 1 && (await p.inputValue('#r-food')) === 'veg' && (await p.inputValue('[name=children]')) === '1');
  await p.click('.ix-maybe'); await p.waitForSelector('#thanks');
  r = await rsvps();
  ok('"Not sure yet" updates the same reply and keeps the count', r.length === 1 && r[0].status === 'maybe' && r[0].adults + r[0].children === 4 && r[0].food === 'veg');
  await p.close();

  /* ---- 3. floating Reply button (a guest who has not replied) ---- */
  await host.evaluate((slug) => localStorage.removeItem('ivx-rsvp-' + slug), info.slug); // this phone forgets the earlier reply
  const fab = await (async () => {
    const q = await open(`${BASE}invite.html?i=${info.slug}`);
    const at = async () => !(await q.locator('#rsvpFab').isHidden());
    const top = await at();
    await q.locator('#sec-schedule').scrollIntoViewIfNeeded(); await q.waitForTimeout(500);
    const mid = await at();
    await q.screenshot({ path: OUT + '/4-reply-button.png' });
    await q.locator('#rsvpFab').click(); await q.waitForTimeout(1200);
    const atRsvp = await at();
    const inView = await q.evaluate(() => { const r = document.getElementById('sec-rsvp').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
    const overflow = await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await q.close();
    return { top, mid, atRsvp, inView, overflow };
  })();
  ok('Reply button: hidden on the cover, shown while reading, hidden at the reply form', !fab.top && fab.mid && !fab.atRsvp && fab.inView, JSON.stringify(fab));
  ok('guest page has no sideways scrolling on a phone', !fab.overflow);

  /* ---- 4. Hindi labels for the new parts ---- */
  p = await open(`${BASE}invite.html?i=${info.slug}&lang=hi`);
  ok('Hindi: new RSVP labels are in Hindi', /अभी पक्का नहीं/.test(await p.locator('#rsvpBox').innerText()) && /और जानकारी दें/.test(await p.locator('#rsvpMore summary').innerText()));
  await p.close();

  /* ---- 5. host: guest list search and filters ---- */
  await host.goto(BASE + 'index.html#/dash/' + info.id + '/guests'); await host.waitForSelector('#gq');
  const vis = () => host.locator('tr[data-kind]:visible').count();
  ok('guest list: filter chips with counts', /All\s*6/.test(await host.locator('[data-gf=""]').innerText()) && /Replied\s*1/.test(await host.locator('[data-gf=responded]').innerText()) && /Not sent yet\s*5/.test(await host.locator('[data-gf=new]').innerText()));
  await host.click('[data-gf=responded]');
  ok('filter "Replied" shows only Rakesh', (await vis()) === 1 && /Rakesh/.test(await host.locator('tr[data-kind]:visible').innerText()));
  await host.click('[data-gf=""]'); await host.fill('#gq', 'kavita');
  ok('search by name', (await vis()) === 1 && /Kavita/.test(await host.locator('tr[data-kind]:visible').innerText()));
  await host.fill('#gq', '99887');
  ok('search by number', (await vis()) === 1 && /Sunil/.test(await host.locator('tr[data-kind]:visible').innerText()) && /1 of 6 shown/.test(await host.locator('#gCount').innerText()));
  await host.fill('#gq', '');
  await host.screenshot({ path: OUT + '/5-guest-filters.png' });

  /* ---- 6. sharing centre ---- */
  await host.click('[data-tab=share]'); await host.waitForSelector('.sx-status');
  const st = await host.locator('.sx-steps').innerText();
  ok('sharing status: 6 on list, 0 sent, 1 opened, 1 replied', /6\s*On your guest list/.test(st) && /0\s*WhatsApp or email opened/.test(st) && /1\s*Opened their link/.test(st) && /1\s*Replied/.test(st), st.replace(/\s+/g, ' '));
  ok('honest note: never claims "delivered"', /cannot see whether a WhatsApp message was delivered/.test(await host.locator('.sx-status').innerText()));
  ok('message language offers the invitation\'s languages', (await host.locator('[name=msgLang]').count()) === 3);
  await host.click('label:has([name=msgLang][value=hi])'); await host.waitForTimeout(400);
  const msg = await host.inputValue('#msgPrev');
  ok('Hindi message is hand-written Hindi with a Hindi link', /सादर आमंत्रित/.test(msg) && /lang=hi/.test(msg) && /lang%3Dhi|lang=hi/.test(await host.getAttribute('#waAll', 'href')), msg.split('\n').slice(1, 3).join(' / '));
  await host.screenshot({ path: OUT + '/6-sharing-centre.png', fullPage: true });
  await host.reload(); await host.waitForSelector('.sx-status');
  ok('message language is remembered', await host.isChecked('[name=msgLang][value=hi]'));
  await host.click('[data-tab=guests]'); await host.waitForSelector('#tpl', { state: 'attached' });
  ok('personal WhatsApp messages use the same language', /सादर आमंत्रित/.test(await host.inputValue('#tpl')));
  await host.click('[data-tab=share]'); await host.waitForSelector('.sx-status');
  await host.click('label:has([name=msgLang][value=en])'); await host.waitForTimeout(300);
  ok('back to English', /We are delighted/.test(await host.inputValue('#msgPrev')) && !/lang=/.test(await host.inputValue('#lnk')));

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const f = res.filter((x) => !x).length; console.log(f ? f + ' failed' : 'all passed'); process.exit(f ? 1 : 0);
})().catch((e) => { console.error('CRASH', e.message.split('\n')[0]); process.exit(1); });
