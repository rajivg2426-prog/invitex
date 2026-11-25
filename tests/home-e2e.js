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
    return { st: [st.invited, st.yes, st.pending], id: inv.id, title: inv.text.en.title, total: all.length, pub: all.filter(i => i.status === 'published').length, up: all.filter(i => (i.events || []).some(e => e.date && e.date >= today)).length };
  });
  await p.evaluate(() => H.route()); await p.waitForSelector('.hx-card');
  const card = p.locator(`.hx-card[data-id="${info.id}"]`);
  const nums = await card.locator('.hx-nums dd').allInnerTexts();
  ok('card counts match the stored guests and replies', nums[0] === String(info.st[0]) && nums[1].split(' ')[0] === String(info.st[1]) && nums[2] === String(info.st[2]), JSON.stringify(nums) + ' vs ' + JSON.stringify(info.st));
  ok('countdown shown', (await card.locator('.hx-count').innerText()) === 'In 12 days');
  ok('status says Published', (await card.locator('.hx-status').innerText()) === 'Published');
  const act = await p.locator('.hx-act li').allInnerTexts();
  ok('recent activity lists the replies', act.some(t => t.includes('Rakesh Verma') && t.includes('3 people')) && act.some(t => t.includes('Pooja Nair')), act.slice(0, 3).join(' | '));
  const kpi = await p.locator('.hx-tiles dd').allInnerTexts();
  ok('stat tiles: upcoming events, guests invited, people coming, invitations', kpi[1] === '6' && kpi[2] === '3' && kpi[3] === String(info.total), JSON.stringify(kpi));
  ok('left menu jumps to each section', (await p.locator('.hx-rail [data-jump]').count()) === 6);
  ok('RSVP donut with the four answers', (await p.locator('.hx-donut circle').count()) >= 3 && /Confirmed\s*1/.test(await p.locator('.hx-legend').innerText()));
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
  ok('next event card: name, countdown, venue, replies', /Aarav/.test(nx) && /12\s*days to go/.test(nx) && /Mehra Residence/.test(nx) && /2 of 6 invited replied · 3 coming/.test(nx), nx.replace(/\s+/g, ' ').slice(0, 160));
  ok('next event card: Share, Guests and Preview', (await p.locator('.hx-next-act').innerText()).replace(/\s+/g, ' ').trim() === 'Share Guests Preview');
  const todo = p.locator('.hx-todo li', { hasText: 'Aarav' }).first();
  ok('needs attention: pending replies with a reminder action', /4 guests have not replied to Aarav & Diya · in 12 days/.test(await todo.innerText()) && (await todo.locator('a').getAttribute('href')) === `#/dash/${info.id}/guests`, await todo.innerText());
  const rs = await p.locator('.hx-legend b').allInnerTexts(); const ex = await p.locator('.hx-expect b').innerText();
  ok('guests and replies: confirmed, maybe, declined, pending, expected', rs.join(',') + ',' + ex === '1,0,1,4,3', rs.join(',') + ' / ' + ex);
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
  await m.evaluate(() => IXSamples.create(H.store)); await m.evaluate(() => H.route()); await m.waitForSelector('.hx-card');
  const ov = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('phone: no sideways scroll', ov <= 0, 'overflow=' + ov);
  const small = await m.evaluate(() => [...document.querySelectorAll('.hx-actions .btn, .hx-qa, .hx-filters button, .hx-occ, .hx-act-go, .hx-todo .btn, .hx-next .btn')].filter(e => e.getBoundingClientRect().height < 34).map(e => e.className + ':' + e.textContent.trim().slice(0, 12) + ':' + Math.round(e.getBoundingClientRect().height)));
  ok('phone: buttons are big enough to tap', small.length === 0, small.join(' | '));
  await m.screenshot({ path: OUT + '/4-phone.png', fullPage: true });
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const f = res.filter(x => !x).length; console.log(f ? f + ' failed' : 'all passed'); process.exit(f ? 1 : 0);
})();
