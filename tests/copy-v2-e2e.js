/* Writing studio V2 checks: personal inputs, one-tap line changes (Aa menu), proofread, AI tweak with fallback.
 * Serve the repo (python3 -m http.server 8765) and run: node tests/copy-v2-e2e.js [outDir]. Demo/Local mode, AI faked. */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8765/', OUT = process.argv[2] || __dirname + '/e2e-output/copy-v2'; fs.mkdirSync(OUT, { recursive: true });
const res = []; const ok = (t, c, n = '') => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + t + (n ? ' — ' + n : '')); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
  await ctx.route(/js\/config\.js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: "window.INVITEX_CONFIG={SUPABASE_URL:'',SUPABASE_ANON_KEY:'',DEFAULT_TIMEZONE:'Asia/Kolkata'};" }));
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + 'index.html#/new/wedding'); await p.waitForSelector('#nextBtn');
  await p.click('#nextBtn'); await p.waitForSelector('#openStudio');
  await p.fill('#tf-title', 'Aarav & Diya'); await p.fill('#tf-hostName', 'The Sharma Family');
  await p.click('#openStudio'); await p.waitForSelector('#csGen');
  await p.click('.cs-more summary');
  ok('personal touches ask who is inviting, a memory and one key message', await p.locator('#csHost').count() === 1 && await p.locator('#csNote').count() === 1 && await p.locator('#csKey').count() === 1);
  ok('who is inviting starts from the card', (await p.inputValue('#csHost')) === 'The Sharma Family');
  await p.fill('#csHost', 'The Sharma and Kapoor families');
  await p.fill('#csNote', 'Dadi turns 90 the same week');
  await p.fill('#csKey', 'Your blessings are the only gift we ask for');
  await p.click('[data-cslen=detailed]');
  await p.click('#csGen'); await p.waitForSelector('.cs-card');
  const msgs = await p.locator('.cs-card [data-line$=".message"] .cs-text').allInnerTexts();
  ok('memory and key message appear word for word in every detailed version', msgs.every((m) => m.includes('Dadi turns 90 the same week') && m.includes('Your blessings are the only gift we ask for')));
  const all = (await p.locator('.cs-card').allInnerTexts()).join(' ');
  ok('the hosts typed in the studio are used', all.includes('The Sharma and Kapoor families'));
  // Aa menu
  const card = p.locator('.cs-card').nth(0);
  const sub = card.locator('[data-line$=".subtitle"]');
  await sub.locator('[data-act=adj]').click();
  const items = await sub.locator('.cs-adj-menu button').allInnerTexts();
  ok('Aa menu: Shorter, Longer, More emotional, More formal, More personal, Proofread', ['Shorter', 'Longer', 'More emotional', 'More formal', 'More personal', 'Proofread'].every((x) => items.includes(x)), items.join(', '));
  await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: OUT + '/1-menu.png' }).catch(() => {});
  await p.keyboard.press('Escape');
  ok('Esc closes the menu', await sub.locator('.cs-adj-menu[hidden]').count() === 1);
  const before = await sub.locator('.cs-text').innerText();
  await sub.locator('[data-act=adj]').click(); await sub.locator('[data-mode=formal]').click();
  await p.waitForTimeout(300);
  const subNow = p.locator('.cs-card').nth(0).locator('[data-line$=".subtitle"]');
  const after = await subNow.locator('.cs-text').innerText();
  const note = await p.locator('.cs-note').allInnerTexts();
  ok('More formal gives new wording and says what happened', after !== before && note.some((n) => /More formal/.test(n)), before + ' → ' + after);
  await subNow.locator('[data-act=back]').click();
  ok('↶ brings the earlier wording back', (await p.locator('.cs-card').nth(0).locator('[data-line$=".subtitle"] .cs-text').innerText()) === before);
  // shorter message
  const msgLine = () => p.locator('.cs-card').nth(1).locator('[data-line$=".message"]');
  const m0 = await msgLine().locator('.cs-text').innerText();
  await msgLine().locator('[data-act=adj]').click(); await msgLine().locator('[data-mode=shorter]').click(); await p.waitForTimeout(300);
  const m1 = await msgLine().locator('.cs-text').innerText();
  ok('Shorter makes the main message shorter', m1.length < m0.length, m0.length + ' → ' + m1.length);
  // proofread a hand-edited line
  const wl = () => p.locator('.cs-card').nth(2).locator('[data-line$=".welcome"]');
  await wl().locator('[data-act=edit]').click();
  await wl().locator('.cs-text').evaluate((el) => { el.textContent = 'we  are so happy to welcome you .please come  ,and bless the the couple'; });
  await wl().locator('[data-act=edit]').click(); await p.waitForTimeout(200);
  await wl().locator('[data-act=adj]').click(); await wl().locator('[data-mode=proofread]').click(); await p.waitForTimeout(200);
  const pr = await wl().locator('.cs-text').innerText();
  ok('Proofread fixes spacing, punctuation, capitals and doubled words without changing words', pr === 'We are so happy to welcome you. Please come, and bless the couple', pr);
  await wl().locator('[data-act=adj]').click(); await wl().locator('[data-mode=proofread]').click(); await p.waitForTimeout(200);
  ok('Proofread on a clean line says nothing needed fixing', (await p.locator('.cs-note').allInnerTexts()).some((n) => /already reads cleanly/.test(n)));
  // repeated generic word warning
  await wl().locator('[data-act=edit]').click();
  await wl().locator('.cs-text').evaluate((el) => { el.textContent = 'A special day for a special family.'; });
  await wl().locator('[data-act=edit]').click(); await p.waitForTimeout(200);
  ok('warns when a generic word is used twice', /Uses “special” 2 times/.test(await p.locator('.cs-card').nth(2).innerText()));
  // nothing changes on the card until Use
  const cardWelcome = await p.evaluate(async () => { const id = location.hash.split('/')[2]; return (await H.store.getInvitation(id)).text.en.welcome; });
  ok('the card itself is unchanged until “Use”', !/special day/.test(cardWelcome));
  // AI: tweak through the server step when it understands it, built-in otherwise
  await p.evaluate(() => {
    window.__calls = []; window.__echo = true;
    Object.defineProperty(H.store, 'aiWriteAvailable', { value: true, configurable: true });
    H.store.aiWrite = async (o) => {
      window.__calls.push(o);
      if (o.section) return Object.assign({ lines: [o.section === 'message' ? ['Please come, ' + o.facts.names + ' would love it.'] : 'with the blessings of both families, request your company'], left: 20, limit: 30 }, window.__echo && o.tweak ? { tweak: o.tweak } : {});
      const n = o.facts.names, at = (o.facts.events && o.facts.events[0] && o.facts.events[0].venue) || 'the venue';
      const four = [
        { approach: 'warm opening', headline: 'Together, at last', subtitle: 'invite you to the day they marry', welcome: 'We would love you with us as ' + n + ' begin their life together.', message: ['After years of friendship, ' + n + ' are getting married.', 'Please join us at ' + at + '.'], thankyou: 'Thank you for every kindness along the way.' },
        { approach: 'story first', headline: 'A promise, shared', subtitle: 'would be glad of your blessings', welcome: 'Come and stand beside the couple on a happy evening.', message: ['It began with a chance meeting at a cousin\'s mehendi.', 'Celebrate with the family at ' + at + '.'], thankyou: 'Your love means more than we can say.' },
        { approach: 'invitation first', headline: 'You are invited', subtitle: 'request your company at their wedding', welcome: 'A heartfelt welcome to all our loved ones.', message: ['The family asks you to join them for the wedding.', 'An evening of music, food and old friends awaits.'], thankyou: 'With gratitude for your friendship.' },
        { approach: 'date first', headline: 'Mark your calendar', subtitle: 'cannot wait to see you there', welcome: 'Thank you for travelling near and far to be here.', message: ['On the big day the celebrations begin.', 'Find us at ' + at + ' with your dancing shoes.'], thankyou: 'Thank you for being part of our story.' },
      ];
      return { versions: four, provider: 'google', left: 25, limit: 30 };
    };
  });
  await p.click('#csGen'); await p.waitForSelector('.cs-card .cs-src.ai');
  const s2 = () => p.locator('.cs-card').nth(0).locator('[data-line$=".subtitle"]');
  await s2().locator('[data-act=adj]').click(); await s2().locator('[data-mode=formal]').click(); await p.waitForTimeout(300);
  const call = await p.evaluate(() => window.__calls[window.__calls.length - 1]);
  ok('AI version: the change is asked of the AI writer for that line only', call.section === 'subtitle' && call.tweak === 'formal' && !!call.currentText);
  ok('AI tweak is used when the server understood it', (await s2().locator('.cs-text').innerText()).includes('with the blessings of both families'));
  await p.evaluate(() => (window.__echo = false));
  const s3 = () => p.locator('.cs-card').nth(1).locator('[data-line$=".subtitle"]');
  const b3 = await s3().locator('.cs-text').innerText();
  await s3().locator('[data-act=adj]').click(); await s3().locator('[data-mode=emotional]').click(); await p.waitForTimeout(400);
  const a3 = await s3().locator('.cs-text').innerText();
  const t3 = await s3().innerText(); ok('older server step (no tweak support) → built-in writer, labelled honestly', a3 !== b3 && !a3.includes('with the blessings of both families') && /Built-in writer/i.test(t3), t3.replace(/\s+/g, ' '));
  await p.locator('.cs-card').nth(0).screenshot({ path: OUT + '/2-ai-card.png' });
  ok('no page errors', errs.length === 0, errs.join(' | '));
  await b.close();
  const f = res.filter((x) => !x).length; console.log(f ? f + ' failed' : 'all passed'); process.exit(f ? 1 : 0);
})();
