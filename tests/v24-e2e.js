/* v2.4 checks: host's own RSVP questions, "Updated" notice, RSVP deep link.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/v24-e2e.js
 * Forces Demo/Local mode by stubbing js/config.js, so no Supabase project is touched. */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/v24'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  await ctx.route(/wa\.me/, r => r.fulfill({ status: 200, body: 'stub' }));
  await ctx.route(/js\/config\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" }));
  const errs = []; ctx.on('page', p => p.on('pageerror', e => errs.push(e.message)));
  const host = await ctx.newPage();
  await host.goto(BASE + 'index.html'); await host.waitForFunction(() => window.H && H.store);
  await host.evaluate(() => IXSamples.create(H.store));
  const info = await host.evaluate(async () => {
    const inv = (await H.store.listInvitations()).find(i => i.category === 'wedding');
    inv.settings.maxPerInvite = 0;
    inv.settings.questions = [
      { id: 'qtravel', label: 'Arriving by?', type: 'choice', options: 'Train, Car, Flight', required: true },
      { id: 'qsong', label: 'Song request', type: 'text', required: false },
    ];
    await H.store.unpublish(inv); // samples come published; start from a first publish
    await H.store.publish(inv);
    return { id: inv.id, slug: inv.slug };
  });

  // 1. deep link skips the opener and lands on the reply form
  let p = await ctx.newPage();
  await p.goto(`${BASE}invite.html?i=${info.slug}#rsvp`); await p.waitForSelector('#sec-rsvp');
  await p.waitForTimeout(800);
  ok('deep link: no opening animation', await p.locator('#opener').count() === 0);
  const top = await p.locator('#sec-rsvp').evaluate(el => el.getBoundingClientRect().top);
  ok('deep link: RSVP section is on screen', top > -50 && top < 300, 'top=' + Math.round(top));
  // 2. required question shown above the buttons, optional one inside "Add details"
  ok('required question visible above buttons', await p.locator('.ix-onetap > .ix-questions select[name=q_qtravel]').isVisible());
  ok('optional question inside Add details', await p.locator('#rsvpMore input[name=q_qsong]').count() === 1);
  await p.fill('#r-name', 'Pooja Nair'); await p.fill('#r-phone', '9123456780');
  await p.click('.ix-yes'); await p.waitForSelector('#rsvpErr:not([hidden])');
  ok('yes without the required answer is blocked', /answer/i.test(await p.locator('#rsvpErr').innerText()), await p.locator('#rsvpErr').innerText());
  await p.locator('#rsvpBox').screenshot({ path: OUT + '/1-questions.png' });
  await p.selectOption('select[name=q_qtravel]', 'Train');
  await p.click('#rsvpMore > summary'); await p.fill('input[name=q_qsong]', 'Kesariya');
  await p.click('.ix-yes'); await p.waitForSelector('#thanks');
  let rs = await host.evaluate(async id => (await H.store.listRsvps(id)).map(r => r.answers), info.id);
  ok('answers saved', rs.length === 1 && rs[0].qtravel === 'Train' && rs[0].qsong === 'Kesariya', JSON.stringify(rs));
  // change reply keeps the answers in the form
  await p.click('#changeBtn');
  ok('changing a reply keeps the answers', (await p.inputValue('select[name=q_qtravel]')) === 'Train' && (await p.inputValue('input[name=q_qsong]')) === 'Kesariya');
  await p.close();
  // a "no" needs no answers
  await host.evaluate(() => localStorage.clear());
  p = await ctx.newPage(); await p.goto(`${BASE}invite.html?i=${info.slug}#rsvp`); await p.waitForSelector('#sec-rsvp');
  await p.fill('#r-name', 'Arjun Rao'); await p.fill('#r-phone', '9000011111'); await p.click('.ix-no'); await p.waitForSelector('#thanks');
  ok('"Can\'t come" needs no answers', (await host.evaluate(async id => (await H.store.listRsvps(id)).length, info.id)) === 2);
  await p.close();

  // 3. no notice on first publish; republish with a note shows it; closing hides it
  p = await ctx.newPage(); await p.goto(`${BASE}invite.html?i=${info.slug}#rsvp`); await p.waitForSelector('#sec-rsvp');
  ok('first publish: no Updated notice', await p.locator('#ixUpdated').count() === 0);
  await p.close();
  await host.evaluate(async id => {
    const inv = await H.store.getInvitation(id);
    inv.events[0].time = '19:30';
    inv.updateNotice = { show: true, note: 'The reception now starts at 7:30 pm' };
    await H.store.publish(inv);
  }, info.id);
  p = await ctx.newPage(); await p.goto(`${BASE}invite.html?i=${info.slug}#rsvp`); await p.waitForSelector('#ixUpdated');
  const txt = await p.locator('#ixUpdated').innerText();
  ok('republish: Updated notice with the host\'s note', /Updated on/.test(txt) && txt.includes('7:30 pm'), txt.replace(/\n/g, ' | '));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/2-updated-notice.png' });
  await p.click('#ixUpdatedX');
  await p.reload(); await p.waitForSelector('#sec-rsvp');
  ok('closed notice stays closed on this phone', await p.locator('#ixUpdated').count() === 0);
  await p.close();
  const note = await host.evaluate(async id => (await H.store.getInvitation(id)).updateNotice, info.id);
  ok('host note is cleared after publishing', note && note.note === '' && note.show === true, JSON.stringify(note));
  // quiet update keeps the earlier notice's date and wording
  const quiet = await host.evaluate(async id => {
    const inv = await H.store.getInvitation(id); const before = inv.published.lastUpdate;
    inv.updateNotice = { show: false, note: '' }; inv.events[0].time = '20:00';
    await H.store.publish(inv); const after = (await H.store.getInvitation(id)).published.lastUpdate;
    return before.at === after.at && before.note === after.note;
  }, info.id);
  ok('quiet update adds no new notice', quiet);
  ok('no unpublished changes right after publishing', await host.evaluate(async id => !H.hasUnpublished(await H.store.getInvitation(id)), info.id));

  // 4. host side: editor shows the questions; dashboard CSV has answer columns; reminders use the deep link
  await host.goto(`${BASE}index.html#/dash/${info.id}/responses`); await host.waitForTimeout(1200);
  ok('dashboard shows the answer', (await host.locator('body').innerText()).includes('Arriving by?: Train'));
  await host.goto(`${BASE}index.html#/edit/${info.id}`); await host.waitForTimeout(1200);
  const last = await host.evaluate(() => document.querySelectorAll('.wz-steps button, [data-goto]').length);
  await host.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Share/.test(x.textContent) && x.closest('nav, .wz-steps, ol, .steps')); if (b) b.click(); });
  await host.waitForTimeout(1000);
  const more = host.locator('details.more-options');
  if (await more.count()) {
    await more.locator('summary').click();
    ok('editor lists the 2 questions', await host.locator('#qList .q-row').count() === 2);
    await host.click('#qAdd'); await host.fill('#qList .q-row:last-child input[data-f=label]', 'Need a hotel room?');
    await host.waitForTimeout(1500);
    const qs = await host.evaluate(async id => (await H.store.getInvitation(id)).settings.questions.map(q => q.label), info.id);
    ok('adding a question in the editor saves it', qs.includes('Need a hotel room?'), qs.join(' / '));
    await host.locator('#qEditor').screenshot({ path: OUT + '/3-editor-questions.png' });
    await host.reload(); await host.waitForTimeout(1200);
    await host.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Share/.test(x.textContent) && x.closest('nav, .wz-steps, ol, .steps')); if (b) b.click(); });
    await host.waitForTimeout(1000);
    await host.locator('.upd-notice').screenshot({ path: OUT + '/4-what-changed.png' }).catch(() => {});
    ok('host sees the "What changed?" box when there are unpublished edits', await host.locator('#updNote').count() === 1);
  } else ok('reached the Share step in the editor', false, 'steps=' + last);
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const pass = res.filter(Boolean).length; console.log(`\n${pass}/${res.length} passed`);
  process.exit(pass === res.length ? 0 : 1);
})();
