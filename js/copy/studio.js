/* InviteX Invitation Copy Studio (window.IXStudio).
 *
 * A writing screen inside step 2 of the editor. The host picks the occasion,
 * language, style, length and a few personal touches, then gets 3–5 complete
 * versions of the card's wording (top line, line under the names, welcome, main
 * message, thank-you). They can compare versions line by line, mix lines from
 * different versions, ask for new wording for one line, edit any line, preview a
 * version on the live card, apply it, undo, and restore older wording.
 *
 * Writers: the AI writer (server step, online version only) when it is switched
 * on, otherwise the built-in writer (js/copy/engine.js). Every card says which one
 * actually wrote it. Nothing the host typed is replaced without asking. */
(function () {
  'use strict';
  const C = () => window.IXCopy;
  const FIELD_LABEL = { familyName: 'Top line', subtitle: 'Line under the names', welcome: 'Welcome', message: 'Main message', thankyou: 'Thank-you' };
  const LETTERS = 'ABCDE';
  const APPROACH_LABEL = { heart: 'Opens with feeling', invite: 'Invitation first', story: 'Personal opening', gratitude: 'Starts with your guests', moment: 'Date first' };
  const RELATION_LABEL = { '': 'Not specified', family: 'Family & relatives', friends: 'Friends', colleagues: 'Colleagues', community: 'Community members', mixed: 'A mix of everyone' };
  const TRADITION_LABEL = { '': 'None / not religious', hindu: 'Hindu', sikh: 'Sikh', jain: 'Jain', muslim: 'Muslim', christian: 'Christian' };
  const HISTORY_MAX = 12, REJECT_MAX = 80, SEEN_MAX = 240;
  const sessions = new Map(); // per invitation: versions on screen, busy flags…

  /* ---------- invitation-level studio notes (saved with the draft, ignored by the guest page) ---------- */
  function notes(inv) {
    const c = (inv.copy = inv.copy || {});
    c.v = 1; c.history = c.history || []; c.rejected = c.rejected || []; c.seen = c.seen || []; c.applied = c.applied || {}; c.round = c.round || 0;
    if (!c.style) c.style = inv.tone ? C().styleFromTone(inv.tone, inv.category) : C().defaultStyle(inv.category);
    if (!c.length) c.length = 'standard';
    if (c.count == null) c.count = 4;
    ['relation', 'tradition', 'note'].forEach((k) => { if (c[k] == null) c[k] = ''; });
    return c;
  }
  const txt = (inv, l, k) => (inv.text[l] && inv.text[l][k]) || '';
  const fieldsOf = (inv, l) => Object.fromEntries(C().FIELDS.map((k) => [k, txt(inv, l, k)]));
  const norm = (s) => C().htmlToText(s).replace(/\s+/g, ' ').trim();
  /** Lines the host changed by hand since the studio (or the old style picker) last wrote them. */
  function editedFields(inv, l) {
    const c = notes(inv), applied = (c.applied || {})[l];
    let legacy = null;
    if (!applied && inv.tone && window.IXWording) {
      try { legacy = IXWording.build(inv.category, l, inv.tone, { host: txt(inv, l, 'hostName') || txt(inv, inv.defaultLang, 'hostName'), title: txt(inv, l, 'title') || txt(inv, inv.defaultLang, 'title') }); } catch (e) { legacy = null; }
    }
    return C().FIELDS.filter((k) => {
      const cur = norm(txt(inv, l, k));
      if (!cur) return false;
      const base = applied ? applied[k] : legacy ? legacy[k] : null;
      return base == null || cur !== norm(base);
    });
  }
  function remember(inv, l, label) {
    const c = notes(inv), cur = fieldsOf(inv, l);
    if (!C().FIELDS.some((k) => norm(cur[k]))) return;
    if (c.history[0] && c.history[0].lang === l && C().FIELDS.every((k) => norm(c.history[0].fields[k]) === norm(cur[k]))) return;
    c.history.unshift({ at: new Date().toISOString(), lang: l, label, fields: cur });
    c.history.length = Math.min(c.history.length, HISTORY_MAX);
  }
  /** Write wording into the invitation (one language). Only `keys` are written. */
  function write(inv, l, fields, keys, meta = {}) {
    const c = notes(inv);
    inv.text[l] = inv.text[l] || {};
    keys.forEach((k) => { inv.text[l][k] = k === 'message' ? (window.IX ? IX.sanitizeHTML(fields[k] || '') : fields[k]) : String(fields[k] || ''); });
    c.applied[l] = Object.assign({}, c.applied[l] || fieldsOf(inv, l), Object.fromEntries(keys.map((k) => [k, inv.text[l][k]])));
    if (meta.style) c.style = meta.style;
    c.lastSource = meta.source || c.lastSource || 'builtin';
    c.appliedAt = new Date().toISOString();
  }
  function reject(inv, texts) {
    const c = notes(inv);
    texts.forEach((t) => C().htmlToText(t).split(/(?<=[.!?।])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 12).forEach((s) => { if (!c.rejected.includes(s)) c.rejected.push(s); }));
    if (c.rejected.length > REJECT_MAX) c.rejected.splice(0, c.rejected.length - REJECT_MAX);
  }
  function seen(inv, ids) { const c = notes(inv); ids.forEach((id) => !c.seen.includes(id) && c.seen.push(id)); if (c.seen.length > SEEN_MAX) c.seen.splice(0, c.seen.length - SEEN_MAX); }

  /* ---------- writing (AI first when available, built-in otherwise) ---------- */
  function studioFacts(inv, l) {
    const c = notes(inv);
    return C().factsFrom(inv, l, { names: c.names != null && c.names !== '' ? c.names : undefined, relation: c.relation, tradition: c.tradition, note: c.note });
  }
  // what the AI writer receives: only what writing needs (no phone, address, map link, guests or RSVPs)
  function aiPayload(inv, l, facts, extra = {}) {
    const c = notes(inv);
    return Object.assign({
      category: inv.category, lang: l, style: c.style, length: c.length, count: c.count,
      facts: { names: facts.names, title: facts.title, host: facts.host, relation: facts.relation, tradition: facts.tradition, note: facts.note,
        events: facts.events.map((e) => ({ name: e.name, date: e.date, time: e.time, venue: e.venue, city: e.city })) },
      avoid: c.rejected.slice(-40),
    }, extra);
  }
  const aiOn = (store) => !!(store && store.aiWriteAvailable);

  async function generate(ctx) {
    const { inv, store } = ctx, S = ctx.S, c = notes(inv), l = S.lang;
    const facts = studioFacts(inv, l);
    // what was on screen and not used becomes "do not repeat"
    if (S.versions.length) reject(inv, S.versions.flatMap((v) => C().FIELDS.map((k) => v.fields[k])));
    c.round++;
    S.notice = ''; S.usage = S.usage || null;
    let versions = [], source = 'builtin', notice = '';
    if (aiOn(store)) {
      try {
        const r = await store.aiWrite(aiPayload(inv, l, facts));
        const checked = C().validateAi(r.versions, facts, l);
        versions = checked.versions.slice(0, c.count).map((v, i) => ({ id: 'ai' + c.round + '-' + i, source: 'ai', provider: r.provider || '', approach: v.approach || '', fields: v.fields, used: [], usedBy: {} }));
        if (r.left != null) S.usage = { left: r.left, limit: r.limit };
        if (versions.length) source = 'ai';
        if (!versions.length) notice = 'The AI writer’s answer did not pass our quality checks, so these versions are from InviteX’s built-in writer.';
      } catch (e) {
        notice = e.code === 'limit' ? `You have used today’s AI writes${e.limit ? ' (' + e.limit + ')' : ''}. These versions are from InviteX’s built-in writer; AI writing is available again tomorrow.`
          : e.code === 'auth' ? 'Please sign in again to use the AI writer. These versions are from InviteX’s built-in writer.'
          : 'The AI writer is unavailable right now. These versions are from InviteX’s built-in writer.';
        if (e.code === 'limit') S.usage = { left: 0, limit: e.limit };
      }
    }
    if (versions.length < Math.min(3, c.count)) {
      const b = C().generate({ facts, lang: l, style: c.style, length: c.length, count: c.count - versions.length, seed: `${inv.id}|${c.round}|${l}|${c.style}|${c.length}`, avoidIds: c.seen, rejected: c.rejected });
      b.versions.forEach((v) => seen(inv, v.used));
      versions = versions.concat(b.versions.map((v, i) => ({ ...v, id: 'b' + c.round + '-' + i })));
      if (source === 'ai') notice = 'The AI writer sent fewer good versions than asked, so the built-in writer added the rest. Each card says who wrote it.';
    }
    if (!aiOn(store) && !notice) notice = store && store.aiWriteNote ? store.aiWriteNote : '';
    versions.forEach((v, i) => { v.letter = LETTERS[i]; v.style = c.style; v.length = c.length; v.lang = l; v.lineSource = {}; });
    S.versions = versions; S.notice = notice; S.mix = {}; S.previewing = null; S.selected = '';
  }

  async function regenerateLine(ctx, v, k) {
    const { inv, store } = ctx, S = ctx.S, c = notes(inv), l = S.lang;
    const facts = studioFacts(inv, l);
    reject(inv, [v.fields[k]]);
    v.history = v.history || [];
    v.history.push({ k, text: v.fields[k], source: v.lineSource[k] || v.source });
    let text = '', src = 'builtin';
    if (v.source === 'ai' && aiOn(store)) {
      v.alts = v.alts || {};
      if (!(v.alts[k] || []).length) {
        try {
          const others = Object.fromEntries(C().FIELDS.filter((x) => x !== k).map((x) => [x, C().htmlToText(v.fields[x])]));
          const r = await store.aiWrite(aiPayload(inv, l, facts, { section: k, current: others, count: 3 }));
          v.alts[k] = (r.lines || []).map((t) => C().checkLine(t, k, v, facts, l)).filter((t) => t && norm(t) !== norm(v.fields[k]));
          if (r.left != null) S.usage = { left: r.left, limit: r.limit };
        } catch (e) { v.alts[k] = []; S.lineNotice = 'The AI writer is unavailable right now, so the built-in writer wrote this line.'; }
      }
      if (v.alts[k].length) { text = v.alts[k].shift(); src = 'ai'; }
    }
    if (!text) {
      const r = C().regenerateSection({ facts, lang: l, style: v.style, length: v.length, version: v, section: k, seed: `${inv.id}|${c.round}|${v.id}|${k}|${v.history.length}`, avoidIds: c.seen, rejected: c.rejected, approach: v.approach });
      if (!r) { S.lineNotice = 'No fresh wording is left for this line in this style. Try another style or edit it yourself.'; v.history.pop(); return; }
      text = r.text; seen(inv, r.used); v.usedBy = Object.assign({}, v.usedBy, { [k]: r.used });
    }
    v.fields[k] = text; v.lineSource[k] = src;
  }

  /* ---------- apply ---------- */
  async function apply(ctx, fields, label, source) {
    const { inv, H, S } = ctx, l = S.lang;
    const edited = editedFields(inv, l).filter((k) => norm(fields[k]) !== norm(txt(inv, l, k)));
    let keys = C().FIELDS.slice();
    if (edited.length) {
      const names = edited.map((k) => FIELD_LABEL[k]).join(', ');
      const v = await H.modal({
        title: 'Replace lines you wrote yourself?',
        body: `<p>You changed ${edited.length === 1 ? 'this line' : 'these lines'} by hand: <b>${esc(names)}</b>.</p><p>Choose what to do with ${edited.length === 1 ? 'it' : 'them'}. You can undo either choice.</p>`,
        actions: [{ label: 'Cancel', value: '' }, { label: 'Keep my lines', value: 'keep' }, { label: 'Replace everything', value: 'all', cls: 'primary' }],
      });
      if (!v) return false;
      if (v === 'keep') keys = keys.filter((k) => !edited.includes(k));
    }
    remember(inv, l, 'Before “' + label + '”');
    write(inv, l, fields, keys, { style: S.style, source });
    ctx.changed();
    S.previewing = null; ctx.preview(null);
    S.applied = label;
    return true;
  }
  async function restore(ctx, i) {
    const { inv, S } = ctx, c = notes(inv), h = c.history[i];
    if (!h) return;
    remember(inv, h.lang, 'Before restoring');
    const idx = c.history.indexOf(h); // remember() may have shifted the list
    write(inv, h.lang, h.fields, C().FIELDS, {});
    c.history.splice(idx, 1);
    ctx.changed(); S.previewing = null; ctx.preview(null);
    if (window.IX) IX.toast('Earlier wording restored', 'ok');
  }

  /* ---------- rendering ---------- */
  const esc = (s) => (window.IX ? IX.esc(s) : String(s));
  function srcBadge(v, k) {
    const s = k ? v.lineSource[k] : v.source;
    if (k && (!s || s === v.source)) return '';
    if (s === 'you') return `<span class="cs-src you" title="You edited this line">Edited by you</span>`;
    return s === 'ai' ? `<span class="cs-src ai" title="Written by the AI writer">AI-written</span>` : `<span class="cs-src" title="Written by InviteX's built-in writer">Built-in writer</span>`;
  }
  function lineHtml(v, k, lang) {
    const val = v.fields[k] || '';
    const body = k === 'message' ? IX.sanitizeHTML(val) : esc(val);
    const picked = (S0().mix[k] || '') === v.id;
    return `<div class="cs-line ${picked ? 'picked' : ''}" data-line="${v.id}.${k}">
      <div class="cs-lh"><span>${FIELD_LABEL[k]}</span>${srcBadge(v, k)}
        <span class="cs-tools">
          <button type="button" class="cs-ic" data-act="regen" title="New wording for this line" aria-label="New wording for the ${FIELD_LABEL[k]} in version ${v.letter}">↻</button>
          <button type="button" class="cs-ic" data-act="edit" title="Edit this line" aria-label="Edit the ${FIELD_LABEL[k]} in version ${v.letter}">✎</button>
          ${(v.history || []).some((h) => h.k === k) ? `<button type="button" class="cs-ic" data-act="back" title="Bring back the previous wording" aria-label="Previous wording for the ${FIELD_LABEL[k]}">↶</button>` : ''}
          <button type="button" class="cs-pick" data-act="pick" aria-pressed="${picked}" title="Use this line in your mix">${picked ? '✓ In mix' : '+ Mix'}</button>
        </span></div>
      <div class="cs-text ${k === 'message' ? 'msg' : ''}" lang="${lang}">${body || '<span class="muted">(empty)</span>'}</div></div>`;
  }
  let current = null;
  const S0 = () => current.S;

  function render(ctx) {
    current = ctx;
    const { inv, el, S, langs } = ctx, c = notes(inv), l = S.lang;
    const styles = C().stylesFor(inv.category);
    if (!styles.some((s) => s.id === c.style)) c.style = styles[0].id;
    S.style = c.style;
    const cats = window.IXT ? IXT.CATEGORIES : [];
    const busy = S.busy;
    const repeatWarn = (v) => {
      const r = C().repeatsAcross(v.fields, { ignore: C().ignoreFor(studioFacts(inv, l), l) });
      return r.length ? `<p class="cs-warn">Says “${esc(r[0].phrase)}” in two lines. Try ↻ on one of them.</p>` : '';
    };
    const mixKeys = Object.keys(S.mix).filter((k) => S.mix[k]);
    const histItems = c.history.map((h, i) => `<li><div><b>${esc(h.label)}</b><span class="tiny muted"> · ${esc(langs[h.lang] || h.lang)} · ${new Date(h.at).toLocaleString()}</span>
        <div class="tiny" lang="${h.lang}">${esc((h.fields.familyName || '') + ' · ' + C().htmlToText(h.fields.welcome || '').slice(0, 90))}</div></div>
        <button type="button" class="btn sm" data-restore="${i}">Restore</button></li>`).join('');
    const compare = S.view === 'compare';
    el.innerHTML = `
    <div class="cs" aria-busy="${!!busy}">
      <div class="cs-head">
        <button type="button" class="btn sm ghost" id="csBack">← Back to my card</button>
        <div><h2>Writing studio</h2><p class="tiny muted">Get several fresh versions of all the words on your card, then pick, mix and polish.</p></div>
      </div>
      <div class="card cs-opts">
        <div class="cs-row">
          <div class="field"><label for="csOcc">Occasion</label><select class="input" id="csOcc">${cats.map((x) => `<option value="${x.id}" ${x.id === inv.category ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <div class="field"><span class="lbl">Language</span><div class="seg" role="radiogroup" aria-label="Language">${inv.languages.map((x) => `<button type="button" role="radio" aria-checked="${x === l}" class="${x === l ? 'on' : ''}" data-cslang="${x}" lang="${x}">${esc(langs[x])}</button>`).join('')}</div>
            ${inv.languages.length < 3 ? '<span class="hint">Add हिन्दी or ਪੰਜਾਬੀ under “More details” on your card.</span>' : ''}</div>
        </div>
        <div class="field"><span class="lbl">Writing style</span>
          <div class="cs-styles" role="radiogroup" aria-label="Writing style">${styles.map((s) => `<button type="button" role="radio" aria-checked="${s.id === c.style}" class="cs-style ${s.id === c.style ? 'on' : ''}" data-csstyle="${s.id}"><b>${esc(s.label.en)}</b><small>${esc(s.hint)}${s.recommended ? ' · <em>suits this event</em>' : ''}</small></button>`).join('')}</div></div>
        <div class="cs-row">
          <div class="field"><span class="lbl">Length</span><div class="seg" role="radiogroup" aria-label="Message length">${C().LENGTHS.map((x) => `<button type="button" role="radio" aria-checked="${x.id === c.length}" class="${x.id === c.length ? 'on' : ''}" data-cslen="${x.id}">${x.label} <span class="cs-sub">${x.hint}</span></button>`).join('')}</div></div>
          <div class="field"><label for="csCount">Versions</label><select class="input" id="csCount" style="width:auto">${[3, 4, 5].map((n) => `<option ${n === c.count ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </div>
        <details class="cs-more" ${S.moreOpen ? 'open' : ''}><summary><b>Personal touches</b> <span class="tiny muted">optional – makes the wording yours</span></summary>
          <div class="cs-grid">
            <div class="field"><label for="csNames">Who is being celebrated</label><input class="input" id="csNames" maxlength="90" value="${esc(c.names != null && c.names !== '' ? c.names : studioFacts(inv, l).names)}" placeholder="e.g. Aarav & Diya, Riya, Mr. Verma"></div>
            <div class="field"><label for="csRel">Your guests are mostly</label><select class="input" id="csRel">${Object.entries(RELATION_LABEL).map(([k, v]) => `<option value="${k}" ${k === c.relation ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="field"><label for="csTrad">Religious or cultural tradition</label><select class="input" id="csTrad">${Object.entries(TRADITION_LABEL).map(([k, v]) => `<option value="${k}" ${k === c.tradition ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="hint">Prayers and blessings are only mentioned for the tradition you choose.</span></div>
            <div class="field cs-span"><label for="csNote">Anything special to mention</label><textarea class="input" id="csNote" rows="2" maxlength="220" placeholder="e.g. Dadi turns 90 the same week · our first home in Pune · 25 years at the company">${esc(c.note)}</textarea></div>
          </div>
          <p class="tiny muted">The writer uses only these details plus your card’s names, host, event names, dates, times, venue and city. Phone numbers, addresses, guest lists and replies are never sent.</p>
        </details>
        <div class="row"><button type="button" class="btn primary lg" id="csGen" ${busy ? 'disabled' : ''}>${busy === 'gen' ? '<span class="cs-spin" aria-hidden="true"></span> Writing…' : S.versions.length ? '✦ Write new versions' : '✦ Write ' + c.count + ' versions'}</button>
          <span class="tiny muted" id="csWho">${aiOn(ctx.store) ? `AI writer on${S.usage && S.usage.left != null ? ` · ${S.usage.left} AI writes left today` : ''}` : 'Built-in writer'}</span></div>
      </div>
      ${S.notice ? `<p class="cs-note" role="status">${esc(S.notice)}</p>` : ''}
      ${S.lineNotice ? `<p class="cs-note" role="status">${esc(S.lineNotice)}</p>` : ''}
      ${S.applied ? `<div class="cs-done" role="status"><span>✓ “${esc(S.applied)}” is on your card.</span>${c.history.length ? '<button type="button" class="btn sm" data-restore="0">Undo</button>' : ''}<button type="button" class="btn sm ghost" id="csBack2">Back to my card</button></div>` : ''}
      ${S.versions.length ? `
      <div class="row between cs-vh"><h3 style="margin:0">${S.versions.length} versions</h3>
        <div class="seg" role="radiogroup" aria-label="View"><button type="button" class="${compare ? '' : 'on'}" data-csview="cards" aria-checked="${!compare}" role="radio">Versions</button><button type="button" class="${compare ? 'on' : ''}" data-csview="compare" aria-checked="${compare}" role="radio">Compare line by line</button></div></div>
      ${compare ? `<div class="cs-compare">${C().FIELDS.map((k) => `<section class="cs-cmp"><h4>${FIELD_LABEL[k]}</h4>${S.versions.map((v) => `<div class="cs-cmp-i"><span class="cs-letter">${v.letter}</span>${lineHtml(v, k, l)}</div>`).join('')}</section>`).join('')}</div>`
        : `<div class="cs-versions">${S.versions.map((v) => `<article class="cs-card ${S.previewing === v.id ? 'previewing' : ''} ${S.selected === v.id ? 'chosen' : ''}" data-v="${v.id}">
          <header><span class="cs-letter">${v.letter}</span><span class="cs-ap">${esc(APPROACH_LABEL[v.approach] || 'Version ' + v.letter)}</span>${srcBadge(v)}
            <button type="button" class="cs-choose ${S.selected === v.id ? 'on' : ''}" data-act="select" role="radio" aria-checked="${S.selected === v.id}" aria-label="Choose version ${v.letter}">${S.selected === v.id ? '✓ Chosen' : 'Choose'}</button></header>
          ${C().FIELDS.map((k) => lineHtml(v, k, l)).join('')}
          ${repeatWarn(v)}
          <footer><button type="button" class="btn sm" data-act="preview">${S.previewing === v.id ? '● On the preview' : '👁 Preview on card'}</button><button type="button" class="btn sm primary" data-act="use">✓ Use this version on my card</button></footer>
        </article>`).join('')}</div>`}
      <div class="cs-mix ${mixKeys.length || S.selected ? 'on' : ''}" aria-live="polite">
        ${mixKeys.length ? `<div><b>Your mix</b> <span class="tiny">${C().FIELDS.map((k) => `${FIELD_LABEL[k]}: ${S.mix[k] ? S.versions.find((v) => v.id === S.mix[k]).letter : '<i>from your card</i>'}`).join(' · ')}</span></div>
          <div class="row"><button type="button" class="btn sm" id="csMixPv">👁 Preview mix</button><button type="button" class="btn sm primary" id="csMixUse">Use my mix</button><button type="button" class="btn sm ghost" id="csMixClear">Clear</button></div>`
          : S.selected && S.versions.some((v) => v.id === S.selected) ? `<div><b>Version ${S.versions.find((v) => v.id === S.selected).letter} chosen</b> <span class="tiny muted">Nothing changes on your card until you tap “Use”.</span></div>
          <div class="row"><button type="button" class="btn sm" id="csSelPv">👁 Preview</button><button type="button" class="btn sm primary" id="csSelUse">✓ Use version ${S.versions.find((v) => v.id === S.selected).letter} on my card</button></div>`
          : '<span class="tiny muted">Tap <b>Choose</b> on the version you like best, then <b>Use</b> it. Or tap “+ Mix” on single lines to combine versions.</span>'}
      </div>` : `<div class="cs-empty"><p>Choose a style and tap <b>Write ${c.count} versions</b>. Nothing on your card changes until you choose “Use”.</p></div>`}
      ${c.history.length ? `<details class="card cs-hist"><summary><b>Earlier wording</b> <span class="tiny muted">(${c.history.length}) – restore any previous version</span></summary><ul>${histItems}</ul></details>` : ''}
    </div>`;
    wire(ctx);
  }

  function wire(ctx) {
    const { inv, el, S } = ctx, c = notes(inv);
    const $ = (s) => el.querySelector(s);
    const rerender = () => render(ctx);
    const back = () => { ctx.preview(null); ctx.close(); };
    $('#csBack').onclick = back;
    if ($('#csBack2')) $('#csBack2').onclick = back;
    $('#csOcc').onchange = (e) => { inv.category = e.target.value; c.style = C().defaultStyle(inv.category); ctx.changed(); rerender(); };
    el.querySelectorAll('[data-cslang]').forEach((b) => (b.onclick = () => { S.lang = b.dataset.cslang; S.versions = []; S.mix = {}; S.applied = ''; ctx.preview(null); rerender(); }));
    el.querySelectorAll('[data-csstyle]').forEach((b) => (b.onclick = () => { c.style = b.dataset.csstyle; ctx.changed(); rerender(); }));
    el.querySelectorAll('[data-cslen]').forEach((b) => (b.onclick = () => { c.length = b.dataset.cslen; ctx.changed(); rerender(); }));
    $('#csCount').onchange = (e) => { c.count = +e.target.value; ctx.changed(); rerender(); };
    const md = $('.cs-more'); if (md) md.addEventListener('toggle', () => (S.moreOpen = md.open));
    const keep = (id, key) => { const i = $(id); if (i) i.oninput = () => { c[key] = i.value; ctx.changed(); }; };
    keep('#csNames', 'names'); keep('#csNote', 'note');
    $('#csRel').onchange = (e) => { c.relation = e.target.value; ctx.changed(); };
    $('#csTrad').onchange = (e) => { c.tradition = e.target.value; ctx.changed(); };
    $('#csGen').onclick = async () => {
      S.busy = 'gen'; S.applied = ''; S.lineNotice = ''; rerender();
      try { await generate(ctx); } finally { S.busy = ''; }
      ctx.changed(); rerender();
      const first = el.querySelector('.cs-vh'); if (first && first.scrollIntoView) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    el.querySelectorAll('[data-csview]').forEach((b) => (b.onclick = () => { S.view = b.dataset.csview; rerender(); }));
    el.querySelectorAll('[data-restore]').forEach((b) => (b.onclick = async () => { await restore(ctx, +b.dataset.restore); S.applied = ''; rerender(); }));
    const vOf = (node) => S.versions.find((v) => v.id === (node.closest('[data-v]') || {}).dataset?.v) || null;
    el.querySelectorAll('.cs-card [data-act="preview"]').forEach((b) => (b.onclick = () => {
      const v = vOf(b);
      if (S.previewing === v.id) { S.previewing = null; ctx.preview(null); } else { S.previewing = v.id; ctx.preview(v.fields, S.lang); }
      rerender();
    }));
    el.querySelectorAll('.cs-card [data-act="select"]').forEach((b) => (b.onclick = () => {
      const v = vOf(b); S.selected = S.selected === v.id ? '' : v.id;
      // on a wide screen the preview sits beside the studio; on a phone it would cover it, so only on request
      if (S.selected && window.innerWidth >= 1000) { S.previewing = v.id; ctx.preview(v.fields, S.lang); }
      rerender();
    }));
    const useSel = async () => {
      const v = S.versions.find((x) => x.id === S.selected); if (!v) return;
      if (await apply(ctx, v.fields, 'Version ' + v.letter, v.source)) { S.selected = ''; if (window.IX) IX.toast('Version ' + v.letter + ' is on your card', 'ok'); rerender(); }
    };
    if ($('#csSelUse')) $('#csSelUse').onclick = useSel;
    if ($('#csSelPv')) $('#csSelPv').onclick = () => { const v = S.versions.find((x) => x.id === S.selected); if (v) { S.previewing = v.id; ctx.preview(v.fields, S.lang); rerender(); } };
    el.querySelectorAll('.cs-card [data-act="use"]').forEach((b) => (b.onclick = async () => {
      const v = vOf(b);
      if (await apply(ctx, v.fields, 'Version ' + v.letter, v.source)) { if (window.IX) IX.toast('Version ' + v.letter + ' is on your card', 'ok'); rerender(); }
    }));
    // line tools (cards and compare view)
    el.querySelectorAll('[data-line]').forEach((line) => {
      const [vid, k] = line.dataset.line.split('.');
      const v = S.versions.find((x) => x.id === vid);
      line.querySelectorAll('[data-act]').forEach((b) => (b.onclick = async () => {
        const act = b.dataset.act;
        if (act === 'pick') { S.mix[k] = S.mix[k] === vid ? '' : vid; rerender(); return; }
        if (act === 'regen') {
          S.lineNotice = ''; b.disabled = true; b.classList.add('spin');
          try { await regenerateLine(ctx, v, k); } finally { b.disabled = false; }
          if (S.previewing === v.id) ctx.preview(v.fields, S.lang);
          ctx.changed(); rerender(); return;
        }
        if (act === 'back') {
          const i = (v.history || []).map((h) => h.k).lastIndexOf(k);
          if (i >= 0) { const h = v.history.splice(i, 1)[0]; v.fields[k] = h.text; v.lineSource[k] = h.source; }
          rerender(); return;
        }
        if (act === 'edit') {
          const t = line.querySelector('.cs-text');
          t.contentEditable = 'true'; t.classList.add('editing'); t.focus();
          if (k === 'message') t.innerHTML = IX.sanitizeHTML(v.fields[k]);
          else t.textContent = v.fields[k];
          b.textContent = '✓'; b.title = 'Done editing'; b.setAttribute('aria-label', 'Done editing');
          const done = () => {
            t.contentEditable = 'false';
            const val = k === 'message' ? IX.sanitizeHTML(t.innerHTML) : t.textContent.replace(/\s+/g, ' ').trim();
            if (norm(val) !== norm(v.fields[k])) { v.history = v.history || []; v.history.push({ k, text: v.fields[k], source: v.lineSource[k] || v.source }); v.fields[k] = val; v.lineSource[k] = 'you'; }
            if (S.previewing === v.id) ctx.preview(v.fields, S.lang);
            rerender();
          };
          b.onclick = done;
          t.addEventListener('blur', (e) => { if (!e.relatedTarget || e.relatedTarget !== b) setTimeout(() => { if (t.isConnected && t.contentEditable === 'true') done(); }, 120); });
          t.addEventListener('keydown', (e) => { if (e.key === 'Escape') { t.contentEditable = 'false'; rerender(); } if (e.key === 'Enter' && k !== 'message') { e.preventDefault(); done(); } });
        }
      }));
    });
    const mixFields = () => {
      const f = fieldsOf(inv, S.lang);
      C().FIELDS.forEach((k) => { if (S.mix[k]) f[k] = S.versions.find((v) => v.id === S.mix[k]).fields[k]; });
      return f;
    };
    if ($('#csMixPv')) $('#csMixPv').onclick = () => { S.previewing = 'mix'; ctx.preview(mixFields(), S.lang); rerender(); };
    if ($('#csMixClear')) $('#csMixClear').onclick = () => { S.mix = {}; rerender(); };
    if ($('#csMixUse')) $('#csMixUse').onclick = async () => {
      const f = mixFields(), keys = C().FIELDS.filter((k) => S.mix[k]);
      const src = keys.every((k) => (S.versions.find((v) => v.id === S.mix[k]).lineSource[k] || S.versions.find((v) => v.id === S.mix[k]).source) === 'ai') ? 'ai' : 'builtin';
      // only the picked lines change; the rest of the card stays as it is
      const cur = fieldsOf(inv, S.lang); const next = Object.assign({}, cur, Object.fromEntries(keys.map((k) => [k, f[k]])));
      if (await apply(ctx, next, 'Your mix', src)) { S.mix = {}; if (window.IX) IX.toast('Your mix is on your card', 'ok'); rerender(); }
    };
  }

  /** Open the studio inside `el`. ctx: { inv, lang, langs, H, store, changed(), preview(fields|null, lang), close() } */
  function open(el, ctx) {
    const inv = ctx.inv;
    notes(inv);
    let S = sessions.get(inv.id);
    if (!S) { S = { lang: ctx.lang, versions: [], mix: {}, view: 'cards' }; sessions.set(inv.id, S); }
    if (!inv.languages.includes(S.lang)) { S.lang = ctx.lang; S.versions = []; }
    S.applied = '';
    render(Object.assign({}, ctx, { el, S }));
  }

  /** Wording for a brand-new invitation, a new event type or a newly added language (built-in, recorded as studio wording). */
  function fillDefault(inv, l, opts = {}) {
    const c = notes(inv);
    if (opts.style) c.style = opts.style;
    if (!C().stylesFor(inv.category).some((s) => s.id === c.style)) c.style = C().defaultStyle(inv.category);
    const f = C().defaultWording(inv, l, c.style, { relation: c.relation, tradition: c.tradition, round: opts.round || 0 });
    inv.text[l] = inv.text[l] || {};
    write(inv, l, f, C().FIELDS, { style: c.style, source: 'builtin' });
  }
  /** True when every language's wording is empty or still exactly what was written for it. */
  function untouched(inv) { return inv.languages.every((l) => !editedFields(inv, l).length); }

  window.IXStudio = { open, fillDefault, untouched, editedFields, notes, FIELD_LABEL, _sessions: sessions };
})();
