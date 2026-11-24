/* Writing studio, end to end in the browser (demo mode, fake AI writer).
 * Forces Demo/Local mode and replaces store.aiWrite with a fake, so no Supabase
 * project or AI key is used. The server step has its own test:
 * node tests/copy-function-test.mjs
 * Run: python3 -m http.server 8765 &  then  node tests/copy-studio-e2e.js */
const { chromium } = require('playwright');
const OUT = process.env.OUT || __dirname + '/e2e-output'; require('fs').mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8765/';
let fails = 0; const errs = [];
const ok = (t, c, n = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.fulfill({ status: 200, body: '' }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text()) && errs.push(m.text()));
  const pvText = () => p.frameLocator('#pvIframe').locator('body').innerText().catch(() => '');
  const field = (k) => p.inputValue('#tf-' + k);
  const cardText = (i) => p.locator('.cs-card').nth(i).innerText();

  /* --- 1. a new invitation gets complete, natural wording straight away --- */
  await p.goto(BASE + 'index.html');
  await p.click('text=Create invitation');
  await p.waitForSelector('[data-cat=wedding]');
  await p.click('#nextBtn'); await p.waitForSelector('#openStudio');
  ok('new invitation starts with wording in every line', (await Promise.all(['familyName', 'subtitle', 'welcome'].map(field))).every((x) => x.trim().length > 3));
  await p.fill('#tf-title', 'Aarav & Diya'); await p.fill('#tf-hostName', 'The Sharma Family');

  /* --- 2. built-in writer (no AI in demo mode) and honest labels --- */
  await p.click('#openStudio'); await p.waitForSelector('#csGen');
  ok('12 styles offered for a wedding', (await p.locator('.cs-style').count()) === 12);
  ok('demo mode says the built-in writer is used', /Built-in writer/.test(await p.locator('#csWho').innerText()));
  await p.click('[data-csstyle=royal]');
  await p.click('#csGen'); await p.waitForSelector('.cs-card');
  ok('4 versions by default', (await p.locator('.cs-card').count()) === 4);
  ok('every card labelled "Built-in writer", none "AI-written"', (await p.locator('.cs-card header .cs-src').allTextContents()).every((t) => t === 'Built-in writer') && !(await p.locator('.cs-src.ai').count()));
  const firstRound = await Promise.all([0, 1, 2, 3].map(cardText));
  ok('names appear in the cards', firstRound.some((t) => t.includes('Aarav & Diya')));
  ok('versions differ from each other', new Set(await p.locator('.cs-card [data-line$=".message"] .cs-text').allTextContents()).size === 4);

  /* --- 3. compare view --- */
  await p.click('[data-csview=compare]');
  ok('compare view shows each line for every version', (await p.locator('.cs-cmp').count()) === 5 && (await p.locator('.cs-cmp').first().locator('.cs-cmp-i').count()) === 4);
  await p.click('[data-csview=cards]');

  /* --- 4. new wording for one line, edit, undo of a line --- */
  const welcomeLine = p.locator('.cs-card').nth(0).locator('[data-line$=".welcome"]');
  const w0 = await welcomeLine.locator('.cs-text').innerText();
  await welcomeLine.locator('[data-act=regen]').click();
  await p.waitForFunction((t) => document.querySelector('.cs-card [data-line$=".welcome"] .cs-text').innerText !== t, w0);
  const w1 = await p.locator('.cs-card').nth(0).locator('[data-line$=".welcome"] .cs-text').innerText();
  ok('↻ gives the line new wording', w1 && w1 !== w0, w1);
  await p.locator('.cs-card').nth(0).locator('[data-line$=".welcome"] [data-act=back]').click();
  ok('↶ brings the previous wording back', (await p.locator('.cs-card').nth(0).locator('[data-line$=".welcome"] .cs-text').innerText()) === w0);
  const sub = p.locator('.cs-card').nth(1).locator('[data-line$=".subtitle"]');
  await sub.locator('[data-act=edit]').click();
  await sub.locator('.cs-text').fill('invite you with all our love');
  await sub.locator('[data-act=edit]').click();
  ok('edited line is labelled "Edited by you"', /Edited by you/.test(await p.locator('.cs-card').nth(1).locator('[data-line$=".subtitle"]').textContent()));

  /* --- 5. preview does not change the card; mix --- */
  await p.locator('.cs-card').nth(1).locator('[data-act=preview]').click();
  await p.waitForTimeout(600);
  ok('preview shows the version on the card', /invite you with all our love/i.test(await pvText()));
  await p.locator('.cs-card').nth(2).locator('[data-line$=".familyName"] [data-act=pick]').click();
  await p.locator('.cs-card').nth(3).locator('[data-line$=".thankyou"] [data-act=pick]').click();
  ok('mix bar lists the picked lines', /Top line: C/.test(await p.locator('.cs-mix').innerText()) && /Thank-you: D/.test(await p.locator('.cs-mix').innerText()));
  const mixTop = await p.locator('.cs-card').nth(2).locator('[data-line$=".familyName"] .cs-text').innerText();
  await p.click('#csMixUse');
  await p.waitForSelector('.cs-done');
  await p.click('#csBack2'); await p.waitForSelector('#tf-familyName');
  ok('mix applied: picked top line is on the card', (await field('familyName')) === mixTop, await field('familyName'));
  ok('mix applied: other lines kept', (await field('hostName')) === 'The Sharma Family');

  /* --- 6. manual edits are never replaced without asking --- */
  await p.fill('#tf-welcome', 'Our own welcome, typed by hand.');
  await p.click('#openStudio'); await p.waitForSelector('.cs-card');
  await p.locator('.cs-card').nth(0).locator('[data-act=use]').click();
  await p.waitForSelector('.modal');
  ok('asks before replacing a hand-written line', /Replace lines you wrote yourself/.test(await p.locator('.modal').innerText()) && /Welcome/.test(await p.locator('.modal-b').innerText()));
  await p.click('.modal-f >> text=Keep my lines');
  await p.click('#csBack2'); await p.waitForSelector('#tf-welcome');
  ok('"Keep my lines" keeps the hand-written welcome', (await field('welcome')) === 'Our own welcome, typed by hand.');
  const topAfterUse = await field('familyName');

  /* --- 7. undo / restore --- */
  await p.click('#undoWording');
  await p.waitForTimeout(200);
  ok('undo brings back the wording from before', (await field('familyName')) === mixTop, await field('familyName'));
  await p.click('#openStudio'); await p.waitForSelector('.cs-hist');
  await p.click('.cs-hist summary');
  ok('earlier wording is listed', (await p.locator('.cs-hist li').count()) >= 2);
  await p.locator('.cs-hist [data-restore]').first().click();
  await p.click('#csBack'); await p.waitForSelector('#tf-familyName');
  ok('restore puts that wording back', (await field('familyName')) === topAfterUse, await field('familyName'));

  /* --- 8. AI writer: honest labels, fallback on failure, daily limit --- */
  await p.evaluate(() => {
    window.__calls = [];
    window.__mode = 'ok';
    Object.defineProperty(H.store, 'aiWriteAvailable', { value: true, configurable: true });
    H.store.aiWrite = async (o) => {
      window.__calls.push(o);
      await new Promise((r) => setTimeout(r, 200));
      if (window.__mode === 'down') throw Object.assign(new Error('down'), { code: 'ai_unavailable' });
      if (window.__mode === 'limit') throw Object.assign(new Error('limit'), { code: 'limit', limit: 30 });
      if (o.section) return { lines: ['A fresh welcome from the AI writer, just for you.'], left: 27, limit: 30 };
      const v = (n) => ({ approach: 'warm opening', headline: 'Together, at last ' + n, subtitle: 'invite you to the day they marry', welcome: 'We would love you with us as ' + o.facts.names + ' begin their life together.', message: ['After years of friendship, ' + o.facts.names + ' are getting married.', 'Please join us at ' + o.facts.events[0].venue + '.'], thankyou: 'Thank you for every kindness along the way.' });
      if (window.__mode === 'bad') return { versions: [Object.assign(v(1), { welcome: 'Dear [Guest], see https://x.y' })], provider: 'google', left: 28, limit: 30 };
      const n = o.facts.names, at = o.facts.events[0].venue;
      const four = [
        { approach: 'warm opening', headline: 'Together, at last', subtitle: 'invite you to the day they marry', welcome: 'We would love you with us as ' + n + ' begin their life together.', message: ['After years of friendship, ' + n + ' are getting married.', 'Please join us at ' + at + '.'], thankyou: 'Thank you for every kindness along the way.' },
        { approach: 'story first', headline: 'A promise, shared', subtitle: 'would be glad of your blessings', welcome: 'Come and stand beside the couple on a happy evening.', message: ['It began with a chance meeting at a cousin\'s mehendi.', 'Celebrate with the family at ' + at + '.'], thankyou: 'Your love means more than we can say.' },
        { approach: 'invitation first', headline: 'You are invited', subtitle: 'request your company at their wedding', welcome: 'A heartfelt welcome to all our loved ones.', message: ['The Sharma Family asks you to join them for the wedding.', 'An evening of music, food and old friends awaits.'], thankyou: 'With gratitude for your friendship.' },
        { approach: 'date first', headline: 'Mark your calendar', subtitle: 'cannot wait to see you there', welcome: 'Thank you for travelling near and far to be here.', message: ['On 12 December the celebrations begin.', 'Find us at ' + at + ' with your dancing shoes.'], thankyou: 'Thank you for being part of our story.' },
      ];
      return { versions: four, provider: 'google', left: 28, limit: 30 };
    };
  });
  await p.click('#openStudio'); await p.waitForSelector('#csGen');
  ok('studio says the AI writer is on', /AI writer on/.test(await p.locator('#csWho').innerText()));
  await p.click('#csGen'); await p.waitForSelector('.cs-card .cs-src.ai');
  ok('AI versions are labelled "AI-written"', (await p.locator('.cs-card header .cs-src').allTextContents()).every((t) => t === 'AI-written'));
  ok('writes left today shown', /28 AI writes left today/.test(await p.locator('#csWho').innerText()));
  const sent = await p.evaluate(() => window.__calls[window.__calls.length - 1]);
  ok('AI request carries no phone, address, map link or guests', !/phone|address|map|guest|rsvp|email/i.test(JSON.stringify(Object.keys(sent.facts))) && sent.facts.names === 'Aarav & Diya');
  ok('earlier, unused wording is sent as "avoid"', Array.isArray(sent.avoid) && sent.avoid.length > 0);
  await p.locator('.cs-card').nth(0).locator('[data-line$=".welcome"] [data-act=regen]').click();
  await p.waitForSelector('.cs-card >> text=A fresh welcome from the AI writer');
  ok('↻ on an AI version asks the AI for that line only', await p.evaluate(() => window.__calls[window.__calls.length - 1].section === 'welcome'));

  await p.evaluate(() => (window.__mode = 'down'));
  await p.click('#csGen'); await p.waitForSelector('text=unavailable right now');
  ok('AI down → built-in versions with an honest notice', /unavailable right now/.test(await p.locator('.cs-note').innerText()) && (await p.locator('.cs-card header .cs-src').allTextContents()).every((t) => t === 'Built-in writer'));
  await p.evaluate(() => (window.__mode = 'bad'));
  await p.click('#csGen'); await p.waitForSelector('text=did not pass our quality checks');
  ok('AI answer that fails checks is not shown as AI', /did not pass our quality checks/.test(await p.locator('.cs-note').innerText()) && !(await p.locator('.cs-card .cs-src.ai').count()));
  await p.evaluate(() => (window.__mode = 'limit'));
  await p.click('#csGen'); await p.waitForSelector('text=used today’s AI writes');
  ok('daily limit → built-in versions and a clear message', /used today’s AI writes/.test(await p.locator('.cs-note').innerText()) && (await p.locator('.cs-card').count()) >= 3);
  await p.screenshot({ path: OUT + '/studio-desktop.png', fullPage: true });

  /* --- 9. Hindi and Punjabi are written natively --- */
  await p.evaluate(() => { delete H.store.aiWrite; Object.defineProperty(H.store, 'aiWriteAvailable', { value: false, configurable: true }); });
  await p.click('#csBack'); await p.waitForSelector('#tf-familyName');
  await p.evaluate(() => { const d = document.querySelector('.more-details'); if (d) d.open = true; });
  for (const l of ['hi', 'pa']) { const c = p.locator(`[data-langtoggle=${l}]`); if (await c.count() && !(await c.isChecked())) await c.check(); }
  await p.waitForTimeout(200);
  await p.click('#openStudio'); await p.waitForSelector('[data-cslang=hi]');
  for (const [l, re] of [['hi', /[ऀ-ॿ]/g], ['pa', /[਀-੿]/g]]) {
    await p.click(`[data-cslang=${l}]`);
    await p.click('#csGen'); await p.waitForSelector('.cs-card');
    const t = (await cardText(0)).split('\n').filter((x) => !/^(A|Top line|Line under the names|Welcome|Main message|Thank-you|Built-in writer|Preview on card|Use this version|Opens with feeling|Invitation first|Personal opening|Starts with your guests|Date first|↻|✎|\+ Mix|👁.*)$/.test(x.trim())).join(' ').replace(/Aarav & Diya|The Sharma Family|Leela Palace|Jaipur|[0-9]/g, '');
    const letters = (t.match(/\p{L}/gu) || []).length;
    ok(`${l}: versions written in ${l === 'hi' ? 'Devanagari' : 'Gurmukhi'}`, (t.match(re) || []).length / letters > 0.85, t.slice(0, 120));
  }

  /* --- 10. phone layout: no sideways scrolling --- */
  await p.setViewportSize({ width: 375, height: 800 });
  await p.click('[data-cslang=en]'); await p.click('#csGen'); await p.waitForSelector('.cs-card');
  await p.locator('.cs-card').nth(0).locator('[data-line$=".message"] [data-act=pick]').click();
  ok('phone: no horizontal overflow', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), String(await p.evaluate(() => document.documentElement.scrollWidth)));
  await p.locator('.cs-card').nth(0).locator('[data-line$=".message"] [data-act=pick]').click(); // clear the mix again
  await p.locator('.cs-card').nth(1).locator('[data-act=select]').click();
  ok('Choose marks one version and shows a "Use" bar', (await p.locator('.cs-card.chosen').count()) === 1 && /Version B chosen/.test(await p.locator('.cs-mix').innerText()));
  ok('phone: the "Use" bar stays on screen', await p.locator('#csSelUse').isVisible() && await p.evaluate(() => { const r = document.querySelector('#csSelUse').getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return r.top >= 0 && r.bottom <= window.innerHeight && document.elementFromPoint(x, y).closest('#csSelUse') !== null; }));
  const chosenTop = (await p.locator('.cs-card').nth(1).locator('[data-line$=".familyName"] .cs-text').textContent()).trim();
  await p.screenshot({ path: OUT + '/studio-mobile-chosen.png' });
  await p.click('#csSelUse');
  if (await p.locator('.modal').count()) await p.click('.modal-f >> text=Replace everything');
  await p.waitForSelector('.cs-done');
  await p.screenshot({ path: OUT + '/studio-mobile.png', fullPage: true });
  await p.click('#csBack2'); await p.waitForSelector('#tf-familyName');
  ok('"Use version B" puts it on the card', (await field('familyName')) === chosenTop, await field('familyName'));
  await p.setViewportSize({ width: 1366, height: 900 });

  /* --- 11. older invitations open unchanged; the guest page never gets studio notes --- */
  const legacy = await p.evaluate(async () => {
    const inv = IX.model.newInvitation('birthday');
    inv.id = 'legacy_' + Date.now(); inv.slug = 'legacy-' + Date.now(); inv.tone = 'fun';
    delete inv.copy;
    Object.assign(inv.text.en, { title: 'Riya turns 5', hostName: 'Mehta family', familyName: 'Old hand-made top line', subtitle: 'old subtitle', welcome: 'old welcome', message: '<p>Old message we wrote ourselves.</p>', thankyou: 'old thanks' });
    await H.store.saveInvitation(inv);
    return { id: inv.id, text: inv.text.en };
  });
  await p.evaluate((id) => H.go('#/edit/' + id + '/2'), legacy.id);
  await p.waitForSelector('#tf-familyName');
  await p.waitForTimeout(300);
  ok('older invitation opens with its own wording untouched', (await field('familyName')) === 'Old hand-made top line' && (await field('welcome')) === 'old welcome');
  await p.click('#openStudio'); await p.waitForSelector('#csGen');
  ok('older invitation: old tone becomes the matching style', await p.evaluate(() => document.querySelector('.cs-style.on').dataset.csstyle) === 'joyful');
  await p.click('#csGen'); await p.waitForSelector('.cs-card');
  await p.locator('.cs-card').nth(0).locator('[data-act=use]').click();
  await p.waitForSelector('.modal');
  ok('older invitation: asks before replacing its hand-made lines', /Top line/.test(await p.locator('.modal-b').innerText()));
  await p.click('.modal-f >> text=Cancel');
  const snap = await p.evaluate(async (id) => {
    const inv = await H.store.getInvitation(id);
    IXStudio.notes(inv);
    const s = IX.model.publicSnapshot(inv);
    return { hasCopy: 'copy' in s, text: s.text.en };
  }, legacy.id);
  ok('guest page snapshot has no studio notes', !snap.hasCopy);
  ok('guest page snapshot keeps the wording', snap.text.familyName === 'Old hand-made top line');

  ok('no page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
  console.log(fails ? `\n${fails} check(s) failed` : '\nAll studio checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
