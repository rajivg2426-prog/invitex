/* Home dashboard check. Serve the repo (python3 -m http.server 8765) and run: node tests/home-e2e.js [outDir]
 * Forces Demo/Local mode by stubbing js/config.js, so no Supabase project is touched. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/home'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
const stub = r => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" });
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
  await ctx.route(/js\/config\.js/, stub);
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + 'index.html'); await p.waitForSelector('.hx-head');
  ok('empty state invites the first invitation', await p.locator('.hx-empty h3').count() === 1);
  ok('one clear Create button', await p.locator('.hx-head >> text=Create new invitation').count() === 1);
  await p.screenshot({ path: OUT + '/0-empty.png' });
  await p.click('#hxList #loadSamples'); await p.waitForSelector('.hx-card');
  // give one sample real guests + replies so the numbers mean something
  const info = await p.evaluate(async () => {
    const list = await H.store.listInvitations();
    const inv = list.find(i => i.category === 'wedding');
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: inv.timezone || 'Asia/Kolkata' }).format(new Date(Date.now() + 12 * 864e5)); // 12 days ahead in the invitation's own time zone
    inv.events[0].date = d; if (!inv.slug) inv.slug = 'home-test-wedding'; await H.store.publish(inv);
    for (const [n, ph] of [['Rakesh Verma', '9876543210'], ['Pooja Nair', '9811122233'], ['Imran Khan', '9822233344']]) await H.store.saveGuest({ invitationId: inv.id, name: n, phone: ph, allowed: 3 });
    const gs = await H.store.listGuests(inv.id);
    await H.store.hostSaveRsvp({ invitationId: inv.id, guestId: gs.find(g => g.name === 'Rakesh Verma').id, name: 'Rakesh Verma', phone: '9876543210', status: 'yes', adults: 3, children: 0, consent: true });
    await H.store.hostSaveRsvp({ invitationId: inv.id, guestId: gs.find(g => g.name === 'Pooja Nair').id, name: 'Pooja Nair', phone: '9811122233', status: 'no', adults: 0, children: 0, consent: true });
    const im = gs.find(g => g.name === 'Imran Khan'); const t0 = new Date(Date.now() - 3600e3).toISOString();
    await H.store.saveGuest({ ...im, sentAt: t0, openedAt: new Date(Date.now() - 600e3).toISOString() }); // Imran was sent the link and opened it, no reply yet
    const st = IX.model.stats(await H.store.listRsvps(inv.id), await H.store.listGuests(inv.id), inv.events);
    const all = await H.store.listInvitations(); const today = new Date().toISOString().slice(0, 10);
    return { st: [st.invited, st.yes, st.pending], date: d, id: inv.id, title: inv.text.en.title, total: all.length, pub: all.filter(i => i.status === 'published').length, up: all.filter(i => (i.events || []).some(e => e.date && e.date >= today)).length };
  });
  await p.evaluate(() => H.route()); await p.waitForSelector('.hx-card');
  const card = p.locator(`.hx-card[data-id="${info.id}"]`);
  const nums = await card.locator('.hx-nums dd').allInnerTexts();
  ok('card counts: guests, replied, people coming (same numbers as everywhere else)', nums[0] === String(info.st[0]) && nums[1] === '2' && nums[2].split(' ')[0] === '3', JSON.stringify(nums) + ' vs ' + JSON.stringify(info.st));
  ok('countdown shown', (await card.locator('.hx-count').innerText()) === 'In 12 days');
  ok('status says Published', (await card.locator('.hx-status').innerText()) === 'Published');
  const act = await p.locator('.hx-act li').allInnerTexts();
  ok('recent activity lists the replies', act.some(t => t.includes('Rakesh Verma') && t.includes('3 people')) && act.some(t => t.includes('Pooja Nair')), act.slice(0, 3).join(' | '));
  const kpi = await p.locator('.hx-tile-v').allInnerTexts();
  ok('stat tiles: response rate, confirmed attendees, pending, expected', kpi.join(',') === '67%,3,1,3', JSON.stringify(kpi));
  ok('response rate explains its base', /2 of 3 who received it replied/.test(await p.locator('.hx-tile').first().innerText()));
  ok('pending tile names the guests not sent yet', /3 not sent yet/.test(await p.locator('.hx-tile').nth(2).innerText()));
  ok('no week-on-week comparison when there is not two weeks of data', await p.locator('.hx-delta').count() === 0);
  const fun = await p.locator('.hx-funnel b').allInnerTexts();
  ok('funnel: guests added → shared → opened → replied', fun.join(',') === '6,3,3,2', fun.join(','));
  ok('left menu jumps to each section', (await p.locator('.hx-rail [data-jump]').count()) === 6);
  ok('RSVP donut with the answers', (await p.locator('.hx-donut circle').count()) >= 3 && /Confirmed\s*1/.test(await p.locator('.hx-legend').innerText()));
  ok('replies by week counts this week\'s replies', /\b2\s*in 8 weeks/.test(await p.locator('.hx-trend-leg').innerText()));
  const cal = p.locator('.hx-cal-card');
  ok('calendar lists the next events', /Mehendi/.test(await cal.locator('.hx-cal-list').innerText()));
  const rep = await p.locator('#hxRep tbody tr').allInnerTexts();
  ok('recent replies table: guest, invitation, people, status', rep.length === 2 && rep.some((t) => /Rakesh Verma/.test(t) && /\b3\b/.test(t) && /Coming/.test(t)), rep.join(' | '));
  await p.fill('#hxRepQ', 'pooja');
  ok('recent replies search', (await p.locator('#hxRep tbody tr').count()) === 1);
  await p.fill('#hxRepQ', '');
  ok('welcome names the next event', (await p.locator('.hx-lead').innerText()).includes('in 12 days'));
  const nx = await p.locator('.hx-next').innerText();
  ok('next event card: name, countdown, venue, reply progress', /Aarav/.test(nx) && /12\s*days to go/.test(nx) && /Mehra Residence/.test(nx) && /Guest replies\s*2 of 3 · 67%/.test(nx) && /3 coming · 1 waiting · 3 not sent yet/.test(nx), nx.replace(/\s+/g, ' ').slice(0, 260));
  ok('next event card: live countdown to the start time', /^Starts in (12 days|11 days) \d+ h$/.test(await p.locator('.hx-live').innerText()), await p.locator('.hx-live').innerText());
  ok('next event card: directions link (no map embed)', /google\.com\/maps\/dir/.test(await p.locator('.hx-next .hx-dir').getAttribute('href')) && await p.locator('.hx-next iframe').count() === 0);
  ok('next event card: Edit, Share, Preview, Guests', (await p.locator('.hx-next-act').innerText()).replace(/\s+/g, ' ').trim() === 'Edit Share Preview Guests');
  ok('next event card: progress bar is a progressbar', await p.locator('.hx-next [role=progressbar][aria-valuenow="2"][aria-valuemax="3"]').count() === 1);
  if (info.up > 1) {
    await p.click('.hx-next [data-nx="1"]');
    ok('next event card: step to the following event', /2 of \d+/.test(await p.locator('.hx-next-nav').innerText()) && !/Aarav/.test(await p.locator('.hx-next h3').innerText()));
    await p.click('.hx-next [data-nx="-1"]');
  }
  const todo = p.locator('.hx-todo li', { hasText: 'Aarav' }).first();
  ok('needs attention: pending replies with a reminder action', /1 guest has not replied to Aarav & Diya · in 12 days/.test(await todo.innerText()) && (await todo.locator('a').getAttribute('href')) === `#/dash/${info.id}/guests/pending`, await todo.innerText());
  const rs = await p.locator('.hx-legend b').allInnerTexts(); const ex = await p.locator('.hx-expect b').innerText();
  ok('guests and replies: confirmed, maybe, declined, waiting, not sent, expected', rs.join(',') + ',' + ex === '1,0,1,1,3,3', rs.join(',') + ' / ' + ex);
  // charts open the people behind each number
  await p.click('.hx-legend [data-list=yes]'); await p.waitForSelector('.hx-pl');
  ok('clicking Confirmed lists who is coming', /Confirmed/.test(await p.locator('.modal h2').innerText()) && /Rakesh Verma/.test(await p.locator('.hx-pl-list').innerText()) && (await p.locator('.hx-pl-list li').count()) === 1);
  await p.screenshot({ path: OUT + '/5-confirmed-list.png' });
  await p.click('.hx-pl-list a'); await p.waitForURL(/#\/dash\/.+\/responses\/yes$/); await p.waitForSelector('#flt');
  ok('… and Open goes to that invitation\'s responses, filtered to Attending', (await p.inputValue('#flt')) === 'yes' && await p.locator('.modal').count() === 0);
  await p.goto(BASE + 'index.html#/'); await p.waitForSelector('.hx-card');
  await p.click('.hx-legend [data-list=no]'); await p.waitForSelector('.hx-pl');
  ok('clicking Declined lists who declined', /Pooja Nair/.test(await p.locator('.hx-pl-list').innerText()) && (await p.locator('.hx-pl-list li').count()) === 1);
  await p.keyboard.press('Escape');
  await p.click('.hx-tile[data-list=awaiting]'); await p.waitForSelector('.hx-pl');
  ok('clicking Pending lists who has not replied, with Remind', /Imran Khan/.test(await p.locator('.hx-pl-list').innerText()) && /Opened the link/.test(await p.locator('.hx-pl-list').innerText()) && (await p.locator('.hx-pl-list a').getAttribute('href')) === `#/dash/${info.id}/guests/opened`);
  await p.click('.hx-pl-list a'); await p.waitForSelector('.gfilters');
  ok('… and Remind opens the guest list filtered to them', /Opened, no reply/.test(await p.locator('.gfilters .chip.on').innerText()));
  await p.goto(BASE + 'index.html#/'); await p.waitForSelector('.hx-card');
  await p.locator('.hx-donut circle[data-list=notsent]').dispatchEvent('click'); await p.waitForSelector('.hx-pl');
  ok('clicking the donut itself works too (not sent yet)', (await p.locator('.hx-pl-list li').count()) === 3);
  await p.keyboard.press('Escape');
  await p.click('.hx-wk.now'); await p.waitForSelector('.hx-pl');
  ok('clicking this week\'s bar lists those replies', (await p.locator('.hx-pl-list li').count()) === 2);
  await p.keyboard.press('Escape');
  // scope: one invitation's numbers
  const other = await p.evaluate(async (id) => (await H.store.listInvitations()).find((i) => i.id !== id).id, info.id);
  await p.selectOption('#hxScope', other);
  ok('numbers can be narrowed to one invitation', (await p.locator('.hx-tile-v').allInnerTexts()).join(',') === '–,0,0,0' && (await p.locator('.hx-donut-card .hx-panel-h span').innerText()) !== 'All invitations');
  await p.selectOption('#hxScope', 'all');
  ok('… and back to all invitations', (await p.locator('.hx-tile-v').allInnerTexts()).join(',') === '67%,3,1,3');
  // calendar: click a date to see that day's events
  for (let i = 0; i < 3 && !(await p.locator(`[data-cal="${info.date}"]`).count()); i++) await p.click('.hx-cal-nav[data-calm="1"]');
  await p.click(`[data-cal="${info.date}"]`);
  const day = await p.locator('.hx-cal-card').innerText();
  ok('calendar: clicking a date shows that day\'s events with venue, coming and directions', /1 event/.test(day) && /Mehendi/.test(day) && /3 coming/.test(day) && /Directions/.test(day), day.replace(/\s+/g, ' ').slice(-200));
  await p.screenshot({ path: OUT + '/6-calendar-day.png', clip: await p.locator('.hx-cal-card').boundingBox() });
  const empty = await p.evaluate((d) => { const x = [...document.querySelectorAll('.hx-cal-d:not(.has)')].map((b) => b.dataset.cal).find((k) => k !== d); return x; }, info.date);
  await p.click(`[data-cal="${empty}"]`);
  ok('calendar: a day with nothing says so', /Nothing planned on this day/.test(await p.locator('.hx-cal-list').innerText()));
  await p.click('[data-calclear]');
  ok('calendar: back to upcoming', /Coming up/.test(await p.locator('.hx-cal-sum').innerText()));
  const ev0 = await p.locator('.hx-evs li').first().innerText();
  ok('event-wise tracking: soonest event first with people coming', /Mehendi/.test(ev0) && /\b3\b/.test(ev0) && /In 12 days/.test(ev0), ev0.replace(/\s+/g, ' '));
  const go = await p.locator('.hx-act li', { hasText: 'Rakesh Verma' }).locator('.hx-act-go').getAttribute('href');
  ok('activity: each item has an action (reply → responses)', go === `#/dash/${info.id}/responses`);
  await p.click('[data-actf=open]');
  const op = await p.locator('#hxAct li').allInnerTexts();
  ok('activity filter "Opened": who opened but has not replied, with Remind', op.length === 1 && /Imran Khan opened the invitation but has not replied/.test(op[0]) && /Remind/.test(op[0]), op.join(' | '));
  await p.click('[data-actf=invite]');
  ok('activity filter "Invites": sends are shown honestly', /You invited Imran Khan on WhatsApp or email/.test(await p.locator('#hxAct').innerText()));
  await p.click('[data-actf=all]');
  await p.screenshot({ path: OUT + '/1-desktop.png', fullPage: true });
  // filters
  await p.click('[data-filter=published]');
  ok('Published filter', await p.locator('.hx-card').count() === info.pub, info.pub + ' published');
  await p.click('[data-filter=upcoming]');
  ok('Upcoming filter', await p.locator('.hx-card').count() === info.up && await card.count() === 1, info.up + ' upcoming');
  await p.click('[data-filter=draft]');
  ok('Drafts filter', await p.locator('.hx-card').count() === info.total - info.pub);
  await p.click('[data-filter=all]');
  // search
  await p.fill('#hxSearch', 'summit'); await p.waitForTimeout(250);
  const names = await p.locator('.hx-name').allInnerTexts();
  ok('search narrows the list', names.length === 1 && /summit/i.test(names[0]), names.join());
  await p.fill('#hxSearch', 'zzzz'); await p.waitForTimeout(250);
  ok('no-match message with a way back', await p.locator('#hxClear').count() === 1);
  await p.click('#hxClear');
  // sort by date: the dated, upcoming wedding first
  await p.selectOption('#hxSort', 'date');
  const firstDays = await p.locator('.hx-card').first().locator('.hx-count').innerText().catch(() => '');
  ok('sort by event date puts the soonest first', /^(Today|Tomorrow|In \d+ days)$/.test(firstDays), firstDays);
  // menu: duplicate
  await card.locator('[data-act=menu]').click();
  ok('six quick actions on the card: Edit, Preview, Share, Guests, Analytics, Duplicate', (await card.locator('.hx-actions > .hx-qa').allInnerTexts()).join(',') === 'Edit,Preview,Share,Guests,Analytics,Duplicate');
  ok('More menu opens with Responses and Delete', await card.locator('.hx-menu-list:not([hidden]) >> text=Responses').count() === 1 && await card.locator('.hx-menu-list >> text=Delete').count() === 1);
  await p.screenshot({ path: OUT + '/2-menu.png' });
  await p.keyboard.press('Escape');
  ok('Esc closes the menu', await card.locator('.hx-menu-list[hidden]').count() === 1);
  // preview
  await card.locator('[data-act=preview]').click();
  const fr = p.frameLocator('.hx-pv iframe');
  await fr.locator('.ix-guest').first().waitFor({ timeout: 8000 }).catch(() => {});
  ok('Preview shows the real guest page', (await fr.locator('body').innerText()).includes(info.title.split(' ')[0]));
  await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/3-preview.png' });
  await p.click('.hx-pv [data-pv=desktop]');
  ok('Preview switches to desktop', await p.locator('.hx-pv-frame.desktop').count() === 1);
  await p.keyboard.press('Escape');
  // duplicate
  await card.locator('.hx-actions > [data-act=dup]').click();
  await p.waitForURL(/#\/edit\//);
  const n2 = await p.evaluate(async () => (await H.store.listInvitations()).length);
  ok('Duplicate makes a new draft and opens it', n2 === info.total + 1);
  // quick-create
  await p.goto(BASE + 'index.html#/'); await p.waitForSelector('.hx-occ');
  await p.click('.hx-occ[href="#/new/birthday"]'); await p.waitForURL(/#\/edit\//);
  const cat = await p.evaluate(async () => { const id = location.hash.split('/')[2]; return (await H.store.getInvitation(id)).category; });
  ok('occasion shortcut starts a Birthday card', cat === 'birthday', cat);
  // delete asks first
  await p.goto(BASE + 'index.html#/'); await p.waitForSelector('.hx-card');
  const first = p.locator('.hx-card').first(); const fid = await first.getAttribute('data-id');
  await first.locator('[data-act=menu]').click(); await first.locator('[data-act=del]').click();
  await p.waitForSelector('.modal');
  ok('Delete asks for confirmation', await p.locator('.modal >> text=Delete permanently').count() === 1);
  await p.click('.modal >> text=Delete permanently'); await p.waitForTimeout(400);
  ok('Delete removes it', await p.locator(`.hx-card[data-id="${fid}"]`).count() === 0);
  // phone
  const ph = await b.newContext({ ...devices['Pixel 7'] });
  await ph.route(/js\/config\.js/, stub);
  const m = await ph.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto(BASE + 'index.html'); await m.waitForSelector('.hx-head');
  await m.evaluate(async () => {
    await IXSamples.create(H.store);
    const inv = (await H.store.listInvitations())[0]; // a reply, so the replies table is on the page too
    await H.store.hostSaveRsvp({ invitationId: inv.id, name: 'Kavita Sharma', phone: '9876500000', status: 'yes', adults: 2, children: 1, consent: true });
  });
  await m.evaluate(() => H.route()); await m.waitForSelector('.hx-card');
  const ov = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('phone: no sideways scroll', ov <= 0, 'overflow=' + ov);
  const small = await m.evaluate(() => [...document.querySelectorAll('.hx-actions .btn, .hx-qa, .hx-filters button, .hx-occ, .hx-act-go, .hx-todo .btn, .hx-next .btn')].filter(e => e.getBoundingClientRect().height < 34).map(e => e.className + ':' + e.textContent.trim().slice(0, 12) + ':' + Math.round(e.getBoundingClientRect().height)));
  ok('phone: buttons are big enough to tap', small.length === 0, small.join(' | '));
  ok('phone: menu folds into a Sections button', await m.locator('.hx-rail-tg').isVisible() && !(await m.locator('#hxRailMenu').isVisible()));
  await m.click('.hx-rail-tg');
  ok('phone: Sections opens the menu', await m.locator('#hxRailMenu').isVisible());
  await m.screenshot({ path: OUT + '/7-phone-menu.png' });
  await m.click('#hxRailMenu [href="#hxEvH"]'); await m.waitForTimeout(900);
  const hid = await m.evaluate(() => { const r = document.querySelector('.hx-rail').getBoundingClientRect(), h = document.querySelector('#hxEvH').getBoundingClientRect(); return { rail: Math.round(r.bottom), head: Math.round(h.top) }; });
  ok('phone: menu closes and the section is not hidden behind it', !(await m.locator('#hxRailMenu').isVisible()) && hid.head >= hid.rail, JSON.stringify(hid));
  const fit = await m.evaluate(() => [...document.querySelectorAll('.hx-donut, .hx-trend, .hx-cal-g, .hx-tiles, .hx-funnel, .hx-next')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).map((e) => e.className.baseVal || e.className));
  ok('phone: charts and panels fit the screen', fit.length === 0, fit.join(', '));
  await m.screenshot({ path: OUT + '/4-phone.png', fullPage: true });
  // small phone and a mid-size window
  const sm = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await sm.route(/js\/config\.js/, stub);
  const s = await sm.newPage(); s.on('pageerror', e => errs.push(e.message));
  await s.goto(BASE + 'index.html'); await s.waitForSelector('.hx-head');
  await s.evaluate(() => IXSamples.create(H.store)); await s.evaluate(() => H.route()); await s.waitForSelector('.hx-card');
  ok('360px phone: no sideways scroll', await s.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
  await s.setViewportSize({ width: 1120, height: 800 }); await s.waitForTimeout(200);
  const rw = await s.evaluate(() => Math.round(document.querySelector('.hx-rail').getBoundingClientRect().width));
  ok('mid-size window: menu collapses to icons', rw > 0 && rw <= 70, rw + 'px');
  ok('mid-size window: no sideways scroll', await s.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const f = res.filter(x => !x).length; console.log(f ? f + ' failed' : 'all passed'); process.exit(f ? 1 : 0);
})();
