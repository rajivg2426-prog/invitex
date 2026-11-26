/* InviteX Calligraphy Studio – the editor screen (route #/calligraphy/<invitation id>).
 *
 * Left: words, styles, fonts, inks, flourishes, paper.  Centre: the live card.
 * Right: settings for whatever is selected on the card. On phones the left panel
 * becomes a bottom bar with sheets, and the right panel a sheet of its own.
 * Every change redraws the card at once, is saved automatically, and can be undone. */
(function () {
  'use strict';
  const IX = window.IX, H = window.H, esc = IX.esc;
  const IXC = window.IXC;
  const ST = IXC.styles, LIB = IXC.lib, FN = IXC.fonts;
  let S = null;

  const TABS = [['words', '✎', 'Words'], ['style', '❖', 'Style'], ['fonts', 'Aa', 'Fonts'], ['ink', '●', 'Ink'], ['orn', '❦', 'Flourishes'], ['paper', '▭', 'Paper']];
  const INK_ROLES = [['bride', "Bride's name"], ['groom', "Groom's name"], ['initials', 'Decorated initials'], ['heading', 'Heading'], ['main', 'Main message'], ['details', 'Event details'], ['flourish', 'Flourishes'], ['amp', 'The “&”']];
  const LANG_NAME = { en: 'English', hi: 'हिन्दी', pa: 'ਪੰਜਾਬੀ' };
  const base = (id) => IXC.baseOf(id || '');
  // which words each item on the card shows: t:<text key>, e<n>:<event field>, s:deadline, c:<contact field>
  const FIELD_OF = { heading: ['t:heading'], names: ['t:bride', 't:groom'], underNames: ['t:underNames'], parents: ['t:brideParents', 't:groomParents'], message: ['t:message'], when: ['e0:date', 'e0:start'], reception: ['t:reception'],
    venue: ['e0:venue', 'e0:address', 'e0:city'], rsvp: ['t:rsvpNote'], blessing: ['t:blessing'], coverLine: ['t:coverLine'], shortDate: ['e0:date'], city: ['e0:city'], eventsTitle: ['t:eventsTitle'],
    rsvpTitle: ['t:rsvpTitle'], rsvpBy: ['s:deadline'], contact: ['c:name', 'c:phone'], rsvpLink: [], qr: [] };
  const specsOf = (id) => { const b = base(id), m = /^ev(\d+)([nd])$/.exec(b); return m ? (m[2] === 'n' ? [`e${m[1]}:name`] : ['date', 'start', 'venue', 'city'].map((k) => `e${m[1]}:${k}`)) : FIELD_OF[b] || []; };
  const EV_LABEL = { name: 'Event name', date: 'Date', start: 'Time', venue: 'Venue', address: 'Venue address', city: 'Town or city' };
  /** One editable line: label, input type and where its words live. */
  function fieldOf(spec) {
    const [src, k] = spec.split(':'), inv = S.inv;
    if (src === 't') {
      const f = ST.FIELDS.concat(ST.PAGE_FIELDS).find((x) => x.key === k) || { key: k, label: k };
      const pd = (ST.PAGE_DEFAULTS[S.lang] || ST.PAGE_DEFAULTS.en)[k];
      return { ...f, spec, get: () => { const v = (inv.text[S.lang] || {})[k]; return v == null && pd != null ? pd : k === 'message' ? IXC.htmlText(v || '') : v || ''; },
        set: (v) => { inv.text[S.lang] = inv.text[S.lang] || {}; inv.text[S.lang][k] = k === 'message' ? IX.esc(v).replace(/\n/g, '<br>') : v; } };
    }
    if (src === 's') return { spec, key: k, label: 'Reply by', type: 'date', hint: 'Also closes RSVP after this date', get: () => inv.settings.rsvpDeadline || '', set: (v) => { inv.settings.rsvpDeadline = v; } };
    if (src === 'c') return { spec, key: k, label: k === 'name' ? 'Contact name' : 'Contact phone', type: k === 'phone' ? 'tel' : '', get: () => (inv.contact || {})[k] || '', set: (v) => { inv.contact = inv.contact || {}; inv.contact[k] = v; } };
    const n = +src.slice(1), first = ST.FIELDS.find((x) => x.event === k);
    return { spec, key: k, label: n === 0 && first ? first.label : EV_LABEL[k] || k, type: first && first.type, multi: k === 'address',
      get: () => (inv.events[n] || {})[k] || '', set: (v) => { inv.events[n] = inv.events[n] || IX.model.newEvent('Wedding Ceremony'); inv.events[n][k] = v; } };
  }
  function fieldHtml(spec, pre, cls) {
    const f = fieldOf(spec), v = f.get(), id = pre + (/^(t|e0):/.test(spec) ? f.key : spec.replace(/\W/g, '-'));
    const nm = f.key === 'bride' || f.key === 'groom';
    const input = f.multi ? `<textarea class="input" id="${id}" ${cls}="${spec}" rows="${f.key === 'message' ? 4 : 2}" lang="${S.lang}">${esc(v)}</textarea>`
      : `<input class="input" id="${id}" ${cls}="${spec}" type="${f.type || 'text'}" value="${esc(v)}" lang="${f.type ? '' : S.lang}" ${nm ? 'spellcheck="false" autocomplete="off"' : ''}>`;
    return `<div class="field"><label for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
  }
  function wireFields(root, cls) {
    root.querySelectorAll(`[${cls}]`).forEach((inp) => (inp.oninput = () => {
      fieldOf(inp.getAttribute(cls)).set(inp.value);
      changed({ fonts: FN.scriptOf(inp.value) !== 'latn' });
    }));
  }

  /** Turn calligraphy on for an invitation with a style, and open the studio. */
  async function start(inv, styleId) {
    const keep = inv.calligraphy && inv.calligraphy.style === styleId;
    if (!keep) inv.calligraphy = ST.newDesign(styleId);
    inv.calligraphy.active = true;
    if (!['wedding', 'engagement'].includes(inv.category)) inv.category = 'wedding';
    (inv.languages || ['en']).forEach((l) => ST.fillWords(inv, l));
    matchGuestPage(inv);
    const saved = await H.store.saveInvitation(inv);
    H.go('#/calligraphy/' + ((saved && saved.id) || inv.id));
  }
  /** The rest of the guest page (RSVP, map…) takes the paper and ink colours. */
  function matchGuestPage(inv) {
    const c = inv.calligraphy;
    inv.theme = 'minimal-ivory';
    inv.paletteIndex = LIB.lum(c.paper.color) < 0.2 ? 1 : 0;
    inv.design.bgColor = c.paper.color;
    inv.design.textColor = LIB.inkColor(c.inks.main);
    inv.design.accentColor = LIB.inkColor(c.inks.heading);
    const st = ST.STYLE[c.style];
    if (st) inv.design.fonts = { script: (c.el.names && c.el.names.font) || st.type.names.font, head: 'Cormorant Garamond', body: 'Cormorant Garamond' };
  }

  /* ---------------- route ---------------- */
  H.routes.calligraphy = async (v, id, then) => {
    const inv = id && (await H.store.getInvitation(id));
    if (!inv) { H.render('<div class="card"><h2>Invitation not found</h2><a class="btn" href="#/">Back</a></div>'); return; }
    if (!inv.calligraphy) inv.calligraphy = ST.newDesign('royal-english');
    const cal = inv.calligraphy;
    cal.el = cal.el || {}; cal.added = cal.added || []; cal.removed = cal.removed || []; cal.orn = cal.orn || {};
    cal.active = true;
    inv.contact = inv.contact || { name: '', phone: '' }; inv.settings = inv.settings || {};
    S = { inv, lang: inv.defaultLang || 'en', tab: 'words', sel: null, zoom: 1, sheet: false, pageId: 'main', preview: null, hist: { past: [], future: [], last: snap(inv) }, saved: true };
    document.body.classList.add('ixc-on');
    H.cleanup.push(() => { document.body.classList.remove('ixc-on'); window.removeEventListener('keydown', keys); window.removeEventListener('resize', fitZoom); S = null; });
    window.addEventListener('keydown', keys);
    window.addEventListener('resize', fitZoom);
    v.innerHTML = shell();
    const ro = new ResizeObserver(() => fitZoom());
    ro.observe(document.getElementById('ixStage'));
    H.cleanup.push(() => ro.disconnect());
    wireTop();
    renderLeft(); renderRight(); renderPageBar();
    await paint(true);
    fitZoom();
    if (then === 'download') { history.replaceState(null, '', '#/calligraphy/' + inv.id); openDownloads(); }
  };

  /* ---------------- the four pages ---------------- */
  function renderPageBar() {
    const bar = document.getElementById('ixPages'); if (!bar) return;
    const cal = S.inv.calligraphy, on = ST.pagesOn(cal);
    bar.innerHTML = ST.PAGES.map(([id, name], i) => `<button type="button" role="tab" data-page="${id}" aria-selected="${id === S.pageId}" class="${id === S.pageId ? 'on' : ''} ${on.includes(id) ? '' : 'off'}"><small>${i + 1}</small> ${esc(name)}${on.includes(id) ? '' : ' <em>(off)</em>'}</button>`).join('')
      + (S.pageId === 'main' ? '' : `<label class="ixc-check ixc-pageon"><input type="checkbox" id="ixPageOn" ${on.includes(S.pageId) ? 'checked' : ''}> Include this page</label>`);
    bar.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => { if (b.dataset.page === S.pageId) return; S.pageId = b.dataset.page; S.sel = null; renderPageBar(); renderLeft(); renderRight(); paint(true); }));
    const t = bar.querySelector('#ixPageOn');
    if (t) t.onchange = () => { cal.pages = { ...(cal.pages || {}), [S.pageId]: t.checked }; renderPageBar(); changed(); };
  }

  function shell() {
    const inv = S.inv;
    return `<div class="ixc" id="ixc">
      <header class="ixc-top">
        <a class="btn sm ghost" href="#/edit/${esc(inv.id)}/1" title="Back to the invitation editor">← <span class="ixc-hide-sm">Back to editor</span></a>
        <b class="ixc-brand">✒ Calligraphy Studio</b>
        ${inv.languages.length > 1 ? `<div class="seg ixc-langs" role="tablist" aria-label="Language">${inv.languages.map((l) => `<button type="button" data-lang="${l}" class="${l === S.lang ? 'on' : ''}" lang="${l}">${esc(LANG_NAME[l] || l)}</button>`).join('')}</div>` : ''}
        <span class="ixc-grow"></span>
        <button class="btn sm ghost iconbtn" id="ixUndo" title="Undo (Ctrl+Z)" aria-label="Undo">↶</button>
        <button class="btn sm ghost iconbtn" id="ixRedo" title="Redo (Ctrl+Y)" aria-label="Redo">↷</button>
        <span class="ixc-zoom ixc-hide-sm"><button class="btn sm ghost iconbtn" data-zoom="-1" aria-label="Zoom out">−</button><button class="btn sm ghost" data-zoom="0" id="ixZoomL">100%</button><button class="btn sm ghost iconbtn" data-zoom="1" aria-label="Zoom in">+</button></span>
        <details class="ixc-more"><summary class="btn sm ghost" aria-label="More">⋯</summary><div class="ixc-menu">
          <button type="button" id="ixRestore">↺ Restore original layout</button>
          <button type="button" id="ixDup">⧉ Duplicate design</button>
          <button type="button" id="ixOff">✕ Stop using calligraphy</button></div></details>
        <span class="ixc-status small muted" id="ixStatus" aria-live="polite">Saved</span>
        <button class="btn sm" id="ixDl" title="Download PNG, JPG or PDF">⬇ <span class="ixc-hide-sm">Download</span></button>
        <button class="btn sm primary" id="ixSave">Save</button>
      </header>
      <div class="ixc-body">
        <aside class="ixc-left" id="ixLeft" aria-label="Design tools">
          <nav class="ixc-tabs" role="tablist">${TABS.map(([id, ic, l]) => `<button type="button" role="tab" data-tab="${id}" class="${id === S.tab ? 'on' : ''}"><span aria-hidden="true">${ic}</span>${l}</button>`).join('')}</nav>
          <div class="ixc-panel" id="ixPanel"></div>
        </aside>
        <main class="ixc-stage" id="ixStage">
          <div class="ixc-pages" id="ixPages" role="tablist" aria-label="Pages"></div>
          <div class="ixc-warn" id="ixWarn" hidden></div>
          <div class="ixc-canvas" id="ixCanvas"><div class="ixc-card" id="ixCard"></div><div class="ixc-sel" id="ixSel" hidden><span class="h-rot" data-h="rot" title="Turn"></span><span class="h-size" data-h="size" title="Resize"></span></div></div>
          <p class="ixc-tip tiny muted">Tap any line or flourish on the card to change it. Drag to move it.</p>
        </main>
        <aside class="ixc-right" id="ixRight" aria-label="Selected item"></aside>
      </div>
      <nav class="ixc-bottom" aria-label="Design tools">${TABS.map(([id, ic, l]) => `<button type="button" data-btab="${id}"><span aria-hidden="true">${ic}</span>${l}</button>`).join('')}</nav>
    </div>`;
  }

  /* ---------------- drawing ---------------- */
  let painting = 0;
  async function paint(loadFonts) {
    if (!S) return;
    const id = ++painting;
    if (loadFonts) await FN.ensure(IXC.fontsNeeded(S.inv, S.lang));
    if (!S || id !== painting) return;
    const r = IXC.draw(S.preview ? previewInv() : S.inv, { page: S.pageId, lang: S.lang, editing: true, placeholders: true, uid: 'ixs' });
    const card = document.getElementById('ixCard');
    if (!card) return;
    card.innerHTML = r.svg;
    S.page = r;
    const w = document.getElementById('ixWarn');
    w.hidden = !r.warnings.length;
    w.innerHTML = r.warnings.map((k) => `<p>⚠ ${esc(IXC.WARN_TEXT[k])}</p>`).join('');
    wireCard();
    drawSel();
  }
  const paintSoon = (() => { let raf = 0; return () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => paint(false)); }; })();

  /** Something changed: redraw, remember for undo, save soon. */
  function changed({ fonts = false, left = false, right = false } = {}) {
    if (fonts) paint(true); else paintSoon();
    if (left) renderLeft();
    if (right) renderRight();
    S.inv.languages.forEach((l) => ST.syncTitle(S.inv, l));
    histSoon();
    S.saved = false; status('Saving…');
    saveSoon();
  }

  /* ---------------- saving ---------------- */
  const saveSoon = IX.debounce(() => save(), 800);
  async function save() {
    if (!S) return;
    const inv = S.inv;
    matchGuestPage(inv);
    try { await H.store.saveInvitation(inv); if (S) { S.saved = true; status('Saved'); } } catch (e) { status('Not saved'); IX.toast('Could not save: ' + e.message, 'err', 5000); }
  }
  const status = (t) => { const el = document.getElementById('ixStatus'); if (el) el.textContent = t; };

  /* ---------------- undo / redo ---------------- */
  function snap(inv) { return JSON.stringify({ c: inv.calligraphy, t: inv.text, e: inv.events, k: inv.contact, d: (inv.settings || {}).rsvpDeadline || '' }); }
  let histT = 0;
  function histSoon() { clearTimeout(histT); histT = setTimeout(histRecord, 450); }
  function histRecord() {
    if (!S) return;
    const now = snap(S.inv), h = S.hist;
    if (now === h.last) return;
    h.past.push(h.last); if (h.past.length > 80) h.past.shift();
    h.last = now; h.future = [];
    histButtons();
  }
  function histApply(s) {
    const o = JSON.parse(s);
    S.inv.calligraphy = o.c; S.inv.text = o.t;
    if (Array.isArray(o.e)) S.inv.events = o.e; else if (o.e) S.inv.events[0] = o.e;
    if (o.k) S.inv.contact = o.k;
    S.inv.settings.rsvpDeadline = o.d || '';
    S.sel = null;
    renderLeft(); renderRight(); renderPageBar(); paint(true); histButtons();
    S.saved = false; status('Saving…'); saveSoon();
  }
  function undo() { histRecord(); const h = S.hist; if (!h.past.length) return; h.future.push(h.last); h.last = h.past.pop(); histApply(h.last); IX.toast('Undone'); }
  function redo() { histRecord(); const h = S.hist; if (!h.future.length) return; h.past.push(h.last); h.last = h.future.pop(); histApply(h.last); IX.toast('Redone'); }
  function histButtons() { const u = document.getElementById('ixUndo'), r = document.getElementById('ixRedo'); if (u) u.disabled = !S.hist.past.length && snap(S.inv) === S.hist.last; if (r) r.disabled = !S.hist.future.length; }
  function keys(e) {
    if (!S) return;
    const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && !typing && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.key === 'Escape' && S.sel) { select(null); }
    else if (!typing && S.sel && (e.key === 'Delete' || e.key === 'Backspace') && isOrn(S.sel)) { e.preventDefault(); removeOrn(S.sel); }
    else if (!typing && S.sel && /^Arrow/.test(e.key)) {
      e.preventDefault();
      const d = e.shiftKey ? 20 : 4, dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      moveBy(S.sel, dx, dy); changed();
    }
  }

  /* ---------------- top bar ---------------- */
  function wireTop() {
    const root = document.getElementById('ixc');
    root.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => { S.lang = b.dataset.lang; ST.fillWords(S.inv, S.lang); root.querySelectorAll('[data-lang]').forEach((x) => x.classList.toggle('on', x === b)); renderLeft(); renderRight(); paint(true); }));
    root.querySelector('#ixUndo').onclick = undo;
    root.querySelector('#ixRedo').onclick = redo;
    root.querySelectorAll('[data-zoom]').forEach((b) => (b.onclick = () => { const z = +b.dataset.zoom; S.zoom = z === 0 ? 1 : Math.max(0.5, Math.min(2, S.zoom + z * 0.25)); applyZoom(); }));
    root.querySelector('#ixSave').onclick = async () => { await save(); IX.toast('Design saved', 'ok'); };
    root.querySelector('#ixDl').onclick = () => openDownloads();
    root.querySelector('#ixRestore').onclick = async () => {
      closeMenu();
      if (!(await H.confirm('Restore the original layout?', 'Flourishes and positions go back to how this style made them. Your words, fonts and colours stay as they are. You can undo this.', 'Restore'))) return;
      ST.restoreLayout(S.inv.calligraphy); S.sel = null; changed({ left: true, right: true });
    };
    root.querySelector('#ixDup').onclick = async () => {
      closeMenu(); await save();
      const copy = await H.store.duplicateInvitation(S.inv.id);
      IX.toast('Copy made. You are now editing the copy.', 'ok', 4000);
      H.go('#/calligraphy/' + copy.id);
    };
    root.querySelector('#ixOff').onclick = async () => {
      closeMenu();
      if (!(await H.confirm('Stop using calligraphy?', 'The invitation goes back to a ready design. Your calligraphy design is kept, so you can switch back any time from step 1.', 'Stop using it'))) return;
      S.inv.calligraphy.active = false; await H.store.saveInvitation(S.inv); H.go('#/edit/' + S.inv.id + '/1');
    };
    root.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; renderLeft(); }));
    root.querySelectorAll('[data-btab]').forEach((b) => (b.onclick = () => {
      const same = S.sheet && S.tab === b.dataset.btab;
      S.tab = b.dataset.btab; S.sheet = !same;
      if (S.sheet) select(null, true);
      renderLeft();
    }));
    histButtons();
  }
  const closeMenu = () => { const d = document.querySelector('.ixc-more'); if (d) d.open = false; };

  /* ---------------- zoom ---------------- */
  function fitZoom() {
    if (!S) return;
    const st = document.getElementById('ixStage'); if (!st) return;
    const size = ST.SIZES[S.inv.calligraphy.size] || ST.SIZES['5x7'];
    const availW = st.clientWidth - 32, availH = st.clientHeight - (window.innerWidth < 900 ? 24 : 64);
    S.base = Math.max(240, Math.min(availW, availH * (size.w / size.h), 720));
    applyZoom();
  }
  function applyZoom() {
    const c = document.getElementById('ixCanvas'); if (!c || !S.base) return;
    c.style.width = Math.round(S.base * S.zoom) + 'px';
    const l = document.getElementById('ixZoomL'); if (l) l.textContent = Math.round(S.zoom * 100) + '%';
    drawSel();
  }

  /* ---------------- selection on the card ---------------- */
  const isOrn = (id) => /^(orn-|corner-|add-)/.test(base(id));
  const elOf = (id) => (S.inv.calligraphy.el[id] = S.inv.calligraphy.el[id] || {});
  const addedOf = (id) => S.inv.calligraphy.added.find((a) => a.id === id);
  function unit() { const svg = document.querySelector('#ixCard svg'); return svg ? S.page.W / svg.getBoundingClientRect().width : 1; }
  function select(id, keepSheet) {
    S.sel = id;
    if (!keepSheet && id) S.sheet = false;
    document.getElementById('ixc').classList.toggle('sel-open', !!id);
    renderRight(); drawSel();
    if (!keepSheet) renderLeft();
  }
  function drawSel() {
    const box = document.getElementById('ixSel'); if (!box) return;
    const g = S.sel && document.querySelector(`#ixCard [data-el="${CSS.escape(S.sel)}"]`);
    if (!g) { box.hidden = true; return; }
    const c = document.getElementById('ixCanvas').getBoundingClientRect(), r = g.getBoundingClientRect();
    box.hidden = false;
    Object.assign(box.style, { left: r.left - c.left - 6 + 'px', top: r.top - c.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
    box.dataset.kind = g.dataset.kind;
  }
  function moveBy(id, dx, dy) {
    const a = addedOf(id);
    if (a) { a.x += dx; a.y += dy; return; }
    const o = elOf(id); o.dx = (o.dx || 0) + dx; o.dy = (o.dy || 0) + dy;
  }
  function wireCard() {
    const card = document.getElementById('ixCard');
    card.querySelectorAll('[data-el]').forEach((g) => {
      g.style.cursor = 'move';
      g.onpointerdown = (e) => startDrag(e, g.dataset.el, 'move');
    });
    const svg = card.querySelector('svg');
    svg.onpointerdown = (e) => { if (!e.target.closest('[data-el]')) select(null); };
    const sel = document.getElementById('ixSel');
    sel.querySelectorAll('[data-h]').forEach((h) => (h.onpointerdown = (e) => startDrag(e, S.sel, h.dataset.h)));
  }
  function startDrag(e, id, mode) {
    if (!id) return;
    e.preventDefault(); e.stopPropagation();
    if (S.sel !== id) select(id);
    const u = unit(), x0 = e.clientX, y0 = e.clientY;
    const o = elOf(id), a = addedOf(id);
    const start = a ? { ...a } : { ...o };
    const g = document.querySelector(`#ixCard [data-el="${CSS.escape(id)}"]`);
    const r = g && g.getBoundingClientRect();
    const cxs = r ? r.left + r.width / 2 : x0, cys = r ? r.top + r.height / 2 : y0;
    let moved = false;
    const kind = base(id) === 'names' ? 'names' : isOrn(id) ? 'orn' : 'text';
    const onMove = (ev) => {
      const dx = (ev.clientX - x0) * u, dy = (ev.clientY - y0) * u;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3 * u) return;
      moved = true;
      if (mode === 'move') {
        if (a) { a.x = start.x + dx; a.y = start.y + dy; } else { o.dx = (start.dx || 0) + dx; o.dy = (start.dy || 0) + dy; }
      } else if (mode === 'size') {
        const d0 = Math.hypot(x0 - cxs, y0 - cys) || 1, d1 = Math.hypot(ev.clientX - cxs, ev.clientY - cys);
        const f = Math.max(0.3, Math.min(3, d1 / d0));
        if (a) a.scale = Math.max(0.2, Math.min(4, (start.scale || 1) * f));
        else if (kind === 'orn') o.scale = Math.max(0.2, Math.min(4, (start.scale || 1) * f));
        else o.size = Math.max(0.4, Math.min(2.2, (start.size || 1) * f));
      } else if (mode === 'rot') {
        const ang = (Math.atan2(ev.clientY - cys, ev.clientX - cxs) * 180) / Math.PI + 90;
        const v = Math.round(ang / 1) % 360;
        const snapA = [0, 90, 180, 270, -90].find((s) => Math.abs(((v - s + 540) % 360) - 180) < 4);
        if (a) a.rot = snapA != null ? snapA : v; else o.rot = snapA != null ? snapA : v;
      }
      paintSoon();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      if (!moved) return;
      if (kind === 'orn' && mode !== 'rot') requestAnimationFrame(() => protect(id));
      changed({ right: true });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }
  /** Keep flourishes off the words: if one is dropped on text, slide it to the nearest clear spot. */
  function protect(id) {
    const g = document.querySelector(`#ixCard [data-el="${CSS.escape(id)}"]`); if (!g) return;
    const words = [...document.querySelectorAll('#ixCard [data-kind="text"], #ixCard [data-kind="names"]')].map((t) => t.getBoundingClientRect());
    const o = g.getBoundingClientRect();
    const hit = (r, dy) => words.some((w) => { const ix = Math.min(r.right, w.right) - Math.max(r.left, w.left), iy = Math.min(r.bottom + dy, w.bottom) - Math.max(r.top + dy, w.top); return ix > 0 && iy > 0 && (ix * iy) / (r.width * r.height) > 0.12; });
    if (!hit(o, 0)) return;
    const u = unit();
    for (let step = 8; step < 900; step += 8) {
      for (const dy of [step, -step]) {
        if (!hit(o, dy)) { moveBy(id, 0, dy * u); paint(false); IX.toast('Moved a little so it does not cover your words'); return; }
      }
    }
  }
  function removeOrn(id) {
    const cal = S.inv.calligraphy;
    if (addedOf(id)) cal.added = cal.added.filter((a) => a.id !== id);
    else if (!cal.removed.includes(id)) cal.removed.push(id);
    select(null); changed();
  }

  /* ---------------- shared controls ---------------- */
  const inkSwatches = (cur, attr) => `<div class="ixc-inks">${LIB.INKS.map((i) => `<button type="button" class="ixc-ink ${cur === i.id ? 'on' : ''}" ${attr}="${i.id}" title="${esc(i.name)}" aria-label="${esc(i.name)}" style="--c:${i.color}">${i.metal ? '<i class="m"></i>' : ''}</button>`).join('')}<label class="ixc-ink ixc-ink-custom" title="Your own colour"><input type="color" ${attr}-custom value="${/^#/.test(cur || '') ? cur : LIB.inkColor(cur)}" aria-label="Your own colour">＋</label></div>`;
  const slider = (id, label, val, min, max, step, fmt) => `<label class="ixc-sl"><span>${label} <b data-out="${id}">${fmt ? fmt(val) : val}</b></span><input type="range" data-sl="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
  const pct = (v) => Math.round(v * 100) + '%';
  function fontOptions(sc, cur) {
    return FN.CATEGORIES.map((c) => c.groups.map(([g, gl]) => {
      const fs = FN.LIST.filter((f) => f.cat === g && (sc === 'latn' ? f.script === 'latn' : f.script === sc));
      return fs.length ? `<optgroup label="${esc(gl)}">${fs.map((f) => `<option value="${esc(f.name)}" ${f.name === cur ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</optgroup>` : '';
    }).join('')).join('');
  }
  const textOf = (id) => IXC.words(S.inv, S.lang, false).w[base(id)] || '';
  // the names share one set of lettering settings on every page; only their position is per page
  const setOf = (id) => (base(id) === 'names' ? 'names' : id);
  function curFont(id, sc) {
    const cal = S.inv.calligraphy, st = ST.STYLE[cal.style], o = cal.el[setOf(id)] || {};
    const role = IXC.roleOf(id);
    const disp = role === 'names' || role === 'heading';
    if (sc === 'deva') return o.fontHi || st.indic.deva[disp ? 'display' : 'text'];
    if (sc === 'guru') return o.fontPa || st.indic.guru[disp ? 'display' : 'text'];
    return o.font || st.type[role].font;
  }
  const fontKey = (sc) => (sc === 'deva' ? 'fontHi' : sc === 'guru' ? 'fontPa' : 'font');

  /* ---------------- left panel ---------------- */
  function renderLeft() {
    if (!S) return;
    const root = document.getElementById('ixc'); if (!root) return;
    root.classList.toggle('sheet-open', !!S.sheet);
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === S.tab));
    root.querySelectorAll('[data-btab]').forEach((b) => b.classList.toggle('on', S.sheet && b.dataset.btab === S.tab));
    const p = document.getElementById('ixPanel');
    p.innerHTML = `<div class="ixc-sheet-h"><b>${esc(TABS.find((t) => t[0] === S.tab)[2])}</b><button type="button" class="btn sm ghost iconbtn" data-close-sheet aria-label="Close">✕</button></div>` + ({ words: panelWords, style: panelStyle, fonts: panelFonts, ink: panelInk, orn: panelOrn, paper: panelPaper }[S.tab])();
    p.querySelector('[data-close-sheet]').onclick = () => { S.sheet = false; renderLeft(); };
    ({ words: wireWords, style: wireStyle, fonts: wireFonts, ink: wireInk, orn: wireOrn, paper: wirePaper }[S.tab])(p);
  }

  const WORD_STYLES = [['royal', 'Royal'], ['heartfelt', 'Romantic'], ['traditional', 'Traditional'], ['formal', 'Formal'], ['poetic', 'Poetic'], ['elegant', 'Elegant'], ['modern', 'Minimal']];
  function pageSpecs() {
    const p = S.pageId, inv = S.inv;
    if (p === 'cover') return ['t:coverLine', 't:bride', 't:groom', 'e0:date', 'e0:city'];
    if (p === 'rsvp') return ['t:rsvpTitle', 't:rsvpNote', 's:deadline', 'c:name', 'c:phone', 't:blessing'];
    if (p === 'events') return ['t:eventsTitle'];
    return ST.FIELDS.map((f) => (f.event ? 'e0:' + f.event : 't:' + f.key));
  }
  function panelWords() {
    const p = S.pageId, inv = S.inv, cs = window.IXStudio ? IXStudio.notes(inv).style : '';
    const ai = window.IXStudio && (p === 'main' || p === 'cover') ? `<div class="ixc-ai">
        <b>Need the words?</b>
        <p class="tiny muted">Pick a writing style and Copy Studio writes the heading, the line under the names, the message and the blessing. Lines you typed yourself are kept unless you choose to replace them.</p>
        <div class="ixc-wstyles" role="radiogroup" aria-label="Writing style">${WORD_STYLES.map(([id, l]) => `<button type="button" role="radio" aria-checked="${cs === id}" class="${cs === id ? 'on' : ''}" data-wstyle="${id}">${l}</button>`).join('')}</div>
        <button type="button" class="btn sm primary" id="ixCopy">✨ Write with Copy Studio</button></div>` : '';
    const evs = p === 'events' ? inv.events.map((e, n) => `<fieldset class="ixc-ev"><legend>Event ${n + 1}${inv.events.length > 1 ? ` <button type="button" class="btn sm ghost" data-evdel="${n}" aria-label="Remove event ${n + 1}">✕</button>` : ''}</legend>
        ${['name', 'date', 'start', 'venue', 'city'].map((k) => fieldHtml(`e${n}:${k}`, 'ixf-', 'data-field')).join('')}</fieldset>`).join('') + '<button type="button" class="btn sm" id="ixEvAdd">＋ Add an event</button><p class="tiny muted">Events are shared with the RSVP page and the calendar links.</p>' + fieldHtml('t:reception', 'ixf-', 'data-field') : '';
    const intro = { main: 'Type your words here. Names are written exactly as you type them. Leave a line empty to leave it off the card.', cover: 'The cover shows the names, the date and the town. Leave a line empty to leave it off.',
      events: 'Every event of your wedding, in order. Each one gets its own name, date and place.', rsvp: 'How guests reply. Once the invitation is published, a QR code to your invitation page appears on this page.' }[p];
    return `${ai}<p class="tiny muted">${intro}</p>${pageSpecs().map((sp) => fieldHtml(sp, 'ixf-', 'data-field')).join('')}${evs}
      ${p === 'main' && !(inv.events[0] && inv.events[0].date) ? '<p class="tiny muted">Date and time are shared with the RSVP page and calendar links.</p>' : ''}`;
  }
  function wireWords(p) {
    wireFields(p, 'data-field');
    p.querySelectorAll('[data-wstyle]').forEach((b) => (b.onclick = () => { IXStudio.notes(S.inv).style = b.dataset.wstyle; openCopy(); }));
    const c = p.querySelector('#ixCopy'); if (c) c.onclick = () => openCopy();
    const add = p.querySelector('#ixEvAdd'); if (add) add.onclick = () => { S.inv.events.push(IX.model.newEvent('')); changed({ left: true }); };
    p.querySelectorAll('[data-evdel]').forEach((b) => (b.onclick = async () => {
      const n = +b.dataset.evdel, e = S.inv.events[n];
      if ((e.name || e.date || e.venue) && !(await H.confirm('Remove this event?', `“${e.name || 'Event ' + (n + 1)}” is removed from the invitation, the RSVP page and the calendar links. You can undo this.`, 'Remove'))) return;
      S.inv.events.splice(n, 1); changed({ left: true });
    }));
  }

  /* ---------------- Copy Studio (the writer) inside the calligraphy studio ---------------- */
  // Copy Studio lines → calligraphy lines (the main message is the same line in both)
  const FROM_COPY = { heading: 'familyName', underNames: 'subtitle', blessing: 'thankyou' };
  function previewInv() {
    const t = IX.deepClone(S.inv), { fields, lang } = S.preview, l = lang || S.lang;
    t.text[l] = t.text[l] || {};
    Object.entries(FROM_COPY).forEach(([ck, fk]) => { if (fields[fk] != null) t.text[l][ck] = fields[fk]; });
    if (fields.message != null) t.text[l].message = fields.message;
    return t;
  }
  /** After Copy Studio writes: carry its new lines onto the card, but never over a line the host typed in this studio. */
  function takeCopy() {
    const inv = S.inv, cal = inv.calligraphy, kept = [];
    cal.fromCopy = cal.fromCopy || {};
    inv.languages.forEach((l) => {
      const t = inv.text[l]; if (!t) return;
      const prev = (cal.fromCopy[l] = cal.fromCopy[l] || {});
      Object.entries(FROM_COPY).forEach(([ck, fk]) => {
        const src = t[fk] || '';
        if (!src || src === prev['src_' + ck]) return;
        prev['src_' + ck] = src;
        const cur = t[ck] || '', def = (ST.DEFAULTS[l] || {})[ck];
        if (!cur || cur === prev[ck] || cur === def) { t[ck] = src; prev[ck] = src; } else kept.push(IXC.labelOf(ck).toLowerCase());
      });
    });
    if (kept.length) IX.toast(`Kept your own ${[...new Set(kept)].join(' and ')}. Tap the line to change it.`, '', 4500);
  }
  function openCopy() {
    if (!window.IXStudio) return;
    closeCopy();
    const ov = document.createElement('div');
    ov.className = 'ixc-copy'; ov.id = 'ixCopyOv';
    ov.innerHTML = '<div class="ixc-copy-box" role="dialog" aria-label="Copy Studio"><div id="ixCopyEl"></div></div>';
    document.getElementById('ixc').appendChild(ov);
    document.getElementById('ixc').classList.add('copy-open');
    if (S.pageId !== 'main') { S.pageId = 'main'; renderPageBar(); paint(false); }
    IXStudio.open(ov.querySelector('#ixCopyEl'), {
      inv: S.inv, lang: S.lang, langs: LANG_NAME, H, store: H.store,
      changed: () => { takeCopy(); changed({ left: true, right: true }); },
      preview: (fields, lang) => { S.preview = fields && (!lang || lang === S.lang) ? { fields, lang } : null; paint(false); },
      close: () => closeCopy(),
    });
    ov.querySelector('.ixc-copy-box').scrollTop = 0;
  }
  function closeCopy() {
    const ov = document.getElementById('ixCopyOv'); if (ov) ov.remove();
    const root = document.getElementById('ixc'); if (root) root.classList.remove('copy-open');
    if (S && S.preview) { S.preview = null; paint(false); }
    if (S) renderLeft();
  }

  const thumbs = new Map();
  function panelStyle() {
    const cal = S.inv.calligraphy;
    return `<p class="tiny muted">Choosing a style changes fonts, inks, paper and flourishes. Your words stay.</p>
      <div class="ixc-styles">${ST.STYLES.map((s) => `<button type="button" class="ixc-style ${s.id === cal.style ? 'on' : ''}" data-style="${s.id}" aria-pressed="${s.id === cal.style}"><span class="ixc-thumb" data-thumb="${s.id}"></span><b>${esc(s.name)}</b><small>${esc(s.blurb)}</small></button>`).join('')}</div>
      <h3 class="ixc-h">Names</h3>
      <div class="seg ixc-seg" role="radiogroup" aria-label="Name layout">${ST.NAME_LAYOUTS.map(([v, l]) => `<label><input type="radio" name="nl" value="${v}" ${cal.nameLayout === v ? 'checked' : ''}>${l}</label>`).join('')}</div>
      <div class="seg ixc-seg" role="radiogroup" aria-label="Initials">${ST.INITIALS.map(([v, l]) => `<label><input type="radio" name="ini" value="${v}" ${cal.initials === v ? 'checked' : ''}>${l}</label>`).join('')}</div>
      <h3 class="ixc-h">Card size</h3>
      <div class="seg ixc-seg">${Object.entries(ST.SIZES).map(([k, s]) => `<label><input type="radio" name="csize" value="${k}" ${cal.size === k ? 'checked' : ''}>${s.name}</label>`).join('')}</div>`;
  }
  function wireStyle(p) {
    const cal = S.inv.calligraphy;
    p.querySelectorAll('[data-style]').forEach((b) => (b.onclick = async () => {
      if (b.dataset.style === cal.style) return;
      const touched = Object.keys(cal.el).length || cal.added.length || cal.removed.length;
      if (touched && !(await H.confirm('Change style?', 'Fonts, inks, paper and flourishes change to the new style. Your words stay. You can undo this.', 'Change style'))) return;
      ST.applyStyle(cal, b.dataset.style); cal.active = true; S.sel = null;
      changed({ fonts: true, left: true, right: true });
    }));
    p.querySelectorAll('input[name=nl]').forEach((r) => (r.onchange = () => { cal.nameLayout = r.value; changed(); }));
    p.querySelectorAll('input[name=ini]').forEach((r) => (r.onchange = () => { cal.initials = r.value; if (r.value === 'flourished') { cal.orn.initialFlourish = true; cal.orn.sprig = true; } changed({ fonts: true }); }));
    p.querySelectorAll('input[name=csize]').forEach((r) => (r.onchange = () => { cal.size = r.value; changed(); setTimeout(fitZoom, 50); }));
    // live mini cards with the host's own names
    p.querySelectorAll('[data-thumb]').forEach(async (el) => {
      const id = el.dataset.thumb, key = id + '|' + S.lang + '|' + ((S.inv.text[S.lang] || {}).bride || '') + ((S.inv.text[S.lang] || {}).groom || '');
      if (!thumbs.has(key)) thumbs.set(key, thumbFor(S.inv, id, S.lang));
      el.innerHTML = await thumbs.get(key);
    });
  }

  const namesId = () => (S.pageId === 'main' ? 'names' : S.pageId + ':names');
  const fontTarget = () => (S.sel && !isOrn(S.sel) && base(S.sel) !== 'qr' ? S.sel : namesId());
  function panelFonts() {
    const id = fontTarget();
    const txt = base(id) === 'names' ? [textOf('bride'), textOf('groom')].join(' ') : textOf(id);
    const scs = ['latn', 'deva', 'guru'].filter((sc) => sc === 'latn' ? FN.scriptOf(txt) === 'latn' || FN.hasScript(txt, 'latn') : FN.hasScript(txt, sc));
    if (!scs.length) scs.push('latn');
    return `<p class="tiny muted">Choosing for: <b>${esc(IXC.labelOf(id))}</b>. Tap another line on the card to choose for it.</p>
      ${scs.map((sc) => `<h3 class="ixc-h">${sc === 'latn' ? 'English lettering' : sc === 'deva' ? 'Hindi lettering' : 'Punjabi lettering'}</h3>
        ${sc === 'guru' ? '<p class="tiny muted">Punjabi fonts here are traditional lettering. A truly handwritten Gurmukhi calligraphy font is not available with a free licence.</p>' : ''}
        ${FN.CATEGORIES.map((c) => {
          const groups = c.groups.map(([g, gl]) => [gl, FN.LIST.filter((f) => f.cat === g && f.script === sc)]).filter(([, fs]) => fs.length);
          if (!groups.length) return '';
          return `<details class="ixc-fcat" ${c.groups.some(([g]) => FN.LIST.find((f) => f.name === curFont(id, sc) && f.cat === g)) || sc !== 'latn' ? 'open' : ''}><summary>${esc(c.name)}</summary>${groups.map(([gl, fs]) => `<p class="ixc-fg">${esc(gl)}</p><div class="ixc-fonts">${fs.map((f) => `<button type="button" class="ixc-font ${curFont(id, sc) === f.name ? 'on' : ''}" data-font="${esc(f.name)}" data-sc="${sc}" style="font-family:'${esc(f.name)}';font-weight:${f.w || f.weights[0]}" title="${esc(f.name)}"><span>${esc(sample(id, sc))}</span><small>${esc(f.name)}${f.note ? ' · ' + esc(f.note) : ''}</small></button>`).join('')}</div>`).join('')}</details>`;
        }).join('')}`).join('')}`;
  }
  function sample(id, sc) {
    id = base(id) === 'names' ? 'names' : id;
    if (sc === 'deva') return id === 'names' ? (FN.hasScript(textOf('bride'), 'deva') ? textOf('bride') : 'राघवी') : 'शुभ विवाह';
    if (sc === 'guru') return id === 'names' ? (FN.hasScript(textOf('bride'), 'guru') ? textOf('bride') : 'ਰਾਘਵੀ') : 'ਸ਼ੁਭ ਵਿਆਹ';
    if (id === 'names') return textOf('bride') && FN.scriptOf(textOf('bride')) === 'latn' ? textOf('bride') : 'Raghavi';
    return 'Together with their families';
  }
  function wireFonts(p) {
    FN.ensure(FN.LIST.filter((f) => p.querySelector(`[data-font="${CSS.escape(f.name)}"]`)).map((f) => [f.name, f.w || f.weights[0]]));
    p.querySelectorAll('[data-font]').forEach((b) => (b.onclick = () => {
      const id = setOf(fontTarget());
      elOf(id)[fontKey(b.dataset.sc)] = b.dataset.font;
      if (b.dataset.sc === 'latn') { delete elOf(id).w; delete elOf(id).italic; }
      p.querySelectorAll(`[data-font][data-sc="${b.dataset.sc}"]`).forEach((x) => x.classList.toggle('on', x === b));
      changed({ fonts: true, right: true });
    }));
  }

  function panelInk() {
    const cal = S.inv.calligraphy;
    return `<p class="tiny muted">Pick an ink for each part of the card.</p>
      ${INK_ROLES.map(([k, l]) => `<div class="ixc-inkrow"><span>${l}</span>${inkSwatches(cal.inks[k], 'data-ink-' + k)}</div>`).join('')}
      <label class="ixc-check"><input type="checkbox" id="ixSheen" ${cal.sheen !== false ? 'checked' : ''}> Shimmer on gold, bronze and copper inks</label>
      <p class="tiny muted">The shimmer is an on-screen effect. Printed cards show a warm gold colour from an ordinary printer. This is gold-coloured ink, not metallic foil.</p>`;
  }
  function wireInkRow(p, prefix, set) {
    p.querySelectorAll(`[${prefix}]`).forEach((b) => (b.onclick = () => set(b.getAttribute(prefix))));
    const c = p.querySelector(`[${prefix}-custom]`); if (c) c.oninput = () => set(c.value);
  }
  function wireInk(p) {
    const cal = S.inv.calligraphy;
    INK_ROLES.forEach(([k]) => wireInkRow(p, 'data-ink-' + k, (v) => { cal.inks[k] = v; if (k === 'bride' || k === 'groom' || k === 'initials') { const n = elOf('names'); delete n['ink' + k[0].toUpperCase() + k.slice(1)]; } changed({ left: true }); }));
    p.querySelector('#ixSheen').onchange = (e) => { cal.sheen = e.target.checked; changed(); };
  }

  function ornThumb(o) { return `<svg viewBox="${-o.w / 2 - 6} ${-o.h / 2 - 6} ${o.w + 12} ${o.h + 12}" aria-hidden="true">${LIB.ornament(o.id)}</svg>`; }
  function panelOrn() {
    const cal = S.inv.calligraphy;
    const slot = (k, l, kinds) => `<div class="field"><label for="ixo-${k}">${l}</label><select class="input" id="ixo-${k}" data-slot="${k}"><option value="">None</option>${LIB.ORNAMENTS.filter((o) => kinds.includes(o.kind)).map((o) => `<option value="${o.id}" ${cal.orn[k] === o.id && !cal.removed.includes('orn-' + (k === 'mark' ? 'mark' : k)) ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select></div>`;
    return `<p class="tiny muted">Tap a flourish to add it to the card, then drag it where you like. Flourishes are kept off your words automatically.</p>
      <div class="ixc-orns">${LIB.ORNAMENTS.filter((o) => o.kind !== 'corner').map((o) => `<button type="button" class="ixc-orn" data-add="${o.id}" title="Add ${esc(o.name)}"><span style="color:${LIB.inkColor(cal.inks.flourish)}">${ornThumb(o)}</span><small>${esc(o.name)}</small></button>`).join('')}</div>
      <h3 class="ixc-h">Flourishes in the layout</h3>
      ${slot('top', 'Above the names', ['swash', 'divider', 'motif', 'mark'])}
      ${slot('under', 'Below the names', ['swash', 'divider', 'motif', 'mark'])}
      ${slot('divider', 'Between date and venue', ['divider', 'motif', 'mark'])}
      ${slot('mark', 'At the end', ['mark', 'divider', 'motif'])}
      <label class="ixc-check"><input type="checkbox" id="ixIniF" ${cal.orn.initialFlourish ? 'checked' : ''}> Hairline swirl on decorated initials</label>
      <label class="ixc-check"><input type="checkbox" id="ixSprig" ${cal.orn.sprig ? 'checked' : ''}> Small leaf sprig on decorated initials</label>
      <button type="button" class="btn sm" id="ixRestore2">↺ Restore original layout</button>`;
  }
  function wireOrn(p) {
    const cal = S.inv.calligraphy;
    p.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => {
      const o = LIB.O[b.dataset.add], size = ST.SIZES[cal.size] || ST.SIZES['5x7'];
      const id = 'add-' + Math.random().toString(36).slice(2, 8);
      const w = o.kind === 'motif' || o.kind === 'mark' ? 120 : 300;
      cal.added.push({ id, ref: o.id, x: size.w / 2, y: size.h * 0.82, w, scale: 1, rot: 0, opacity: 1, page: S.pageId });
      if (window.innerWidth < 900) S.sheet = false;
      changed({ left: true });
      requestAnimationFrame(() => { protect(id); select(id); });
      IX.toast('Added. Drag it into place.');
    }));
    p.querySelectorAll('[data-slot]').forEach((s) => (s.onchange = () => {
      const k = s.dataset.slot, id = 'orn-' + k;
      cal.orn[k] = s.value;
      // the same slot on every page of the set
      const ids = Object.keys(cal.el).concat(cal.removed).filter((x) => base(x) === id || (k === 'divider' && /^orn-d\d+$/.test(base(x))));
      cal.removed = cal.removed.filter((x) => !ids.includes(x));
      ids.forEach((x) => { if (cal.el[x]) delete cal.el[x].ref; });
      changed();
    }));
    p.querySelector('#ixIniF').onchange = (e) => { cal.orn.initialFlourish = e.target.checked; cal.removed = cal.removed.filter((x) => x !== 'names-curl'); changed(); };
    p.querySelector('#ixSprig').onchange = (e) => { cal.orn.sprig = e.target.checked; cal.removed = cal.removed.filter((x) => x !== 'names-sprig'); changed(); };
    p.querySelector('#ixRestore2').onclick = () => document.getElementById('ixRestore').click();
  }

  function panelPaper() {
    const cal = S.inv.calligraphy, pp = cal.paper;
    const sel = (id, label, list, cur) => `<div class="field"><label for="${id}">${label}</label><select class="input" id="${id}">${list.map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    return `<div class="ixc-papers">${LIB.PAPERS.map((x) => `<button type="button" class="ixc-paper ${pp.id === x.id ? 'on' : ''}" data-paper="${x.id}" style="--c:${x.color}"><i></i><small>${esc(x.name)}</small></button>`).join('')}</div>
      <div class="ixc-row2"><div class="field"><label for="ixPc">Paper colour</label><input type="color" id="ixPc" value="${pp.color}"></div>
      ${slider('grain', 'Paper grain', pp.grain == null ? 0.4 : pp.grain, 0, 1, 0.05, pct)}</div>
      ${sel('ixTex', 'Paper texture', LIB.TEXTURES, pp.texture || 'none')}
      ${sel('ixPat', 'Background pattern', LIB.PATTERNS, pp.pattern || 'none')}
      <label class="ixc-check"><input type="checkbox" id="ixDeckle" ${pp.deckle ? 'checked' : ''}> Torn, hand-made edges</label>
      ${sel('ixBor', 'Border', LIB.BORDERS, pp.border || 'none')}
      <div class="field"><span class="lbl">Border and corner colour</span>${inkSwatches(pp.borderInk || cal.inks.flourish, 'data-bink')}</div>
      ${sel('ixCor', 'Decorative corners', LIB.CORNERS, pp.corners || 'none')}
      <p class="tiny muted">Textures are kept faint on purpose, so your words stay easy to read.</p>`;
  }
  function wirePaper(p) {
    const cal = S.inv.calligraphy, pp = cal.paper;
    p.querySelectorAll('[data-paper]').forEach((b) => (b.onclick = () => {
      const x = LIB.PAPER[b.dataset.paper];
      Object.assign(pp, { id: x.id, color: x.color, texture: x.texture, grain: x.grain, deckle: !!x.deckle });
      readableInks();
      changed({ left: true });
    }));
    p.querySelector('#ixPc').oninput = (e) => { pp.color = e.target.value; changed(); };
    p.querySelector('#ixPc').onchange = () => { readableInks(); };
    p.querySelector('[data-sl="grain"]').oninput = (e) => { pp.grain = +e.target.value; p.querySelector('[data-out="grain"]').textContent = pct(pp.grain); changed(); };
    p.querySelector('#ixTex').onchange = (e) => { pp.texture = e.target.value; changed(); };
    p.querySelector('#ixPat').onchange = (e) => { pp.pattern = e.target.value; changed(); };
    p.querySelector('#ixDeckle').onchange = (e) => { pp.deckle = e.target.checked; changed(); };
    p.querySelector('#ixBor').onchange = (e) => { pp.border = e.target.value; changed(); };
    p.querySelector('#ixCor').onchange = (e) => { pp.corners = e.target.value; cal.removed = cal.removed.filter((x) => !/^corner-/.test(x)); changed(); };
    wireInkRow(p, 'data-bink', (v) => { pp.borderInk = v; changed({ left: true }); });
  }
  /** On dark paper, swap dark inks for light ones (and the other way round) so words stay readable. */
  function readableInks() {
    const cal = S.inv.calligraphy, bg = cal.paper.color, dark = LIB.lum(bg) < 0.2;
    let swapped = false;
    Object.keys(cal.inks).forEach((k) => {
      if (LIB.contrast(LIB.inkColor(cal.inks[k]), bg) < 2.6) { cal.inks[k] = dark ? (k === 'main' || k === 'details' ? 'ivory' : 'champagne-gold') : (k === 'main' || k === 'details' ? 'dark-brown' : 'antique-gold'); swapped = true; }
    });
    if (swapped) { IX.toast('Some inks were changed so your words stay readable on this paper.'); renderLeft(); paint(false); }
  }

  /* ---------------- right panel: the selected item ---------------- */
  function renderRight() {
    if (!S) return;
    const r = document.getElementById('ixRight'); if (!r) return;
    const id = S.sel;
    if (!id) { r.innerHTML = `<div class="ixc-empty"><p><b>Tap anything on the card</b> to change its font, size, spacing, ink or position.</p><p class="tiny muted">Tip: drag to move. Use the round handle to turn and the square handle to resize. Arrow keys nudge.</p></div>`; return; }
    const cal = S.inv.calligraphy;
    const head = `<div class="ixc-rh"><b>${esc(IXC.labelOf(id) || (addedOf(id) ? LIB.O[addedOf(id).ref].name : id.startsWith('corner-') ? 'Corner' : 'Item'))}</b><button type="button" class="btn sm ghost iconbtn" data-x aria-label="Close">✕</button></div>`;
    let body = '';
    if (base(id) === 'qr') {
      const o = elOf(id);
      body = `<p class="tiny muted">${S.inv.slug ? 'Guests scan this to open your invitation and reply.' : 'The QR code appears once the invitation is published. Until then this box shows where it will go.'}</p>
        ${slider('scale', 'Size', o.scale || 1, 0.5, 1.8, 0.05, pct)}
        <div class="field"><span class="lbl">Ink</span>${inkSwatches(o.ink || cal.inks.details, 'data-tink')}</div>
        <p class="tiny muted">Dark inks on light paper scan best.</p>
        <div class="row"><button type="button" class="btn sm" id="ixr-reset">↺ Put back</button><button type="button" class="btn sm" id="ixr-hide">Hide the QR code</button></div>`;
    } else if (base(id) === 'names') {
      const o = elOf('names');
      const sc = FN.scriptOf([textOf('bride'), textOf('groom')].join(' '));
      body = `<div class="ixc-row2"><div class="field"><label for="ixr-b">Bride</label><input class="input" id="ixr-b" data-name="bride" value="${esc(textOf('bride'))}" spellcheck="false"></div><div class="field"><label for="ixr-g">Groom</label><input class="input" id="ixr-g" data-name="groom" value="${esc(textOf('groom'))}" spellcheck="false"></div></div>
        <div class="field"><label for="ixr-f">Font for the names</label><select class="input" id="ixr-f" data-fsel="${sc === 'other' ? 'latn' : sc}">${fontOptions(sc === 'other' ? 'latn' : sc, curFont('names', sc === 'other' ? 'latn' : sc))}</select></div>
        ${sc === 'latn' ? `<div class="field"><label for="ixr-if">Font for the initials</label><select class="input" id="ixr-if">${fontOptions('latn', o.initialFont || ST.STYLE[cal.style].type.initial.font)}</select></div>` : '<p class="tiny muted">Decorated initials are used for English names only.</p>'}
        ${slider('size', 'Size of both names', o.size || 1, 0.5, 1.6, 0.05, pct)}
        ${slider('sizeBride', "Bride's name size", o.sizeBride || 1, 0.6, 1.4, 0.05, pct)}
        ${slider('sizeGroom', "Groom's name size", o.sizeGroom || 1, 0.6, 1.4, 0.05, pct)}
        <div class="field"><span class="lbl">Arrangement</span><div class="seg ixc-seg">${ST.NAME_LAYOUTS.map(([v, l]) => `<label><input type="radio" name="rnl" value="${v}" ${cal.nameLayout === v ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
        <div class="field"><span class="lbl">Initials</span><div class="seg ixc-seg">${ST.INITIALS.map(([v, l]) => `<label><input type="radio" name="rini" value="${v}" ${cal.initials === v ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
        <div class="field"><label for="ixr-amp">Between the names</label><input class="input" id="ixr-amp" value="${esc(o.amp || '')}" placeholder="&amp;" maxlength="12"></div>
        <div class="field"><span class="lbl">Bride's ink</span>${inkSwatches(o.inkBride || cal.inks.bride, 'data-nb')}</div>
        <div class="field"><span class="lbl">Groom's ink</span>${inkSwatches(o.inkGroom || cal.inks.groom, 'data-ng')}</div>
        <div class="field"><span class="lbl">Initials ink</span>${inkSwatches(o.inkInitials || cal.inks.initials, 'data-ni')}</div>`;
    } else if (isOrn(id)) {
      const a = addedOf(id), o = a || elOf(id);
      const ob = base(id), slotK = /^orn-d\d+$/.test(ob) ? 'divider' : ob.startsWith('orn-') ? ob.slice(4) : null;
      body = `${slotK ? `<div class="field"><label for="ixr-ref">Flourish</label><select class="input" id="ixr-ref">${LIB.ORNAMENTS.filter((x) => x.kind !== 'corner').map((x) => `<option value="${x.id}" ${(o.ref || cal.orn[slotK]) === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>` : ''}
        ${slider('scale', 'Size', o.scale || 1, 0.2, 3, 0.05, pct)}
        ${slider('rot', 'Turn', o.rot || 0, -180, 180, 1, (v) => v + '°')}
        ${slider('opacity', 'Transparency', 1 - (o.opacity != null ? o.opacity : 1), 0, 0.9, 0.05, pct)}
        <div class="field"><span class="lbl">Colour</span>${inkSwatches(o.ink || (id.startsWith('corner-') ? cal.paper.borderInk || cal.inks.flourish : cal.inks.flourish), 'data-oink')}</div>
        <div class="row"><button type="button" class="btn sm" id="ixr-reset">↺ Put back</button><button type="button" class="btn sm danger" id="ixr-del">✕ Remove</button></div>`;
    } else {
      const o = elOf(id), txt = textOf(id), sc0 = FN.scriptOf(txt), sc = sc0 === 'other' ? 'latn' : sc0;
      const r = ST.STYLE[cal.style].type[IXC.roleOf(id)];
      body = `${specsOf(id).map((sp) => fieldHtml(sp, 'ixr-', 'data-rf')).join('')}
        ${base(id) === 'rsvpLink' ? '<p class="tiny muted">This is your invitation’s web address. It fills in by itself once the invitation is published.</p>' : ''}
        ${sc0 === 'other' ? `<p class="notice small">${esc(IXC.WARN_TEXT.other)}</p>` : ''}
        <div class="field"><label for="ixr-f">Font (${esc(FN.SCRIPT_NAME[sc])})</label><select class="input" id="ixr-f" data-fsel="${sc}">${fontOptions(sc, curFont(id, sc))}</select></div>
        ${slider('size', 'Size', o.size || 1, 0.4, 2.2, 0.05, pct)}
        ${slider('tracking', 'Letter spacing', o.tracking != null ? o.tracking : r.tracking || 0, -2, 14, 0.5, (v) => v)}
        ${slider('leading', 'Line height', o.leading || r.leading || 1.25, 0.8, 2, 0.05, (v) => (+v).toFixed(2))}
        ${slider('width', 'Line width', o.width || 1, 0.5, 1, 0.05, pct)}
        <div class="field"><span class="lbl">Alignment</span><div class="seg ixc-seg">${[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']].map(([v, l]) => `<label><input type="radio" name="ral" value="${v}" ${(o.align || 'center') === v ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
        <div class="field"><span class="lbl">Ink</span>${inkSwatches(o.ink || cal.inks[IXC.inkOf(id)], 'data-tink')}</div>
        <div class="row"><button type="button" class="btn sm" id="ixr-reset">↺ Put back</button><button type="button" class="btn sm" id="ixr-hide">Hide this line</button></div>`;
    }
    if (base(id) === 'names') body += '<div class="row"><button type="button" class="btn sm" id="ixr-reset">↺ Put back</button></div>';
    r.innerHTML = head + `<div class="ixc-rb">${body}</div>`;
    wireRight(r, id);
  }
  function wireRight(r, id) {
    const cal = S.inv.calligraphy, o = addedOf(id) || elOf(setOf(id)), pos = addedOf(id) || elOf(id);
    r.querySelector('[data-x]').onclick = () => select(null);
    r.querySelectorAll('[data-sl]').forEach((s) => (s.oninput = () => {
      const k = s.dataset.sl; let v = +s.value;
      if (k === 'opacity') v = Math.round((1 - v) * 100) / 100;
      o[k] = v;
      const out = r.querySelector(`[data-out="${k}"]`);
      if (out) out.textContent = k === 'rot' ? s.value + '°' : ['size', 'scale', 'width', 'sizeBride', 'sizeGroom', 'opacity'].includes(k) ? pct(+s.value) : k === 'leading' ? (+s.value).toFixed(2) : s.value;
      changed();
    }));
    const fsel = r.querySelector('[data-fsel]');
    if (fsel) fsel.onchange = () => { o[fontKey(fsel.dataset.fsel)] = fsel.value; if (fsel.dataset.fsel === 'latn') { delete o.w; delete o.italic; } changed({ fonts: true }); };
    const ifs = r.querySelector('#ixr-if'); if (ifs) ifs.onchange = () => { o.initialFont = ifs.value; changed({ fonts: true }); };
    r.querySelectorAll('input[name=ral]').forEach((x) => (x.onchange = () => { o.align = x.value; changed(); }));
    r.querySelectorAll('input[name=rnl]').forEach((x) => (x.onchange = () => { cal.nameLayout = x.value; changed(); }));
    r.querySelectorAll('input[name=rini]').forEach((x) => (x.onchange = () => { cal.initials = x.value; if (x.value === 'flourished') { cal.orn.initialFlourish = true; cal.orn.sprig = true; } changed({ fonts: true }); }));
    const amp = r.querySelector('#ixr-amp'); if (amp) amp.oninput = () => { o.amp = amp.value.trim(); changed(); };
    r.querySelectorAll('[data-name]').forEach((inp) => (inp.oninput = () => { S.inv.text[S.lang] = S.inv.text[S.lang] || {}; S.inv.text[S.lang][inp.dataset.name] = inp.value; changed({ fonts: FN.scriptOf(inp.value) !== 'latn' }); }));
    wireFields(r, 'data-rf');
    wireInkRow(r, 'data-nb', (v) => { o.inkBride = v; changed({ right: true }); });
    wireInkRow(r, 'data-ng', (v) => { o.inkGroom = v; changed({ right: true }); });
    wireInkRow(r, 'data-ni', (v) => { o.inkInitials = v; changed({ right: true }); });
    wireInkRow(r, 'data-oink', (v) => { o.ink = v; changed({ right: true }); });
    wireInkRow(r, 'data-tink', (v) => { o.ink = v; changed({ right: true }); });
    const ref = r.querySelector('#ixr-ref'); if (ref) ref.onchange = () => { o.ref = ref.value; changed(); };
    const reset = r.querySelector('#ixr-reset');
    if (reset) reset.onclick = () => {
      const a = addedOf(id);
      if (a) { a.scale = 1; a.rot = 0; a.opacity = 1; } else [o, pos].forEach((x) => ['dx', 'dy', 'rot', 'scale', 'size', 'tracking', 'leading', 'width', 'align', 'opacity', 'sizeBride', 'sizeGroom'].forEach((k) => delete x[k]));
      changed({ right: true });
    };
    const del = r.querySelector('#ixr-del'); if (del) del.onclick = () => removeOrn(id);
    const hide = r.querySelector('#ixr-hide'); if (hide) hide.onclick = () => { pos.hidden = true; select(null); changed(); IX.toast('Line hidden. Undo brings it back, or use Restore original layout.'); };
  }

  /* ---------------- downloads ---------------- */
  let exporting = false;
  async function openDownloads() {
    if (!S || exporting) return;
    const inv = S.inv, cal = inv.calligraphy, w = IXC.words(inv, S.lang, false).w;
    await save();
    if (!w.bride && !w.groom) { IX.toast('Add the names first. Downloads never include the sample names.', 'err', 5000); return; }
    const pages = ST.pagesOn(cal), z = ST.SIZES[cal.size] || ST.SIZES['5x7'];
    const pxW = Math.round(z.mm[0] / 25.4 * 300), pxH = Math.round(pxW * z.h / z.w);
    const pageName = ST.PAGES.find(([id]) => id === S.pageId)[1];
    const opt = (v, t, d) => `<button type="button" class="ixc-dlo" data-dl="${v}"><b>${t}</b><small>${d}</small></button>`;
    const v = await H.modal({
      title: 'Download your card',
      body: `${inv.languages.length > 1 ? `<p class="small">In <b>${esc(LANG_NAME[S.lang] || S.lang)}</b>. Switch language at the top of the studio for another.</p>` : ''}
        <div class="ixc-dl">
          ${opt('png', `Picture of this page (PNG): ${esc(pageName)}`, `${pxW} × ${pxH} px, 300 dpi. Best for WhatsApp and printing at home.`)}
          ${opt('jpeg', `Picture of this page (JPG): ${esc(pageName)}`, 'Same size, smaller file.')}
          ${pages.length > 1 ? opt('zip', `All ${pages.length} pages as pictures (ZIP)`, 'One PNG for each page.') : ''}
          ${opt('pdf', `PDF, ${pages.length === 1 ? 'one page' : 'all ' + pages.length + ' pages'}`, `${esc(z.name)} pages. To share, email or print at home.`)}
          ${opt('print', 'Print file for a print shop (PDF)', `${esc(z.name)} with 3 mm bleed on every side and crop marks.`)}
        </div>
        <p class="tiny muted">Pages are drawn again at full size, not screenshotted. Lettering is made from the licensed font files as sharp outlines, flourishes stay sharp at any size, and the paper texture is printed at 300 dpi. Gold, bronze and copper print as gold-coloured ink from an ordinary printer; this is not metallic foil. If you want real foil, ask your print shop and give them the print file.</p>
        ${cal.pages && Object.values(cal.pages).includes(false) ? '<p class="tiny muted">Pages you switched off are left out.</p>' : ''}`,
      actions: [{ label: 'Close', value: '' }],
      onOpen: (m, done) => m.querySelectorAll('[data-dl]').forEach((b) => (b.onclick = () => done(b.dataset.dl))),
    });
    if (!v || !S) return;
    exporting = true;
    const btn = document.getElementById('ixDl'); if (btn) btn.disabled = true;
    status('Preparing download…');
    const E = IXC.exporter;
    try {
      const r = v === 'png' || v === 'jpeg' ? await E.image(inv, { page: S.pageId, lang: S.lang, type: v })
        : v === 'zip' ? await E.zip(inv, { lang: S.lang, progress: (n) => status(`Page ${n} of ${pages.length}…`) })
        : await E.pdf(inv, { lang: S.lang, print: v === 'print', progress: (n) => status(`Page ${n} of ${pages.length}…`) });
      IX.download(r.name, r.blob);
      IX.toast(`Downloaded ${r.name}`, 'ok', 4000);
    } catch (e) {
      console.warn(e);
      IX.toast('Could not make the download: ' + e.message, 'err', 6000);
    } finally {
      exporting = false; if (btn) btn.disabled = false;
      if (S) status(S.saved ? 'Saved' : 'Saving…');
    }
  }

  /* ---------------- small cards for galleries ---------------- */
  /** A mini SVG of a style with this invitation's own names. */
  async function thumbFor(inv, styleId, lang) {
    const t = IX.deepClone(inv);
    t.calligraphy = ST.newDesign(styleId);
    ST.fillWords(t, lang || t.defaultLang || 'en');
    const tt = t.text[lang || t.defaultLang || 'en'];
    // keep thumbnails short: names, heading and the date only
    ['message', 'reception', 'rsvpNote', 'blessing', 'brideParents', 'groomParents'].forEach((k) => { tt[k] = ''; });
    if (t.events && t.events[0]) { t.events[0] = { ...t.events[0], address: '', city: '' }; }
    const r = await IXC.render(t, { lang, placeholders: true, uid: 'th' + styleId.replace(/\W/g, '') + Math.random().toString(36).slice(2, 5) });
    return r.svg;
  }

  // restoreLayout also clears "hidden" lines
  IXC.studio = { start, thumbFor, matchGuestPage };
})();
