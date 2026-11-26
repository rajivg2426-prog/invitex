/* InviteX creation wizard with live preview. */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model, esc = IX.esc, H = window.H;
  const STEPS = ['Design', 'Fill your card', 'Share'];
  const NSTEPS = STEPS.length;
  // One line per step telling the host what to do here and what comes next.
  const STEP_HELP = [
    'Pick what you are celebrating, then choose a ready design, upload your own, or let AI paint one. You can change this later.',
    'Choose a message style, then fill in the names, date and place. Tip: you can also click any line on the card preview and type right there.',
    'Pick your link name, publish, and send it on WhatsApp.',
  ];
  // Friendly list of event locations for the time zone (the full world list was confusing).
  const TZ_CHOICES = [
    ['Asia/Kolkata', 'India'], ['Asia/Kathmandu', 'Nepal'], ['Asia/Dubai', 'UAE / Dubai'], ['Asia/Riyadh', 'Saudi Arabia / Kuwait / Qatar'],
    ['Asia/Singapore', 'Singapore / Malaysia'], ['Europe/London', 'United Kingdom'], ['Europe/Berlin', 'Germany / France / Italy'],
    ['America/New_York', 'USA – East coast / Toronto'], ['America/Chicago', 'USA – Central'], ['America/Los_Angeles', 'USA – West coast / Vancouver'],
    ['Australia/Sydney', 'Australia – Sydney / Melbourne'], ['Pacific/Auckland', 'New Zealand'],
  ];
  // Plain-language description of each font offered (every one is loaded from Google Fonts).
  const FONT_INFO = {
    'Great Vibes': 'Elegant script', Parisienne: 'Graceful script', Allura: 'Fine script', Pacifico: 'Playful', Satisfy: 'Handwritten',
    'Kaushan Script': 'Brush script', 'Yatra One': 'Festive · Hindi too', 'Dancing Script': 'Lively script', Kalam: 'Handwritten · Hindi too',
    'Cormorant Garamond': 'Classic serif', 'Playfair Display': 'Elegant serif', Montserrat: 'Clean modern', Poppins: 'Rounded modern', Merriweather: 'Sturdy serif',
    'Baloo 2': 'Friendly rounded', 'Bebas Neue': 'Bold capitals', 'Space Grotesk': 'Techy', 'Tiro Devanagari Hindi': 'Traditional · Hindi', Lora: 'Soft serif',
    Lato: 'Clear sans', Inter: 'Neutral sans', Nunito: 'Soft rounded', Mukta: 'Clear · Hindi too', 'Source Sans 3': 'Plain sans',
  };
  const LANGS = window.IX_LANGS;
  let W = null;

  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] = a[k] || {}), o); t[last] = v; };

  H.routes.edit = async (v, id, step) => {
    const inv = await H.store.getInvitation(id);
    if (!inv) { H.render('<div class="card"><h2>Invitation not found</h2><a class="btn" href="#/">Back</a></div>'); return; }
    normalise(inv);
    W = { inv, step: IX.clamp(IX.int(step, 1), 1, NSTEPS), lang: inv.defaultLang, pv: 'mobile', pvLang: null, saving: false, ready: false, pvOpener: false, pvZoom: 1, pvPage: 'cover' };
    H.render(`
      <div class="wiz-head">
        <div><h1 id="wTitle">${esc(H.title(inv))}</h1><span class="save-state" id="saveState" aria-live="polite">All changes saved</span></div>
        <div class="row"><div class="hist" role="group" aria-label="Undo and redo"><button type="button" class="btn sm ghost iconbtn" id="undoBtn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>${H.icon ? H.icon('undo') : '↶'}</button><button type="button" class="btn sm ghost iconbtn" id="redoBtn" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled>${H.icon ? H.icon('redo') : '↷'}</button></div>
          <span class="pill ${inv.status}" id="wStatus"></span><a class="btn sm" href="#/dash/${esc(inv.id)}">📊 RSVP dashboard</a></div>
      </div>
      <div class="wiz">
        <div class="wiz-main">
          <nav class="steps" aria-label="Steps">${STEPS.map((s, i) => `<button type="button" class="step-tab" data-step="${i + 1}"><span class="n">${i + 1}</span>${esc(s)}</button>`).join('')}</nav>
          <div id="stepBody"></div>
          <div class="wiz-foot no-print">
            <button class="btn" id="prevBtn" aria-label="Back">←<span class="lbl-long"> Back</span></button>
            <button class="btn ghost" id="draftBtn" aria-label="Save draft">💾<span class="lbl-long"> Save draft</span></button>
            <button class="btn foot-pv" id="fabPv" aria-label="Preview your card">👁<span class="lbl-long"> Preview</span></button>
            <button class="btn primary" id="nextBtn">Next →</button>
          </div>
        </div>
        <aside class="wiz-preview" id="pvPane" aria-label="Live preview">
          <div class="pv-tools"><div class="seg" role="group" aria-label="Preview size"><button type="button" data-pv="mobile" class="on" aria-pressed="true">📱 Mobile</button><button type="button" data-pv="desktop" aria-pressed="false">🖥 Desktop</button></div>
            <div class="pv-acts"><div class="pv-zoom" role="group" aria-label="Zoom"><button type="button" class="btn sm ghost iconbtn" data-zoom="-1" aria-label="Zoom out" title="Zoom out">−</button><span id="pvZoomVal" aria-live="polite">100%</span><button type="button" class="btn sm ghost iconbtn" data-zoom="1" aria-label="Zoom in" title="Zoom in">+</button></div>
              <button type="button" class="btn sm ghost iconbtn" id="pvFull" title="Full-screen preview" aria-label="Full-screen preview">⤢</button></div></div>
          <div class="pv-pages" role="group" aria-label="Preview page"><button type="button" class="pv-arrow" data-pg-step="-1" aria-label="Previous page">‹</button>${PV_PAGES.map(([id, l]) => `<button type="button" class="pv-page" data-pg="${id}" aria-pressed="false">${l}</button>`).join('')}<button type="button" class="pv-arrow" data-pg-step="1" aria-label="Next page">›</button></div>
          <div class="pv-frame" id="pvFrame"><iframe id="pvIframe" title="Live preview of the invitation" src="invite.html?preview=1"></iframe></div>
          <div class="pv-note"><span id="pvSample" class="pv-sample" hidden>Sample names and dates are shown until you add yours.</span>
            <span class="tiny muted">Live preview · RSVP is disabled here · <button type="button" class="linkbtn" id="replayOpen" title="Show the opening animation guests see first">▶ Play opening</button></span></div>
          <button class="btn pv-close" id="pvClose">✕ Close preview</button>
        </aside>
      </div>
      `);
    const iframe = document.getElementById('pvIframe');
    const onMsg = (e) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === 'ix-preview-ready') { W.ready = true; pushPreview(); }
      if (e.data?.type === 'ix-preview-lang') W.pvLang = e.data.lang;
      if (e.data?.type === 'ix-preview-opened') W.pvOpener = false;
      if (e.data?.type === 'ix-preview-page') pvMarkPage(PV_PAGES.find((p) => p[2].includes(e.data.id))?.[0] || W.pvPage);
      if (e.data?.type === 'ix-preview-goto-done' && !e.data.found) IX.toast('That page is turned off on this card. You can turn it on in step 2.');
      // typing directly on the card in the preview
      if (e.data?.type === 'ix-edit') {
        const { key, lang, value } = e.data;
        if (!W.inv.text[lang] || typeof value !== 'string' || !TEXT_KEYS.includes(key)) return;
        W.inv.text[lang][key] = value;
        const f = document.getElementById('tf-' + key);
        if (f && W.lang === lang && document.activeElement !== f) f.value = value;
        changed(true, false);
        if (key === 'title' && value.trim()) { const n = document.getElementById('pvSample'); if (n) n.hidden = true; }
      }
      if (e.data?.type === 'ix-edit-focus') focusField(e.data.key, e.data.lang, e.data.inline);
    };
    window.addEventListener('message', onMsg);
    histInit();
    v.querySelector('#undoBtn').onclick = undo;
    v.querySelector('#redoBtn').onclick = redo;
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return;
      const t = e.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return; // let fields undo their own typing
      e.preventDefault();
      if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
    };
    document.addEventListener('keydown', onKey);
    const onLeave = (e) => { if (W && W.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    H.cleanup.push(() => { window.removeEventListener('message', onMsg); window.removeEventListener('beforeunload', onLeave); document.removeEventListener('keydown', onKey); if (W && W.hist) clearTimeout(W.hist.timer); const w = W; (w && w.dirty ? save() : Promise.resolve()).then(() => emptyTrash(w)); });
    v.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => goStep(+b.dataset.step)));
    v.querySelector('#prevBtn').onclick = () => goStep(W.step - 1);
    v.querySelector('#nextBtn').onclick = () => (W.step < NSTEPS ? goStep(W.step + 1) : publish());
    v.querySelector('#draftBtn').onclick = async () => { await save(); IX.toast('Draft saved', 'ok'); };
    v.querySelectorAll('[data-pv]').forEach((b) => (b.onclick = () => {
      W.pv = b.dataset.pv;
      v.querySelectorAll('[data-pv]').forEach((x) => x.classList.toggle('on', x === b));
      document.getElementById('pvFrame').classList.toggle('desktop', W.pv === 'desktop');
    }));
    v.querySelector('#replayOpen').onclick = () => { W.pvOpener = true; pvMarkPage('cover'); pushPreview(); };
    const pane = v.querySelector('#pvPane');
    const pvOpen = (full) => { pane.classList.add('open'); pane.classList.toggle('full', !!full); pane.setAttribute('role', 'dialog'); pane.setAttribute('aria-modal', 'true'); document.body.classList.add('pv-locked'); pane.querySelector('#pvClose').focus(); };
    const pvClose = () => { if (!pane.classList.contains('open')) return; pane.classList.remove('open', 'full'); pane.removeAttribute('role'); pane.removeAttribute('aria-modal'); document.body.classList.remove('pv-locked'); };
    v.querySelector('#fabPv').onclick = () => pvOpen(false);
    v.querySelector('#pvFull').onclick = () => (pane.classList.contains('open') ? pvClose() : pvOpen(true));
    v.querySelector('#pvClose').onclick = pvClose;
    const onEsc = (e) => { if (e.key === 'Escape') pvClose(); };
    document.addEventListener('keydown', onEsc);
    H.cleanup.push(() => { document.removeEventListener('keydown', onEsc); document.body.classList.remove('pv-locked'); });
    v.querySelectorAll('[data-zoom]').forEach((b) => (b.onclick = () => {
      W.pvZoom = Math.round(IX.clamp(W.pvZoom + 0.1 * +b.dataset.zoom, 0.6, 1.4) * 10) / 10;
      v.querySelector('#pvZoomVal').textContent = Math.round(W.pvZoom * 100) + '%';
      pvPost({ type: 'ix-preview-zoom', zoom: W.pvZoom });
    }));
    v.querySelectorAll('[data-pg]').forEach((b) => (b.onclick = () => pvGoto(b.dataset.pg)));
    v.querySelectorAll('[data-pg-step]').forEach((b) => (b.onclick = () => {
      const i = PV_PAGES.findIndex((p) => p[0] === W.pvPage);
      pvGoto(PV_PAGES[IX.clamp(i + +b.dataset.pgStep, 0, PV_PAGES.length - 1)][0]);
    }));
    pvMarkPage('cover');
    iframe.addEventListener('load', () => setTimeout(() => { pushPreview(); if (W.pvZoom !== 1) pvPost({ type: 'ix-preview-zoom', zoom: W.pvZoom }); }, 50));
    goStep(W.step);
  };

  function normalise(inv) {
    const base = M.newInvitation(inv.category, inv.theme);
    inv.design = Object.assign(base.design, inv.design || {});
    inv.design.sections = Object.assign(base.design.sections, inv.design.sections || {});
    IXT.SECTIONS.forEach((s) => { if (!inv.design.sectionOrder.includes(s.id)) inv.design.sectionOrder.push(s.id); });
    inv.settings = Object.assign(base.settings, inv.settings || {});
    inv.media = Object.assign(base.media, inv.media || {});
    inv.contact = inv.contact || { name: '', phone: '' };
    inv.highlights = inv.highlights || [];
    inv.hostsList = inv.hostsList || [];
    inv.text = inv.text || {};
    inv.languages.forEach((l) => (inv.text[l] = Object.assign({}, base.text.en, inv.text[l] || {})));
  }

  /* ---------- saving & preview ---------- */
  /* The preview's pages: Cover, Invitation, Events, RSVP. Each jumps to the first of its sections that is on the card. */
  const PV_PAGES = [
    ['cover', 'Cover', ['opening']],
    ['invite', 'Invitation', ['welcome', 'hosts', 'message']],
    ['events', 'Events', ['schedule', 'countdown', 'venue', 'highlights']],
    ['rsvp', 'RSVP', ['rsvp', 'instructions', 'thankyou']],
  ];
  const pvPost = (msg) => { const f = document.getElementById('pvIframe'); if (f && f.contentWindow) f.contentWindow.postMessage(msg, location.origin); };
  function pvMarkPage(id) {
    W.pvPage = id;
    document.querySelectorAll('[data-pg]').forEach((b) => { const on = b.dataset.pg === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    const i = PV_PAGES.findIndex((p) => p[0] === id);
    const [pr, nx] = document.querySelectorAll('[data-pg-step]');
    if (pr) pr.disabled = i <= 0;
    if (nx) nx.disabled = i >= PV_PAGES.length - 1;
  }
  function pvGoto(id) {
    const p = PV_PAGES.find((x) => x[0] === id); if (!p) return;
    if (W.pvOpener) { W.pvOpener = false; pushPreview(); }
    pvMarkPage(id);
    setTimeout(() => pvPost({ type: 'ix-preview-goto', ids: p[2] }), W.pvOpener ? 120 : 0);
  }
  /* Before the host has typed their own details, the preview shows realistic sample ones
   * (only in the preview copy, never saved), so they can see the finished card straight away. */
  const SAMPLE_DETAILS = {
    wedding: { host: 'The Sharma & Kapoor families', venue: 'The Leela Palace', city: 'Udaipur' },
    engagement: { host: 'The Mehta & Rao families', venue: 'Taj Lands End', city: 'Mumbai' },
    birthday: { host: 'Neha & Arjun', venue: 'Fun Zone Party Hall', city: 'Pune' },
    anniversary: { host: 'Their children & grandchildren', venue: 'The Oberoi', city: 'New Delhi' },
    housewarming: { host: 'The Verma family', venue: 'Our new home, Sector 21', city: 'Chandigarh' },
    religious: { host: 'The Iyer family', venue: 'Shri Ram Mandir Hall', city: 'Bengaluru' },
    festival: { host: 'The Thakur family', venue: 'Community Hall', city: 'Mandi' },
    corporate: { host: 'Acme India Pvt Ltd', venue: 'Conference Room 3, Tower B', city: 'Gurugram' },
    conference: { host: 'InnovateX', venue: 'Jio World Convention Centre', city: 'Mumbai' },
    launch: { host: 'Acme India', venue: 'The Grand Ballroom', city: 'Bengaluru' },
    school: { host: 'Springfield Public School', venue: 'School Auditorium', city: 'Jaipur' },
    farewell: { host: 'Your colleagues', venue: 'The Clubhouse', city: 'Hyderabad' },
    community: { host: 'Green Park Residents Association', venue: 'Society Clubhouse', city: 'Noida' },
    custom: { host: 'Your hosts', venue: 'The Venue', city: 'Your city' },
  };
  function withSamples(inv, lang) {
    const t = inv.text[lang] || (inv.text[lang] = {});
    const keys = [];
    if (!(inv.calligraphy && inv.calligraphy.active !== false) && !String(t.title || '').trim()) {
      const d = SAMPLE_DETAILS[inv.category] || SAMPLE_DETAILS.custom;
      t.title = SAMPLE_NAME[inv.category] || 'You are invited'; keys.push('title');
      if (!String(t.hostName || '').trim()) { t.hostName = d.host; keys.push('hostName'); }
      if (!(inv.events || []).some((e) => e.date)) {
        const ev = inv.events[0] || (inv.events[0] = M.newEvent('Main Event'));
        const dt = new Date(Date.now() + 60 * 86400e3);
        ev.date = dt.toISOString().slice(0, 10);
        if (!ev.venue) ev.venue = d.venue;
        if (!ev.city) ev.city = d.city;
        keys.push('events');
      }
    }
    return keys;
  }
  const pushPreview = () => {
    const f = document.getElementById('pvIframe');
    if (!f || !f.contentWindow || !W) return;
    const inv = IX.deepClone(W.inv);
    // the writing studio can show a version on the card before it is used
    if (W.pvWording) { inv.text[W.pvWording.lang] = Object.assign({}, inv.text[W.pvWording.lang], W.pvWording.fields); }
    const lang = W.pvWording ? W.pvWording.lang : W.pvLang || W.lang;
    const samples = withSamples(inv, lang);
    const note = document.getElementById('pvSample'); if (note) note.hidden = !samples.length;
    // Show the card itself, not the closed opening screen, unless the host asked to play the opening.
    f.contentWindow.postMessage({ type: 'ix-preview', inv, lang, samples, opened: !W.pvOpener }, location.origin);
  };
  const debouncedPreview = IX.debounce(pushPreview, 250);
  const debouncedSave = IX.debounce(() => save(), 700);
  async function save() {
    if (!W || W.saving) { if (W) W.pendingSave = true; return; }
    W.saving = true;
    const st = document.getElementById('saveState');
    if (st) st.textContent = 'Saving…';
    try {
      const saved = await H.store.saveInvitation(W.inv);
      if (saved && saved.id !== W.inv.id) { W.inv.id = saved.id; history.replaceState(null, '', `#/edit/${saved.id}/${W.step}`); }
      W.dirty = false;
      if (st) st.textContent = 'All changes saved · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      if (st) st.textContent = '⚠ Not saved: ' + e.message;
      IX.toast(e.message, 'bad', 5000);
    }
    W.saving = false;
    updateStatus();
    if (W.pendingSave) { W.pendingSave = false; save(); }
  }
  function changed(rerenderTitle = true, preview = true) {
    W.dirty = true;
    histSoon();
    const st = document.getElementById('saveState');
    if (st) st.textContent = 'Unsaved changes…';
    if (rerenderTitle) { const t = document.getElementById('wTitle'); if (t) t.textContent = H.title(W.inv); }
    debouncedSave();
    if (preview) debouncedPreview();
  }
  /* ---------- undo / redo ----------
   * Every change is snapshotted (after a short pause, so a typed word is one step).
   * Files taken off the card are only deleted when the host leaves the editor, so
   * undo can always bring a photo back. */
  const HIST_MAX = 60;
  const KEEP = ['id', 'status', 'published', 'publishedAt', 'createdAt', 'updatedAt'];
  const snap = (inv) => { const o = { ...inv }; KEEP.forEach((k) => delete o[k]); return JSON.stringify(o); };
  function histInit() { W.hist = { past: [], future: [], last: snap(W.inv), timer: 0 }; W.trash = new Set(); }
  function histRecord() {
    const h = W && W.hist; if (!h || W.applying) return;
    clearTimeout(h.timer); h.timer = 0;
    const s = snap(W.inv);
    if (s === h.last) return;
    h.past.push(h.last); if (h.past.length > HIST_MAX) h.past.shift();
    h.last = s; h.future = [];
    histButtons();
  }
  const histSoon = () => { const h = W && W.hist; if (!h || W.applying) return; clearTimeout(h.timer); h.timer = setTimeout(histRecord, 600); };
  function histApply(s) {
    const o = JSON.parse(s);
    Object.keys(W.inv).forEach((k) => { if (!KEEP.includes(k)) delete W.inv[k]; });
    Object.assign(W.inv, o);
    normalise(W.inv);
    if (!W.inv.languages.includes(W.lang)) W.lang = W.inv.defaultLang;
    W.bgUrl = undefined; W.pvWording = null;
    W.applying = true; changed(); W.applying = false;
    goStep(W.step); pushPreview(); histButtons();
  }
  function undo() { histRecord(); const h = W.hist; if (!h.past.length) return; h.future.push(h.last); h.last = h.past.pop(); histApply(h.last); IX.toast('Undone'); }
  function redo() { histRecord(); const h = W.hist; if (!h.future.length) return; h.past.push(h.last); h.last = h.future.pop(); histApply(h.last); IX.toast('Redone'); }
  function histButtons() {
    const u = document.getElementById('undoBtn'), r = document.getElementById('redoBtn');
    if (u) u.disabled = !W.hist.past.length && snap(W.inv) === W.hist.last;
    if (r) r.disabled = !W.hist.future.length;
  }
  // Take a file off the card now; delete it for good only when it is no longer used on leaving.
  function discard(ref) { if (ref && W) W.trash.add(ref); return Promise.resolve(); }
  function emptyTrash(w) {
    if (!w || !w.trash || !w.trash.size) return;
    const used = new Set(M.mediaRefs(w.inv));
    w.trash.forEach((ref) => { if (!used.has(ref)) H.store.deleteMedia(ref).catch(() => {}); });
    w.trash.clear();
  }

  const TEXT_KEYS = ['title', 'subtitle', 'hostName', 'familyName', 'welcome', 'message', 'instructions', 'extraInfo', 'thankyou'];
  // Show (and for the main message, open) the form field matching a line clicked on the card.
  function focusField(key, lang, inline) {
    if (!TEXT_KEYS.includes(key)) return;
    if (!inline) {
      if (W.step !== 2) goStep(2);
      if (lang && lang !== W.lang && W.inv.languages.includes(lang)) { W.lang = lang; goStep(2); }
    }
    if (key === 'message') {
      const d = document.getElementById('fpMessage');
      if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); setTimeout(() => { d.scrollIntoView({ block: 'start', behavior: 'smooth' }); if (!inline) document.getElementById('rte')?.focus(); }, 60); }
      return;
    }
    if ((key === 'instructions' || key === 'extraInfo')) { const m = document.querySelector('details.more-text'); if (m) m.open = true; }
    const f = document.getElementById('tf-' + key);
    if (!f) return;
    const box = f.closest('.field');
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
    if (!inline) f.focus({ preventScroll: true });
  }
  function updateStatus() {
    const s = document.getElementById('wStatus');
    if (!s) return;
    const dirty = H.hasUnpublished(W.inv);
    s.className = 'pill ' + (W.inv.status === 'published' ? (dirty ? 'maybe' : 'published') : 'draft');
    s.textContent = W.inv.status === 'published' ? (dirty ? 'Published · unpublished edits' : '● Published') : 'Draft';
  }

  function goStep(n) {
    if (n < 1 || n > NSTEPS) return;
    W.step = n;
    history.replaceState(null, '', `#/edit/${W.inv.id}/${n}`);
    document.querySelectorAll('.step-tab').forEach((b) => { const s = +b.dataset.step; b.classList.toggle('on', s === n); b.classList.toggle('done', s < n); b.setAttribute('aria-current', s === n ? 'step' : 'false'); });
    document.getElementById('prevBtn').disabled = n === 1;
    const nb = document.getElementById('nextBtn');
    nb.textContent = n === NSTEPS ? (W.inv.status === 'published' ? '🚀 Update published invitation' : '🚀 Publish invitation') : 'Next →';
    nb.className = 'btn ' + (n === NSTEPS ? 'gold' : 'primary');
    updateStatus();
    if (n < NSTEPS) nb.textContent = `Next: ${STEPS[n]} →`;
    const body = document.getElementById('stepBody');
    [null, step1, stepFill, step6][n](body);
    body.insertAdjacentHTML('afterbegin', `<div class="step-guide"><span class="sg-n">Step ${n} of ${NSTEPS}</span><span>${esc(STEP_HELP[n - 1])}</span></div>`);
    document.querySelector('.step-tab.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // generic binding for [data-k]
  function bind(root) {
    root.querySelectorAll('[data-k]').forEach((el) => {
      const k = el.dataset.k;
      const val = getPath(W.inv, k);
      if (el.type === 'checkbox') el.checked = !!val; else if (val != null) el.value = val;
      el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color' ? 'change' : 'input', () => {
        let v = el.type === 'checkbox' ? el.checked : el.value;
        if (el.dataset.type === 'int') v = Math.max(0, IX.int(v, 0));
        if (el.dataset.type === 'float') v = parseFloat(v) || 1;
        setPath(W.inv, k, v);
        changed();
        if (el.dataset.rerender) goStep(W.step);
      });
    });
  }

  /* ---------- Step 1: design ----------
   * One clear question, "How would you like to design your card?", with three ways:
   * a gallery of ready designs (drawn as small cards), upload your own design, or AI.
   * Only the chosen way is shown, so nothing important is hidden far down the page. */
  const SAMPLE_NAME = { wedding: 'Priya & Rohan', engagement: 'Ananya & Kabir', birthday: 'Riya turns 5', anniversary: '25 Happy Years', housewarming: 'Griha Pravesh', religious: 'Shri Satyanarayan Puja', festival: 'Family Get-together', corporate: 'Team Meeting', conference: 'Summit 2026', launch: 'Launch Day', school: 'Annual Day', farewell: 'Happy Retirement', community: 'Community Meet', custom: 'You are invited' };
  const DESIGN_WAYS = [
    ['ready', '🎨', 'Ready designs', 'Pick one of ours'],
    ['own', '🖼️', 'Your own design', 'Upload a picture'],
    ['ai', '✨', 'Design with AI', 'New art for you'],
    ['callig', '✒️', 'Calligraphy', 'Handwritten look'],
  ];
  const calligOn = (inv) => !!(inv.calligraphy && inv.calligraphy.active !== false && window.IXC);
  /* Calligraphy & Handwritten Invitations: the 10 styles as live mini cards with the host's own names. */
  function calligPanel(inv) {
    if (!window.IXC) return '<p class="small muted">Calligraphy Studio could not load. Please refresh the page.</p>';
    const on = calligOn(inv), cur = inv.calligraphy && inv.calligraphy.style;
    return `${on ? `<div class="callig-on"><span class="ixc-thumb" data-cthumb="${esc(cur)}" data-own="1"></span><div class="stack" style="gap:.6rem"><b>✓ Your card uses ${esc(IXC.styles.STYLE[cur] ? IXC.styles.STYLE[cur].name : 'Calligraphy')}</b>
        <p class="small muted" style="margin:0">Change the words, fonts, inks, paper and flourishes in Calligraphy Studio.</p>
        <a class="btn primary" href="#/calligraphy/${esc(inv.id)}">✒ Open Calligraphy Studio</a></div></div><h3 style="margin:.4rem 0 0;font-size:15px">Or start from another style</h3>` : `<p class="small muted" style="margin:0">Invitations that look professionally handwritten: artistic calligraphy for the names, flourishes, handmade paper and gold-coloured ink. Pick a style to open Calligraphy Studio. You can change everything there.</p>`}
      <div class="callig-grid" role="list">${IXC.styles.STYLES.map((s) => `<button type="button" role="listitem" class="callig-tile ${on && s.id === cur ? 'on' : ''}" data-callig="${s.id}"><span class="ixc-thumb" data-cthumb="${s.id}"></span><b>${esc(s.name)}</b><small>${esc(s.blurb)}</small></button>`).join('')}</div>`;
  }
  function wireCallig(body) {
    const inv = W.inv;
    body.querySelectorAll('[data-cthumb]').forEach(async (el) => {
      try {
        el.innerHTML = el.dataset.own ? (await IXC.render(inv, { lang: inv.defaultLang, placeholders: true, uid: 'own' })).svg : await IXC.studio.thumbFor(inv, el.dataset.cthumb, inv.defaultLang);
      } catch (e) { console.error(e); }
    });
    body.querySelectorAll('[data-callig]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.callig, inv2 = W.inv;
      if (calligOn(inv2) && inv2.calligraphy.style !== id && !(await H.confirm('Switch to this style?', 'Fonts, inks, paper and flourishes change to the new style. Your words stay.', 'Switch style'))) return;
      if (calligOn(inv2) && inv2.calligraphy.style === id) return H.go('#/calligraphy/' + inv2.id);
      if (inv2.media.background) removePicture();
      await save();
      await IXC.studio.start(inv2, id);
    }));
  }
  // A small drawing of a ready design, built from the same colours and illustrations as the real card.
  function miniCard(id, inv, name) {
    const t = IXT.THEMES[id], p = t.palettes[id === inv.theme ? inv.paletteIndex : 0] || t.palettes[0], mo = IXT.motif(t.motif, p);
    return `<span class="mini mini-${t.motif}" style="--mbg:${p.bg};--mbg2:${p.bg2};--mtx:${p.text};--mac:${p.accent}" aria-hidden="true">
      ${mo.top ? `<span class="mini-top">${mo.top}</span>` : ''}
      ${mo.hero ? `<span class="mini-hero">${mo.hero}</span>` : ''}
      ${mo.corner ? `<span class="mini-c tl">${mo.corner}</span><span class="mini-c tr">${mo.corner}</span>` : ''}
      <span class="mini-txt"><small>You are invited</small><b style="font-family:'${t.fonts.script}',cursive">${esc(name)}</b><span class="mini-div">${mo.divider}</span><small>Sat · 14 Feb</small></span></span>`;
  }

  function step1(body) {
    const inv = W.inv;
    if (W.bgUrl === undefined) { W.bgUrl = ''; if (inv.media.background) H.store.resolveMedia(inv.media.background).then((u) => { W.bgUrl = u || ''; if (W.step === 1 && u) step1(body); }); }
    if (!W.way) W.way = calligOn(inv) ? 'callig' : inv.design.aiArt ? 'ai' : inv.media.background ? 'own' : 'ready';
    if (!W.galTab) W.galTab = IXGallery.TAB_FOR_CAT[inv.category] || 'all';
    const guide = body.querySelector('.step-guide')?.outerHTML || '';
    const cat = IXT.CATEGORIES.find((c) => c.id === inv.category);
    const themeIds = Object.keys(IXT.THEMES).sort((a, b) => (a === cat.theme ? -1 : b === cat.theme ? 1 : 0));
    const th = IXT.THEMES[inv.theme];
    const name = M.txt(inv, inv.defaultLang, 'title') || SAMPLE_NAME[inv.category] || 'You are invited';
    const hasPic = !!inv.media.background;
    const picNote = hasPic && W.way === 'ready'
      ? `<p class="notice small" style="margin:0">Your own picture is on the card now. Tap a ready design below to use it instead.</p>` : '';
    const panels = {
      ready: `${picNote}${describeBox()}
        <div class="gal-tabs" role="tablist" aria-label="Occasion">${IXGallery.TABS.filter(([t]) => t === 'all' || t === 'calligraphy' || themeIds.some((id) => IXGallery.inTab(id, t))).map(([t, l]) => `<button type="button" role="tab" aria-selected="${t === W.galTab}" class="gal-tab ${t === W.galTab ? 'on' : ''}" data-gal-tab="${t}">${esc(l)}</button>`).join('')}</div>
        ${W.galTab === 'calligraphy' ? calligPanel(inv) : ''}<div class="design-grid" role="radiogroup" aria-label="Ready designs" ${W.galTab === 'calligraphy' ? 'hidden' : ''}>${themeIds.filter((id) => IXGallery.inTab(id, W.galTab)).map((id) => {
        const on = id === inv.theme && !hasPic && !calligOn(inv), t = IXT.THEMES[id], meta = IXGallery.META[id] || {};
        return `<div class="design-tile ${on ? 'on' : ''}"><button type="button" class="design-pick ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-theme-pick="${id}">
          ${miniCard(id, inv, name)}<span class="dp-name">${esc(t.name.replace(' (blank)', ''))}<span class="dp-style">${esc(meta.style || '')}</span>${id === cat.theme ? '<small>Best for ' + esc(cat.name) + '</small>' : ''}</span>${on ? '<span class="dp-tick" aria-hidden="true">✓</span>' : ''}</button>
          <div class="dp-pals" role="group" aria-label="${esc(t.name)} colours">${t.palettes.map((p, i) => `<button type="button" class="dp-pal ${on && i === inv.paletteIndex ? 'on' : ''}" data-theme-pick="${id}" data-pal-pick="${i}" title="${esc(p.name)}" aria-label="${esc(t.name)}, ${esc(p.name)}"><i style="background:linear-gradient(135deg,${p.bg} 50%,${p.accent} 50%)"></i></button>`).join('')}</div></div>`;
      }).join('')}</div>`,
      own: `<p class="small muted" style="margin:0">Use a card someone designed for you, a painting or a photo. It fills the whole card and your names, date and place are written on top.</p>
        ${W.bgUrl ? `<div class="own-done"><div class="own-prev" style="background-image:url('${esc(W.bgUrl)}')" role="img" aria-label="Your card picture"></div>
            <div class="stack" style="gap:.6rem"><b>✓ Your picture is on the card</b>
              <label class="btn">⇄ Choose a different picture<input type="file" hidden accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" id="artIn"></label>
              <button class="btn danger" id="artDel">✕ Remove it</button></div></div>
            <div class="field"><span class="lbl">How should it look?</span><div class="seg" role="radiogroup"><label><input type="radio" name="bgMode" value="full" data-bgmode ${inv.design.bgMode !== 'soft' ? 'checked' : ''}>Full picture</label><label><input type="radio" name="bgMode" value="soft" data-bgmode ${inv.design.bgMode === 'soft' ? 'checked' : ''}>Faint, in the background</label></div></div>`
          : `<label class="drop-zone"><input type="file" hidden accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" id="artIn">
              <span class="dz-ic" aria-hidden="true">⬆</span><b>Tap to choose your picture</b><span class="small muted">JPG, PNG or WebP from your phone or computer</span></label>`}
        <p class="tiny muted" style="margin:0">Tip: a tall picture works best. Leave some plain space in the middle so your words are easy to read. You can move and zoom it after choosing.</p>`,
      ai: `<div class="stack ai-card" id="aiCard"></div>`,
      callig: `<div class="stack">${window.IXC ? calligPanel(inv) : ''}</div>`,
    };
    body.innerHTML = `${guide}<div class="card stack">
      <h2>1. What are you celebrating?</h2>
      <div class="cat-grid cat-chips" role="radiogroup" aria-label="Event type">${IXT.CATEGORIES.map((c) => `<button type="button" class="cat ${c.id === inv.category ? 'on' : ''}" role="radio" aria-checked="${c.id === inv.category}" data-cat="${c.id}"><span class="ic" aria-hidden="true">${c.icon}</span>${esc(c.name)}</button>`).join('')}</div>
    </div>
    <div class="card stack" id="designCard">
      <h2>2. How would you like to design your card?</h2>
      <div class="ways" role="tablist" aria-label="Ways to design your card">${DESIGN_WAYS.map(([id, ic, t, s]) => `<button type="button" class="way ${W.way === id ? 'on' : ''}" role="tab" aria-selected="${W.way === id}" data-way="${id}"><span class="way-ic" aria-hidden="true">${ic}</span><b>${t}</b><small>${s}</small></button>`).join('')}</div>
      <div class="way-panel stack" role="tabpanel">${panels[W.way]}</div>
    </div>
    <div class="card stack">
      <h2>3. Colours &amp; shape</h2>
      <div class="swatches" role="radiogroup" aria-label="Colour theme">${th.palettes.map((p, i) => `<button type="button" class="swatch ${i === inv.paletteIndex ? 'on' : ''}" role="radio" aria-checked="${i === inv.paletteIndex}" data-pal="${i}"><i style="background:linear-gradient(135deg,${p.bg} 50%,${p.accent} 50%)"></i>${esc(p.name)}</button>`).join('')}</div>
      <div class="seg" role="radiogroup" aria-label="Card shape">${[['portrait', 'Tall (best for phones)'], ['landscape', 'Wide'], ['square', 'Square']].map(([l, n]) => `<label><input type="radio" name="layout" value="${l}" ${inv.layout === l ? 'checked' : ''}>${n}</label>`).join('')}</div>
      <p class="tiny muted" style="margin:0">You can fine-tune fonts and colours later in step 2.</p>
    </div>`;
    body.querySelectorAll('[data-way]').forEach((b) => (b.onclick = () => { W.way = b.dataset.way; step1(body); }));
    const artIn = body.querySelector('#artIn');
    if (artIn) artIn.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const ref = await IXMedia.addImage(f, { invId: inv.id, askCrop: true, aspect: '3:4', maxDim: 1800 });
      if (!ref) return;
      if (inv.media.background) discard(inv.media.background);
      inv.media.background = ref; inv.design.bgMode = 'full'; inv.design.aiArt = ''; W.bgUrl = await H.store.resolveMedia(ref);
      changed(); step1(body);
      fetch(W.bgUrl).then((r) => r.blob()).then(matchPaletteTo).catch(() => {}); // light picture → dark text, and the other way round
      IX.toast('Your picture is on the card. Tap Preview to see it.', 'ok', 4000);
    };
    const del = body.querySelector('#artDel');
    if (del) del.onclick = () => { removePicture(); step1(body); };
    body.querySelectorAll('[data-bgmode]').forEach((r) => (r.onchange = () => { inv.design.bgMode = r.value; changed(); }));
    body.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
      const c = IXT.CATEGORIES.find((x) => x.id === b.dataset.cat);
      inv.category = c.id;
      W.galTab = IXGallery.TAB_FOR_CAT[c.id] || 'all';
      const untouched = inv.events.every((e) => !e.date && !e.venue);
      if (untouched) inv.events = [M.newEvent(c.main || c.events[0])];
      // fresh wording for the new event type, unless the host has written their own
      if (window.IXStudio && IXStudio.untouched(inv)) { IXStudio.notes(inv).style = IXCopy.defaultStyle(c.id); inv.languages.forEach((l) => IXStudio.fillDefault(inv, l)); }
      if (!inv.media.background) { setTheme(c.theme); IX.toast(`Design set to “${IXT.THEMES[c.theme].name}”. You can pick any other below.`); }
      changed(); step1(body);
    }));
    body.querySelectorAll('[data-theme-pick]').forEach((b) => (b.onclick = async () => {
      // A ready design replaces the host's own or AI picture (AI designs stay in "earlier designs").
      if (inv.media.background && !inv.design.aiArt && !(await H.confirm('Use this ready design?', 'Your own picture will be taken off the card. You can upload it again any time.', 'Use ready design'))) return;
      if (calligOn(inv) && !(await H.confirm('Use this ready design?', 'Your calligraphy design will be taken off the card. It is kept, so you can switch back from the Calligraphy choice any time.', 'Use ready design'))) return;
      if (inv.calligraphy) inv.calligraphy.active = false;
      if (inv.media.background) removePicture();
      setTheme(b.dataset.themePick);
      if (b.dataset.palPick != null) { inv.paletteIndex = +b.dataset.palPick; Object.assign(inv.design, { textColor: '', bgColor: '', accentColor: '' }); }
      changed(); step1(body);
    }));
    body.querySelectorAll('[data-gal-tab]').forEach((b) => (b.onclick = () => { W.galTab = b.dataset.galTab; step1(body); }));
    wireDescribe(body);
    if (W.way === 'callig' || W.galTab === 'calligraphy') wireCallig(body);
    body.querySelectorAll('[data-pal]').forEach((b) => (b.onclick = () => { inv.paletteIndex = +b.dataset.pal; Object.assign(inv.design, { textColor: '', bgColor: '', accentColor: '' }); changed(); step1(body); }));
    body.querySelectorAll('input[name=layout]').forEach((r) => (r.onchange = () => { inv.layout = r.value; changed(); }));
    renderAi(body);
  }
  /* "Describe your card": finds the closest ready designs and colours for a few words,
   * and can hand the same words to the AI painter. */
  function describeBox() {
    const D = (W.desc = W.desc || { text: '', result: null });
    const inv = W.inv, r = D.result;
    const aiName = r && r.aiStyle ? (AI_STYLES.find((x) => x.id === r.aiStyle) || {}).name : '';
    const colName = r ? ((AI_COLORS.find(([id]) => id === r.aiColors) || [])[1] || '') : '';
    return `<div class="describe">
      <label class="lbl" for="descIn">Describe the card you want <span class="tiny muted">(optional)</span></label>
      <div class="describe-row"><textarea class="input" id="descIn" rows="2" maxlength="240" placeholder="e.g. An elegant Indian wedding card with an ivory background, champagne-gold lettering, floral borders and a royal feel">${esc(D.text)}</textarea>
        <button type="button" class="btn primary" id="descGo">Find designs</button></div>
      ${r ? (r.understood ? `<div class="describe-out" aria-live="polite">
        <span class="lbl">Closest ready designs</span>
        <div class="describe-picks">${r.designs.map((d) => { const t = IXT.THEMES[d.theme], p = t.palettes[d.palette] || t.palettes[0]; const on = inv.theme === d.theme && inv.paletteIndex === d.palette && !inv.media.background; return `<button type="button" class="describe-pick ${on ? 'on' : ''}" data-theme-pick="${d.theme}" data-pal-pick="${d.palette}"><i style="background:linear-gradient(135deg,${p.bg} 50%,${p.accent} 50%)"></i><span><b>${esc(t.name.replace(' (blank)', ''))}</b><small>${esc(p.name)}${d.hits.length ? ' · matches “' + esc(d.hits.join(', ')) + '”' : ''}</small></span>${on ? '<em>On your card</em>' : ''}</button>`; }).join('')}</div>
        <div class="describe-ai"><span>Want new artwork instead? AI can paint it${aiName ? ` in the <b>${esc(aiName)}</b> style` : ''}${colName && r.aiColors !== 'auto' ? ` with <b>${esc(colName.toLowerCase())}</b>` : ''}.</span><button type="button" class="btn sm" id="descAi">✨ Paint with AI</button></div>
      </div>` : '<p class="small muted" style="margin:0">Try a few words about colours, style or mood, like “pastel floral” or “modern navy”.</p>') : ''}
    </div>`;
  }
  function wireDescribe(body) {
    const D = W.desc, go = body.querySelector('#descGo'), inp = body.querySelector('#descIn');
    if (!go) return;
    inp.oninput = () => (D.text = inp.value);
    inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go.click(); } };
    go.onclick = () => {
      D.text = inp.value;
      if (!D.text.trim()) { inp.focus(); return; }
      D.result = IXGallery.suggest(D.text, W.inv.category);
      W.galTab = 'all';
      step1(body);
      body.querySelector('.describe-out, .describe p')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const ai = body.querySelector('#descAi');
    if (ai) ai.onclick = () => {
      const r = D.result;
      W.ai = Object.assign(W.ai || { style: null, colors: 'auto', words: '', busy: false, results: [], recent: null, credits: null, error: '', picking: '' },
        { style: r.aiStyle || W.ai?.style || null, colors: r.aiColors || 'auto', words: r.words.slice(0, 120) });
      W.way = 'ai'; step1(body);
      document.getElementById('designCard')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
  }
  function removePicture() {
    const inv = W.inv;
    if (inv.media.background) discard(inv.media.background);
    inv.media.background = ''; inv.design.aiArt = ''; W.bgUrl = '';
    changed();
  }
  /* ---------- Design with AI (step 1) ----------
   * The user picks a ready style + colours (+ a few optional words). The server step
   * (supabase/functions/generate-card-art) builds the full prompt, paints 4 backgrounds
   * and keeps them in the user's folder. Picking one makes it the card background. */
  const AI_STYLES = [
    { id: 'royal', icon: '👑', name: 'Royal', hint: 'Rajasthani palace arches & peacocks', g: '#5b0f1f,#c9962f' },
    { id: 'floral', icon: '🌸', name: 'Floral', hint: 'Soft watercolour flowers', g: '#f7d6d8,#cfe0c8' },
    { id: 'temple', icon: '🛕', name: 'Temple', hint: 'Gopuram, diyas & banana leaves', g: '#b8421f,#e9b23c' },
    { id: 'minimal', icon: '✨', name: 'Minimal', hint: 'Ivory paper & fine gold', g: '#fbf6ec,#d9c08a' },
    { id: 'mehndi', icon: '🌿', name: 'Mehndi', hint: 'Henna patterns & marigolds', g: '#e8891c,#4f7a32' },
    { id: 'pichwai', icon: '🪷', name: 'Pichwai', hint: 'Lotus pond, cows, traditional art', g: '#1f5c5a,#e7a1b0' },
    { id: 'birthday', icon: '🎈', name: 'Birthday', hint: 'Balloons, confetti & cute animals', g: '#8fd3f4,#ffd166' },
    { id: 'corporate', icon: '💼', name: 'Corporate', hint: 'Modern waves & gold lines', g: '#10213f,#b99a55' },
  ];
  const AI_COLORS = [
    ['auto', 'Best for the style', 'conic-gradient(#b5455c,#d4a557,#3f7a5a,#3b5ba5,#b5455c)'], ['maroon-gold', 'Maroon & gold', '#6b1426,#d4a557'],
    ['pink-peach', 'Pink & peach', '#f4b6c2,#ffd3b0'], ['emerald-gold', 'Emerald & gold', '#0f5a43,#d8b464'], ['royal-blue', 'Royal blue', '#1d3c8f,#dfe6f5'],
    ['ivory-gold', 'Ivory & gold', '#fbf3e4,#c9a15a'], ['saffron-yellow', 'Saffron', '#f08a1c,#f6cf3f'], ['purple-lavender', 'Purple', '#5b2a86,#c9b6e8'], ['teal-coral', 'Teal & coral', '#16747a,#f28b6b'],
  ];
  const AI_FOR_CAT = { wedding: 'royal', engagement: 'floral', birthday: 'birthday', anniversary: 'minimal', housewarming: 'pichwai', religious: 'temple', festival: 'mehndi', corporate: 'corporate', conference: 'corporate', launch: 'corporate', school: 'floral', farewell: 'minimal', community: 'floral', custom: 'floral' };
  const grad = (g) => (g.startsWith('conic') ? g : `linear-gradient(135deg,${g})`);

  function renderAi(stepBody) {
    const el = stepBody.querySelector('#aiCard');
    if (!el) return;
    const inv = W.inv, store = H.store;
    const A = (W.ai = W.ai || { style: null, colors: 'auto', words: '', busy: false, results: [], recent: null, credits: null, error: '', picking: '' });
    const style = A.style || AI_FOR_CAT[inv.category] || 'royal';
    if (!store.aiAvailable) {
      el.innerHTML = `<h3 style="margin:0">✨ Let AI paint your card</h3><p class="small muted" style="margin:0">AI designs work in the online version once you are signed in. In this demo copy, choose “Ready designs” or “Your own design” above.</p>`;
      return;
    }
    if (A.credits === null) { A.credits = false; store.aiCredits().then((c) => { A.credits = c; renderAi(stepBody); }).catch(() => { A.credits = { left: null }; renderAi(stepBody); }); }
    if (A.recent === null) { A.recent = []; store.aiRecent().then((r) => { A.recent = r; renderAi(stepBody); }).catch(() => {}); }
    const c = A.credits || {};
    const left = c.left;
    const none = left === 0;
    const thumb = (u) => `<button type="button" class="ai-pick ${inv.design.aiArt === u ? 'on' : ''}" data-ai-use="${esc(u)}" ${A.picking ? 'disabled' : ''} aria-label="Use this design">
        <span class="ai-img" style="background-image:url('${esc(u)}')"></span>
        <span class="ai-use">${A.picking === u ? 'Applying…' : inv.design.aiArt === u ? '✓ On your card' : 'Use this design'}</span></button>`;
    const older = (A.recent || []).filter((u) => !A.results.includes(u));
    el.innerHTML = `
      <div class="row between"><h3 style="margin:0">✨ Let AI paint your card</h3>
        <span class="pill ai-left" id="aiLeft">${left == null ? '' : none ? 'No free tries left' : `${left} free ${left === 1 ? 'try' : 'tries'} left`}</span></div>
      <p class="small muted" style="margin:0">Choose a style and colours. AI paints 4 new background designs just for you, and your names and details are placed on top.</p>
      <div class="field"><span class="lbl">Style</span>
        <div class="ai-styles" role="radiogroup" aria-label="AI design style">${AI_STYLES.map((s) => `<button type="button" role="radio" aria-checked="${s.id === style}" class="ai-style ${s.id === style ? 'on' : ''}" data-ai-style="${s.id}">
          <span class="ai-sw" style="background:${grad(s.g)}" aria-hidden="true">${s.icon}</span><b>${esc(s.name)}${s.id === AI_FOR_CAT[inv.category] ? ' <small>Suggested</small>' : ''}</b><small>${esc(s.hint)}</small></button>`).join('')}</div></div>
      <div class="field"><span class="lbl">Colours</span>
        <div class="ai-colors" role="radiogroup" aria-label="AI design colours">${AI_COLORS.map(([id, name, g]) => `<button type="button" role="radio" aria-checked="${id === A.colors}" class="ai-color ${id === A.colors ? 'on' : ''}" data-ai-color="${id}"><i style="background:${grad(g)}"></i>${esc(name)}</button>`).join('')}</div></div>
      <label class="field"><span class="lbl">Anything special? <span class="tiny muted">(optional, a few words)</span></span>
        <input class="input" id="aiWords" maxlength="120" placeholder="e.g. elephants and lotus flowers, Ganesha motif, mountains" value="${esc(A.words)}"></label>
      <div class="row"><button class="btn primary" id="aiGo" ${A.busy || none ? 'disabled' : ''}>${A.busy ? 'Painting…' : A.results.length ? '✨ Paint 4 more designs' : '✨ Paint 4 designs'}</button>
        <span class="tiny muted">${none ? 'You have used your free AI tries. You can still choose “Ready designs” or “Your own design” above.' : 'Each try paints 4 designs and takes about half a minute.'}</span></div>
      ${A.error ? `<p class="notice warn" role="alert" style="margin:0">${esc(A.error)}</p>` : ''}
      ${A.busy ? `<div class="ai-grid" aria-live="polite" aria-busy="true">${'<div class="ai-pick ai-wait"><span class="ai-img"></span></div>'.repeat(4)}</div><p class="small muted" style="margin:0;text-align:center">🎨 Painting your designs… please keep this page open.</p>` : ''}
      ${A.results.length && !A.busy ? `<div class="field"><span class="lbl">Tap a design to put it on your card</span><div class="ai-grid">${A.results.map(thumb).join('')}</div></div>` : ''}
      ${older.length ? `<details class="ai-older" ${A.results.length ? '' : 'open'}><summary class="small">Your earlier AI designs (${older.length})</summary><div class="ai-grid">${older.map(thumb).join('')}</div></details>` : ''}`;
    el.querySelectorAll('[data-ai-style]').forEach((b) => (b.onclick = () => { A.style = b.dataset.aiStyle; renderAi(stepBody); }));
    el.querySelectorAll('[data-ai-color]').forEach((b) => (b.onclick = () => { A.colors = b.dataset.aiColor; renderAi(stepBody); }));
    el.querySelector('#aiWords').oninput = (e) => (A.words = e.target.value);
    el.querySelector('#aiGo').onclick = async () => {
      A.busy = true; A.error = ''; A.style = style; renderAi(stepBody);
      try {
        const r = await store.aiGenerate({ style, colors: A.colors, category: inv.category, words: A.words });
        A.results = r.images || [];
        A.credits = { ...c, used: r.used, limit: r.limit, left: r.left };
      } catch (e) {
        A.error = e.message;
        if (e.code === 'no_credits') A.credits = { ...c, left: 0 };
      }
      A.busy = false;
      if (W.step === 1) renderAi(stepBody);
    };
    el.querySelectorAll('[data-ai-use]').forEach((b) => (b.onclick = () => useAiArt(b.dataset.aiUse, stepBody)));
  }

  // Copy the chosen painting into this invitation's media and make it the card background.
  async function useAiArt(url, stepBody) {
    const inv = W.inv, A = W.ai;
    if (inv.design.aiArt === url && inv.media.background) return;
    A.picking = url; renderAi(stepBody);
    try {
      const src = await (await fetch(url)).blob();
      const { blob } = await IX.compressImage(src, { maxDim: 1800, quality: 0.86 });
      const ref = await H.store.putMedia(blob, { name: 'ai-design.webp', invitationId: inv.id });
      if (inv.media.background) discard(inv.media.background);
      inv.media.background = ref; inv.design.bgMode = 'full'; inv.design.aiArt = url;
      matchPaletteTo(src);
      W.bgUrl = await H.store.resolveMedia(ref);
      A.picking = '';
      changed(); step1(stepBody);
      IX.toast('Design applied. Your names and details sit on top of it – see the preview.', 'ok', 4000);
    } catch (e) {
      A.picking = ''; A.error = 'Could not apply that design: ' + e.message; renderAi(stepBody);
    }
  }
  // Light painting → light colour theme (dark text); dark painting → dark theme, so the text panels blend in.
  async function matchPaletteTo(blob) {
    try {
      const u = URL.createObjectURL(blob); const img = await IX.loadImage(u); URL.revokeObjectURL(u);
      const c = document.createElement('canvas'); c.width = c.height = 24;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data; let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const light = sum / (d.length / 4) / 255 > 0.55;
      const lum = (hex) => { const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16); return isNaN(n) ? 0.5 : ((n >> 16) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722) / 255; };
      const pals = IXT.THEMES[W.inv.theme].palettes;
      if ((lum(pals[W.inv.paletteIndex].bg) > 0.55) === light) return;
      const i = pals.findIndex((p) => (lum(p.bg) > 0.55) === light);
      if (i >= 0) { W.inv.paletteIndex = i; Object.assign(W.inv.design, { textColor: '', bgColor: '', accentColor: '' }); changed(); if (W.step === 1) step1(document.getElementById('stepBody')); }
    } catch (e) { /* keep the current colours */ }
  }
  function setTheme(id) {
    const t = IXT.THEMES[id];
    W.inv.theme = id; W.inv.paletteIndex = 0;
    W.inv.design.fonts = { ...t.fonts };
    Object.assign(W.inv.design, { textColor: '', bgColor: '', accentColor: '' });
  }

  /* ---------- Step 2: fill your card (one page) ----------
   * Words, date & place are always open. Photos, the full message editor and the
   * look-and-feel options are folded panels, drawn the first time they are opened. */
  function stepFill(body) {
    const panel = (id, n, title, hint, open = false) => `<details class="fill-panel" id="${id}" ${open ? 'open' : ''}>
        <summary><span class="fp-n">${n}</span><span><b>${title}</b><small>${hint}</small></span></summary><div class="fp-body"></div></details>`;
    const g = window.IXWording ? IXWording.groupOf(W.inv.category) : '';
    body.innerHTML = `
      <div id="fpWords"></div>
      ${panel('fpPhotos', '＋', 'Photos, logo &amp; music', g === 'corp' ? 'Optional: speaker or company photos, logo, background music' : 'Optional: couple or family photos, gallery, logo, music, voice message')}
      ${panel('fpMessage', '✎', 'Main invitation message', 'Already written in your chosen style – open to read or change it')}
      ${panel('fpLook', '◐', 'Fonts, colours &amp; sections', 'Optional: fine-tune the look and choose which parts appear')}`;
    step3(body.querySelector('#fpWords'));
    const renderers = { fpPhotos: step2, fpMessage: step4, fpLook: step5 };
    body.querySelectorAll('.fill-panel').forEach((d) => {
      d.addEventListener('toggle', () => { if (d.open && !d.dataset.drawn) { d.dataset.drawn = '1'; renderers[d.id](d.querySelector('.fp-body')); } });
    });
  }

  /* ---------- photos & media ---------- */
  async function step2(body) {
    const inv = W.inv, m = inv.media;
    const refs = M.mediaRefs(inv);
    const U = {};
    await Promise.all(refs.map(async (r) => (U[r] = await H.store.resolveMedia(r))));
    const slot = (key, label, hint, kind = 'image') => {
      const ref = m[key];
      const u = ref ? U[ref] : '';
      const acc = kind === 'image' ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' : kind === 'audio' ? '.mp3,audio/mpeg' : '.mp4,video/mp4';
      const prev = kind === 'image' ? `<div class="prev" style="${u ? `background-image:url('${esc(u)}');${key === 'logo' ? 'background-size:contain' : ''}` : ''}">${u ? '' : '🖼'}</div>`
        : `<div class="prev">${kind === 'audio' ? '🎵' : '🎬'}</div>`;
      return `<div class="media-slot">${prev}<div class="stack" style="--gap:.4rem">
        <div><b>${esc(label)}</b><div class="tiny muted">${esc(hint)}</div></div>
        ${u && kind === 'audio' ? `<audio controls preload="none" src="${esc(u)}" style="width:100%"></audio>` : ''}
        ${u && kind === 'video' ? `<video controls preload="metadata" src="${esc(u)}" style="width:100%;max-height:180px;border-radius:8px"></video>` : ''}
        <div class="row"><label class="btn sm">${u ? '⇄ Replace' : '⬆ Upload'}<input type="file" hidden accept="${acc}" data-slot="${key}" data-kind="${kind}"></label>
        ${u && kind === 'image' ? `<button class="btn sm" data-recrop="${key}">✂ Crop</button>` : ''}
        ${u ? `<button class="btn sm danger" data-del="${key}">✕ Remove</button>` : ''}</div></div></div>`;
    };
    const listBlock = (arr, kind) => `<div class="thumbs">${arr.map((x, i) => `<div class="thumb">
        <div class="img" style="background-image:url('${esc(U[x.ref] || '')}')" role="img" aria-label="${esc(x.caption || x.name || 'photo ' + (i + 1))}"></div>
        ${kind === 'hosts' ? `<input placeholder="Name" aria-label="Name" value="${esc(x.name || '')}" data-li="${kind}.${i}.name"><input placeholder="Role e.g. Bride, Groom's parents" aria-label="Role" value="${esc(x.role || '')}" data-li="${kind}.${i}.role">`
          : `<input placeholder="Caption (optional)" aria-label="Caption" value="${esc(x.caption || '')}" data-li="${kind}.${i}.caption">`}
        <div class="tools"><button class="btn sm ghost" title="Move earlier" aria-label="Move earlier" data-mv="${kind}.${i}.-1">←</button><button class="btn sm ghost" title="Crop / reposition" aria-label="Crop" data-lcrop="${kind}.${i}">✂</button><label class="btn sm ghost" title="Replace" aria-label="Replace">⇄<input type="file" hidden accept=".jpg,.jpeg,.png,.webp" data-lrep="${kind}.${i}"></label><button class="btn sm ghost" title="Delete" aria-label="Delete" data-ldel="${kind}.${i}">✕</button><button class="btn sm ghost" title="Move later" aria-label="Move later" data-mv="${kind}.${i}.1">→</button></div>
      </div>`).join('')}</div>`;
    body.innerHTML = `
      <div class="card stack"><h2>Cover photo</h2>
        ${slot('cover', 'Main photo on the opening screen', 'Couple, host, birthday person or event poster. You will be able to crop it.')}
      </div>
      <div class="card stack"><h2>Hosts, couple &amp; family photos</h2>
        <div class="drop" tabindex="0" role="button" id="dzHosts"><span class="ic" aria-hidden="true">👨‍👩‍👧</span><b>Drag photos here or tap to choose</b><span class="tiny muted">JPG, PNG or WebP · each photo gets a name and role</span><input type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp"></div>
        ${listBlock(inv.hostsList, 'hosts')}
      </div>
      <div class="card stack"><h2>Photo gallery</h2>
        <div class="drop" tabindex="0" role="button" id="dzGallery"><span class="ic" aria-hidden="true">🖼</span><b>Drag several photos here or tap to choose</b><span class="tiny muted">Photos are automatically resized and compressed for fast loading</span><input type="file" hidden multiple accept=".jpg,.jpeg,.png,.webp"></div>
        <p class="upl-progress" id="uplProg" aria-live="polite"></p>
        ${listBlock(m.gallery, 'gallery')}
      </div>
      <div class="card stack"><h2>Logo</h2>
        ${slot('logo', 'Company / family logo', 'Shown small, in a round frame at the top of the card. A PNG with a transparent background works best.')}
      </div>
      <div class="card stack"><h2>Audio &amp; video</h2>
        ${slot('music', 'Background music (MP3)', 'Starts after the guest taps “Open Invitation”. Guests can pause it any time. Max 12 MB.', 'audio')}
        ${slot('voice', 'Voice welcome message (MP3)', 'A personal spoken invitation. Max 12 MB.', 'audio')}
        ${slot('video', 'Short video introduction (MP4)', 'Keep it under 1 minute. Max 40 MB.', 'video')}
        <p class="tiny muted">Audio and video files are stored as uploaded (browsers cannot compress them). Use short clips for fast loading. Only upload music you have the right to use.</p>
      </div>`;
    const rerender = () => step2(body);
    const aspectOf = (key) => ({ cover: '4:5', background: '3:4', logo: 'free' }[key] || '4:5');
    body.querySelectorAll('input[data-slot]').forEach((inp) => (inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const key = inp.dataset.slot, kind = inp.dataset.kind;
      const ref = kind === 'image' ? await IXMedia.addImage(f, { invId: inv.id, askCrop: true, aspect: aspectOf(key), keepAlpha: key === 'logo', maxDim: key === 'logo' ? 600 : 1600 }) : await IXMedia.addFile(f, kind, inv.id);
      if (!ref) return;
      if (m[key]) discard(m[key]);
      m[key] = ref; changed(); rerender();
    }));
    body.querySelectorAll('[data-recrop]').forEach((b) => (b.onclick = async () => {
      const key = b.dataset.recrop;
      const ref = await IXMedia.recrop(m[key], { aspect: aspectOf(key), keepAlpha: key === 'logo', invId: inv.id });
      if (ref) { m[key] = ref; changed(); rerender(); }
    }));
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      const key = b.dataset.del;
      discard(m[key]);
      m[key] = ''; changed(); rerender();
    }));
    const listOf = (kind) => (kind === 'hosts' ? inv.hostsList : m.gallery);
    const addMany = async (files, kind) => {
      const prog = body.querySelector('#uplProg');
      let n = 0;
      for (const f of files) {
        if (prog) prog.textContent = `Processing ${++n} of ${files.length}…`;
        const ref = await IXMedia.addImage(f, { invId: inv.id, maxDim: kind === 'hosts' ? 1000 : 1600 });
        if (ref) listOf(kind).push(kind === 'hosts' ? { ref, name: '', role: '' } : { ref, caption: '' });
      }
      if (kind === 'hosts' && inv.hostsList.length) inv.design.sections.hosts = true;
      if (kind === 'gallery' && m.gallery.length) inv.design.sections.gallery = true;
      changed(); rerender();
    };
    IXMedia.dropzone(body.querySelector('#dzHosts'), body.querySelector('#dzHosts input'), (fs) => addMany(fs, 'hosts'));
    IXMedia.dropzone(body.querySelector('#dzGallery'), body.querySelector('#dzGallery input'), (fs) => addMany(fs, 'gallery'));
    body.querySelectorAll('[data-li]').forEach((inp) => (inp.oninput = () => { const [k, i, f] = inp.dataset.li.split('.'); listOf(k)[+i][f] = inp.value; changed(); }));
    body.querySelectorAll('[data-mv]').forEach((b) => (b.onclick = () => {
      const [k, i, d] = b.dataset.mv.split('.'); const arr = listOf(k); const j = +i + +d;
      if (j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]]; changed(); rerender();
    }));
    body.querySelectorAll('[data-ldel]').forEach((b) => (b.onclick = async () => {
      const [k, i] = b.dataset.ldel.split('.'); const arr = listOf(k);
      discard(arr[+i].ref);
      arr.splice(+i, 1); changed(); rerender();
    }));
    body.querySelectorAll('[data-lcrop]').forEach((b) => (b.onclick = async () => {
      const [k, i] = b.dataset.lcrop.split('.'); const it = listOf(k)[+i];
      const ref = await IXMedia.recrop(it.ref, { aspect: k === 'hosts' ? '4:5' : 'free', invId: inv.id });
      if (ref) { it.ref = ref; changed(); rerender(); }
    }));
    body.querySelectorAll('[data-lrep]').forEach((inp) => (inp.onchange = async () => {
      const [k, i] = inp.dataset.lrep.split('.'); const it = listOf(k)[+i];
      const ref = await IXMedia.addImage(inp.files[0], { invId: inv.id, askCrop: true, aspect: k === 'hosts' ? '4:5' : 'free' });
      if (!ref) return;
      discard(it.ref);
      it.ref = ref; changed(); rerender();
    }));
  }

  /* ---------- Step 3: details & events ---------- */
  const TONE_FIELDS = ['familyName', 'subtitle', 'welcome', 'thankyou', 'message'];
  function langTabs(active, attr = 'data-lt') {
    return `<div class="ltabs" role="tablist">${W.inv.languages.map((l) => `<button type="button" role="tab" aria-selected="${l === active}" class="ltab ${l === active ? 'on' : ''}" ${attr}="${l}" lang="${l}">${esc(LANGS[l])}${l === W.inv.defaultLang ? ' ★' : ''}</button>`).join('')}</div>`;
  }
  function openStudio(body) {
    W.studio = true;
    IXStudio.open(body, {
      inv: W.inv, lang: W.lang, langs: LANGS, H, store: H.store,
      changed: () => changed(),
      preview: (fields, lang) => { W.pvWording = fields ? { fields, lang } : null; pushPreview(); if (fields && window.innerWidth < 1000) document.getElementById('pvPane')?.classList.add('open'); },
      close: () => { W.studio = false; W.pvWording = null; pushPreview(); step3(body); body.scrollIntoView && body.scrollIntoView({ block: 'start' }); },
    });
  }
  function step3(body) {
    if (W.studio && window.IXStudio) return openStudio(body);
    const inv = W.inv, L = W.lang;
    const cat = IXT.CATEGORIES.find((c) => c.id === inv.category);
    const tf = (k, label, ph = '', ta = false, req = false) => `<div class="field"><label for="tf-${k}">${esc(label)}${req ? ' *' : ''}</label>${ta ? `<textarea class="input" id="tf-${k}" lang="${L}" data-k="text.${L}.${k}" placeholder="${esc(ph)}" rows="3"></textarea>` : `<input class="input" id="tf-${k}" lang="${L}" data-k="text.${L}.${k}" placeholder="${esc(ph)}" ${req ? 'required' : ''}>`}${suggRow(k)}</div>`;
    const suggRow = (k) => {
      // lines covered by the "type of message" sets are not offered one by one any more
      if (window.IXStudio && TONE_FIELDS.includes(k)) return '';
      const list = window.IXSuggest ? IXSuggest.list(inv.category, L, k) : [];
      if (!list.length) return '';
      return `<div class="sugg" data-sugg="${k}"><span class="sugg-l">${IXSuggest.APPEND.includes(k) ? 'Tap to add:' : 'Suggestions:'}</span>${list.map((t, i) => `<button type="button" class="chip" data-sg="${k}.${i}" lang="${L}" title="Use this text">${esc(t)}</button>`).join('')}</div>`;
    };
    const tzs = TZ_CHOICES.some(([z]) => z === inv.timezone) ? TZ_CHOICES : [[inv.timezone, inv.timezone.replace(/_/g, ' ')], ...TZ_CHOICES];
    const cn = window.IXStudio ? IXStudio.notes(inv) : null;
    const st = cn && IXCopy.STYLE[cn.style];
    const studioEntry = cn ? `<div class="cs-entry">
        <div><b>Writing studio</b><span class="tiny muted">${st ? 'Current style: ' + esc(st.label.en) + ' · ' : ''}get 3–5 fresh versions of every line, compare, mix and edit</span></div>
        <div class="row"><button type="button" class="btn primary" id="openStudio">✦ Write my wording</button>${cn.history.length ? '<button type="button" class="btn sm ghost" id="undoWording" title="Bring back the wording you had before">↶ Undo last change</button>' : ''}</div>
      </div>` : '';
    body.innerHTML = `
      <div class="card stack"><h2>Words on your card</h2>
        ${langTabs(L)}
        ${studioEntry}
        <p class="tiny muted" style="margin:0">The fields are in the same order as they appear on the card, top to bottom.</p>
        ${tf('familyName', 'Small line at the top', 'e.g. Together with their families')}
        ${tf('title', cat.id === 'wedding' || cat.id === 'engagement' ? 'Names of the couple' : 'Event title', cat.id === 'wedding' ? 'Aarav & Diya' : 'e.g. Riya turns 5!', false, true)}
        ${tf('subtitle', 'Line under the names', cat.id === 'wedding' ? 'Invite you to celebrate their wedding' : 'e.g. You are invited')}
        ${tf('welcome', 'Welcome message', 'A warm line to greet your guests', true)}
        ${tf('hostName', 'Invited by (host names)', 'e.g. The Sharma Family')}
        ${tf('thankyou', 'Thank-you at the end', 'Your presence and blessings mean the world to us.', true)}
        <details class="more more-text"><summary>More text (optional): special instructions, extra information</summary>
          ${tf('instructions', 'Special instructions', 'Parking, gifts, timings, children…', true)}
          ${tf('extraInfo', 'Additional event information', 'Accommodation, travel, live stream…', true)}
        </details>
      </div>
      <div class="card stack"><div class="row between"><h2 style="margin:0">Date &amp; place</h2><span class="tiny muted">Add one event, or several (e.g. Mehendi, Wedding, Reception)</span></div>
        <div id="evList">${inv.events.map((e, i) => eventCard(e, i)).join('')}</div>
        <div class="row"><button class="btn" id="addEv">+ Add event</button>${cat.events.filter((n) => !inv.events.some((e) => e.name === n)).map((n) => `<button class="btn sm ghost" data-addev="${esc(n)}">+ ${esc(n)}</button>`).join('')}
          ${inv.category === 'wedding' ? ['Mehendi', 'Haldi', 'Sangeet', 'Wedding Ceremony', 'Reception'].filter((n) => !inv.events.some((e) => e.name === n) && !cat.events.includes(n)).map((n) => `<button class="btn sm ghost" data-addev="${n}">+ ${n}</button>`).join('') : ''}</div>
      </div>
      <details class="card more-details" ${W.moreOpen ? 'open' : ''}><summary><b>More details</b> <span class="tiny muted">– languages (हिन्दी / ਪੰਜਾਬੀ), country, contact person, dress code, menu or agenda</span></summary>
      <div class="stack sub"><h2>Languages</h2>
        <div class="row">${Object.entries(LANGS).map(([l, n]) => `<label class="check"><input type="checkbox" data-langtoggle="${l}" ${inv.languages.includes(l) ? 'checked' : ''}> <span lang="${l}">${esc(n)}</span></label>`).join('')}</div>
        <div class="field" style="max-width:260px"><label for="defLang">Default language (shown first)</label><select class="input" id="defLang">${inv.languages.map((l) => `<option value="${l}" ${l === inv.defaultLang ? 'selected' : ''}>${esc(LANGS[l])}</option>`).join('')}</select></div>
        <p class="tiny muted">Guests see a language switch at the top of the invitation. Write the text for each language yourself — nothing is machine-translated. Empty fields fall back to the default language.</p>
      </div>
      <div class="stack sub"><h2>General details</h2>
        <div class="grid2">
          <div class="field"><label for="tz">Country where the event takes place</label><select class="input" id="tz" data-k="timezone">${tzs.map(([z, n]) => `<option value="${esc(z)}" ${z === inv.timezone ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><span class="hint">Sets the event's clock. Guests abroad also see the time in their own zone.</span></div>
          <div class="field"><label for="dc">Dress code</label><input class="input" id="dc" data-k="dressCode" placeholder="e.g. Traditional / Formal"></div>
          <div class="field"><label for="cn">Contact person</label><input class="input" id="cn" data-k="contact.name" autocomplete="name"></div>
          <div class="field"><label for="cp">Contact mobile number</label><input class="input" id="cp" type="tel" data-k="contact.phone" placeholder="+91 98765 43210"><span class="hint">Shown to guests with Call and WhatsApp buttons.</span></div>
        </div>
      </div>
      <div class="stack sub"><h2>Highlights <span class="tiny muted">(optional – menu, agenda, speakers, activities)</span></h2>
        <div class="field" style="max-width:360px"><label for="hlT">Section heading</label><input class="input" id="hlT" data-k="highlightsTitle" placeholder="e.g. Traditional Dham Menu / Agenda"></div>
        <div id="hlList" class="stack">${inv.highlights.map((h, i) => `<div class="row"><input class="input" style="width:64px" aria-label="Icon" value="${esc(h.icon || '')}" data-hl="${i}.icon" maxlength="4"><input class="input grow" aria-label="Title" placeholder="Title" value="${esc(h.title || '')}" data-hl="${i}.title"><input class="input grow" aria-label="Description" placeholder="Short description" value="${esc(h.desc || '')}" data-hl="${i}.desc"><button class="btn sm danger" data-hldel="${i}" aria-label="Remove highlight">✕</button></div>`).join('')}</div>
        <button class="btn sm" id="addHl">+ Add highlight</button>
      </div>
      </details>`;
    bind(body);
    const md = body.querySelector('.more-details'); if (md) md.addEventListener('toggle', () => (W.moreOpen = md.open));
    // writing studio
    const os = body.querySelector('#openStudio');
    if (os) os.onclick = () => { openStudio(body); body.scrollIntoView && body.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    const uw = body.querySelector('#undoWording');
    if (uw) uw.onclick = async () => {
      const c = IXStudio.notes(inv), h = c.history[0];
      if (!h) return;
      const cur = Object.fromEntries(IXCopy.FIELDS.map((k) => [k, inv.text[h.lang]?.[k] || '']));
      Object.assign(inv.text[h.lang], h.fields);
      c.history.shift();
      c.history.unshift({ at: new Date().toISOString(), lang: h.lang, label: 'Before undo', fields: cur });
      c.applied[h.lang] = Object.assign({}, h.fields);
      changed(); step3(body); IX.toast('Previous wording is back', 'ok');
    };
    // ready-made wording: fills an empty field; never overwrites typed text without asking
    body.querySelectorAll('[data-sg]').forEach((b) => (b.onclick = async () => {
      const [k, i] = b.dataset.sg.split('.');
      const text = IXSuggest.list(inv.category, L, k)[+i];
      const el = body.querySelector(`#tf-${k}`);
      const cur = (inv.text[L][k] || '').trim();
      let next;
      if (!cur) next = text;
      else if (cur === text || cur.split('\n').map((x) => x.trim()).includes(text)) return IX.toast('Already added', 'ok');
      else if (IXSuggest.APPEND.includes(k)) next = cur + '\n' + text;
      else {
        const v = await H.modal({ title: 'Replace your text?', body: `<p>This field already has your own text:</p><blockquote class="sugg-q">${esc(cur)}</blockquote><p>Suggestion:</p><blockquote class="sugg-q">${esc(text)}</blockquote>`,
          actions: [{ label: 'Keep mine', value: 'keep' }, ...(el.tagName === 'TEXTAREA' ? [{ label: 'Add below', value: 'add' }] : []), { label: 'Replace', value: 'replace', cls: 'primary' }] });
        if (v === 'replace') next = text; else if (v === 'add') next = cur + '\n' + text; else return;
      }
      inv.text[L][k] = next; el.value = next; changed(); el.focus();
    }));
    body.querySelectorAll('[data-lt]').forEach((b) => (b.onclick = () => { W.lang = b.dataset.lt; W.pvLang = W.lang; step3(body); pushPreview(); }));
    body.querySelectorAll('[data-langtoggle]').forEach((c) => (c.onchange = () => {
      const l = c.dataset.langtoggle;
      if (c.checked) {
        inv.languages.push(l); inv.text[l] = Object.assign({}, M.newInvitation().text.en, inv.text[l] || {});
        // write the new language's wording natively in it (not translated), if it is still empty
        if (window.IXStudio && TONE_FIELDS.every((k) => !(inv.text[l][k] || '').trim())) IXStudio.fillDefault(inv, l);
      }
      else {
        if (inv.languages.length === 1) { c.checked = true; return IX.toast('At least one language is required', 'warn'); }
        inv.languages = inv.languages.filter((x) => x !== l);
        if (inv.defaultLang === l) inv.defaultLang = inv.languages[0];
        if (W.lang === l) W.lang = inv.defaultLang;
      }
      inv.languages.sort((a, b) => Object.keys(LANGS).indexOf(a) - Object.keys(LANGS).indexOf(b));
      changed(); step3(body);
    }));
    body.querySelector('#defLang').onchange = (e) => { inv.defaultLang = e.target.value; changed(); step3(body); };
    // events
    const evRerender = () => { body.querySelector('#evList').innerHTML = inv.events.map((e, i) => eventCard(e, i)).join(''); wireEvents(); };
    const wireEvents = () => {
      body.querySelectorAll('[data-ev]').forEach((inp) => (inp.oninput = () => {
        const [i, f] = inp.dataset.ev.split('.');
        inv.events[+i][f] = inp.value.trim() === '' ? '' : inp.value;
        if (f === 'mapUrl') { const ok = !inp.value || /^https:\/\//.test(inp.value); inp.setAttribute('aria-invalid', !ok); }
        if (['venue', 'address', 'city', 'pin', 'mapUrl'].includes(f)) refreshSuggest(+i);
        changed();
      }));
      wireSuggest(body);
      body.querySelectorAll('[data-main]').forEach((r) => (r.onchange = () => { inv.mainEventId = r.dataset.main; changed(); }));
      body.querySelectorAll('[data-evact]').forEach((b) => (b.onclick = async () => {
        const [act, i] = b.dataset.evact.split('.'); const n = +i;
        if (act === 'del') { if (inv.events.length === 1) return IX.toast('An invitation needs at least one event', 'warn'); inv.events.splice(n, 1); }
        if (act === 'up' && n > 0) [inv.events[n - 1], inv.events[n]] = [inv.events[n], inv.events[n - 1]];
        if (act === 'down' && n < inv.events.length - 1) [inv.events[n + 1], inv.events[n]] = [inv.events[n], inv.events[n + 1]];
        if (act === 'copy' && n > 0) { const p = inv.events[n - 1]; Object.assign(inv.events[n], { venue: p.venue, address: p.address, city: p.city, pin: p.pin, mapUrl: p.mapUrl }); }
        changed(); evRerender();
      }));
    };
    wireEvents();
    const addEv = (name) => { const prev = inv.events[inv.events.length - 1]; const e = M.newEvent(name); if (prev) e.date = prev.date; inv.events.push(e); changed(); step3(body); setTimeout(() => body.querySelector(`[data-ev="${inv.events.length - 1}.name"]`)?.focus(), 30); };
    body.querySelector('#addEv').onclick = () => addEv('');
    body.querySelectorAll('[data-addev]').forEach((b) => (b.onclick = () => addEv(b.dataset.addev)));
    // highlights
    body.querySelector('#addHl').onclick = () => { inv.highlights.push({ icon: '✦', title: '', desc: '' }); inv.design.sections.highlights = true; changed(); step3(body); };
    body.querySelectorAll('[data-hl]').forEach((inp) => (inp.oninput = () => { const [i, f] = inp.dataset.hl.split('.'); inv.highlights[+i][f] = inp.value; changed(); }));
    body.querySelectorAll('[data-hldel]').forEach((b) => (b.onclick = () => { inv.highlights.splice(+b.dataset.hldel, 1); changed(); step3(body); }));
  }
  function refreshSuggest(i) {
    const box = document.querySelector(`[data-msug="${i}"]`);
    if (!box) return;
    box.innerHTML = mapSuggest(W.inv.events[i], i);
    wireSuggest(box);
  }
  function wireSuggest(root) {
    root.querySelectorAll('[data-usemap]').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.usemap, e = W.inv.events[i];
      e.mapUrl = IX.mapsSearchUrl(e);
      const inp = document.querySelector(`[data-ev="${i}.mapUrl"]`);
      if (inp) { inp.value = e.mapUrl; inp.removeAttribute('aria-invalid'); }
      changed(); refreshSuggest(i); IX.toast('Maps link added', 'ok');
    }));
    root.querySelectorAll('[data-pvmap]').forEach((b) => (b.onclick = () => {
      const e = W.inv.events[+b.dataset.pvmap];
      const pv = b.closest('.map-suggest').querySelector('.map-pv');
      if (!pv.hidden) { pv.hidden = true; pv.innerHTML = ''; return; }
      pv.innerHTML = `<iframe title="Map preview" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(IX.mapsEmbedUrl(e))}" style="width:100%;height:220px;border:0;border-radius:10px;margin-top:.5rem"></iframe>`;
      pv.hidden = false;
    }));
  }
  function mapSuggest(e, i) {
    const url = IX.mapsSearchUrl(e);
    const pinBad = e.pin && !/^\d{6}$/.test(String(e.pin).trim());
    if (!url) return '<span class="tiny muted">📍 Type the venue, address and PIN code above and a Google Maps link will be proposed here.</span>';
    const using = e.mapUrl === url;
    return `<div class="tiny"><b>📍 Proposed Maps link</b> for <i>${esc(IX.venueText(e))}</i>${pinBad ? ' <span class="err">(Indian PIN codes have 6 digits)</span>' : ''}</div>
      <div class="row" style="margin-top:.35rem">
        <a class="btn sm" target="_blank" rel="noopener" href="${esc(url)}">🔎 Check on Google Maps</a>
        <button type="button" class="btn sm ${using ? '' : 'primary'}" data-usemap="${i}" ${using ? 'disabled' : ''}>${using ? '✔ Using this link' : '✓ Use this link'}</button>
        <button type="button" class="btn sm ghost" data-pvmap="${i}">🗺 Preview map</button>
      </div>
      <div class="map-pv" hidden></div>
      <div class="tiny muted" style="margin-top:.3rem">${e.mapUrl && !using ? 'You have your own link above – it will be used. ' : ''}If the pin is wrong, open Google Maps, find the exact place, tap Share → Copy link and paste it in the box above.</div>`;
  }
  function eventCard(e, i) {
    const f = (k, label, type = 'text', ph = '', extra = '') => `<div class="field"><label for="ev${i}${k}">${label}</label><input class="input" id="ev${i}${k}" type="${type}" data-ev="${i}.${k}" value="${esc(e[k] || '')}" placeholder="${esc(ph)}" ${extra}></div>`;
    return `<div class="ev-card"><div class="ev-head"><span class="n">${i + 1}</span><input class="input grow" aria-label="Event name" placeholder="Event name e.g. Mehendi" data-ev="${i}.name" value="${esc(e.name)}">
      <button class="btn sm ghost iconbtn" data-evact="up.${i}" aria-label="Move up">↑</button><button class="btn sm ghost iconbtn" data-evact="down.${i}" aria-label="Move down">↓</button><button class="btn sm ghost iconbtn danger" data-evact="del.${i}" aria-label="Delete event">✕</button></div>
      <div class="f3">${f('date', 'Date *', 'date')}${f('start', 'Start time', 'time')}${f('end', 'End time', 'time')}</div>
      <div class="f2 stack-sm" style="margin-top:.6rem">${f('venue', 'Venue name', 'text', 'e.g. The Grand Taj Hotel')}${f('address', 'Complete address', 'text', 'Street, area')}</div>
      <div class="f3" style="margin-top:.6rem">${f('city', 'City', 'text')}${f('pin', 'PIN code', 'text', '', 'inputmode="numeric" maxlength="10"')}${f('dressCode', 'Dress code', 'text', 'optional')}</div>
      <div class="f2 stack-sm" style="margin-top:.6rem">${f('mapUrl', 'Google Maps link (optional)', 'url', 'https://maps.app.goo.gl/…')}${f('notes', 'Note', 'text', 'optional')}</div>
      <div class="map-suggest" data-msug="${i}">${mapSuggest(e, i)}</div>
      <div class="row" style="margin-top:.4rem"><label class="check small"><input type="radio" name="mainEv" data-main="${esc(e.id)}" ${W.inv.mainEventId === e.id ? 'checked' : ''}> Main event (shown on the cover &amp; countdown)</label><span class="tiny muted">If no Maps link is given, directions use the address.</span>${i > 0 ? `<button class="btn sm ghost" data-evact="copy.${i}">Same venue as previous</button>` : ''}</div></div>`;
  }

  /* ---------- Step 4: message ---------- */
  function step4(body) {
    const inv = W.inv, L = W.lang;
    body.innerHTML = `<div class="card stack">
      <h2>Invitation message</h2>
      ${langTabs(L)}
      <div class="rte">
        <div class="rte-bar" role="toolbar" aria-label="Formatting">
          <button type="button" data-cmd="bold" aria-label="Bold"><b>B</b></button><button type="button" data-cmd="italic" aria-label="Italic"><i>I</i></button><button type="button" data-cmd="underline" aria-label="Underline"><u>U</u></button>
          <span class="sep"></span><button type="button" data-cmd="formatBlock" data-val="H3" aria-label="Heading">H</button><button type="button" data-cmd="formatBlock" data-val="P" aria-label="Paragraph">¶</button>
          <span class="sep"></span><button type="button" data-cmd="justifyLeft" aria-label="Align left">⯇</button><button type="button" data-cmd="justifyCenter" aria-label="Centre">≡</button><button type="button" data-cmd="justifyRight" aria-label="Align right">⯈</button>
          <span class="sep"></span><button type="button" data-cmd="insertUnorderedList" aria-label="Bullet list">•≡</button><button type="button" data-cmd="insertOrderedList" aria-label="Numbered list">1≡</button>
          <span class="sep"></span><select data-size aria-label="Text size"><option value="">Size</option><option value="2">Small</option><option value="3">Normal</option><option value="5">Large</option></select>
          <label class="btn sm ghost" style="min-height:34px" title="Text colour">🎨<input type="color" data-color value="#7a1f2e" style="width:28px;height:24px;border:0;padding:0" aria-label="Text colour"></label>
          <button type="button" data-cmd="removeFormat" aria-label="Clear formatting">⨯</button>
        </div>
        <div class="rte-body" id="rte" contenteditable="true" lang="${L}" role="textbox" aria-multiline="true" aria-label="Invitation message in ${esc(LANGS[L])}" data-placeholder="Write your invitation message here…"></div>
      </div>
      <p class="tiny muted">Typing in Hindi or Punjabi: use your phone keyboard's हिन्दी / ਪੰਜਾਬੀ layout, or a tool such as Google Input Tools on a computer. All Unicode languages are supported.</p>
    </div>
    <div class="card cs-entry">
      <div><b>Want different wording?</b><span class="tiny muted">The writing studio gives you 3–5 fresh versions of this message and every other line. Nothing changes until you choose.</span></div>
      <button type="button" class="btn" id="msgStudio">✦ Open the writing studio</button>
    </div>`;
    const rte = body.querySelector('#rte');
    rte.innerHTML = IX.sanitizeHTML(inv.text[L].message || '');
    const sync = () => { inv.text[L].message = IX.sanitizeHTML(rte.innerHTML); changed(); };
    rte.addEventListener('input', sync);
    rte.addEventListener('paste', (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertHTML', false, html ? IX.sanitizeHTML(html) : IX.nl2br(text));
    });
    body.querySelectorAll('[data-cmd]').forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); rte.focus(); document.execCommand(b.dataset.cmd, false, b.dataset.val || null); sync(); }));
    body.querySelector('[data-size]').onchange = (e) => { rte.focus(); if (e.target.value) document.execCommand('fontSize', false, e.target.value); e.target.value = ''; sync(); };
    body.querySelector('[data-color]').onchange = (e) => { rte.focus(); document.execCommand('foreColor', false, e.target.value); sync(); };
    body.querySelectorAll('[data-lt]').forEach((b) => (b.onclick = () => { W.lang = b.dataset.lt; W.pvLang = W.lang; step4(body); pushPreview(); }));
    body.querySelector('#msgStudio').onclick = () => {
      const words = document.getElementById('fpWords');
      if (!words) return;
      const d = document.getElementById('fpMessage'); if (d) d.open = false;
      openStudio(words); words.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
  }

  /* ---------- Step 5: design ---------- */
  function step5(body) {
    const inv = W.inv, d = inv.design, p = M.palette(inv);
    const sample = { script: M.txt(inv, inv.defaultLang, 'title') || 'Aarav & Diya', head: (inv.events[0] && inv.events[0].name) || 'Wedding Ceremony', body: 'Join us to celebrate' };
    const sel = (k, list) => `<div class="font-grid" role="radiogroup" aria-labelledby="fl-${k}">${list.map((f) => `<button type="button" class="font-opt ${f === d.fonts[k] ? 'on' : ''}" role="radio" aria-checked="${f === d.fonts[k]}" data-font="${k}" data-f="${esc(f)}">
        <span class="fs" style="font-family:'${esc(f)}',serif">${esc(sample[k])}</span><span class="fn">${esc(f)}${FONT_INFO[f] ? ` · ${esc(FONT_INFO[f])}` : ''}</span></button>`).join('')}</div>`;
    const seg = (k, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${k}" value="${v}" ${d[k] === v ? 'checked' : ''} data-seg="${k}">${l}</label>`).join('')}</div>`;
    body.innerHTML = `
      <div class="card stack"><h2>Fonts</h2>
        <div class="field"><span class="lbl">Fonts that go well together</span>
          <div class="pair-grid" role="radiogroup" aria-label="Font pairings">${IXGallery.pairsFor(inv.theme).map((pr) => { const on = ['script', 'head', 'body'].every((k) => d.fonts[k] === pr.fonts[k]); return `<button type="button" class="pair ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-pair="${pr.id}">
            <span class="pair-s" style="font-family:'${esc(pr.fonts.script)}',serif">${esc(sample.script)}</span><span class="pair-h" style="font-family:'${esc(pr.fonts.head)}',serif">${esc(sample.head)}</span><span class="pair-b" style="font-family:'${esc(pr.fonts.body)}',sans-serif">${esc(sample.body)}</span><span class="pair-n">${esc(pr.name)}</span></button>`; }).join('')}</div></div>
        <p class="tiny muted" style="margin:0">Or choose each font yourself. Each box shows your own text in that font, exactly as guests will see it.</p>
        <div class="field"><span class="lbl" id="fl-script">Names / title font</span>${sel('script', [...new Set([d.fonts.script, ...IXT.FONT_CHOICES.script])])}</div>
        <div class="field"><span class="lbl" id="fl-head">Heading font</span>${sel('head', [...new Set([d.fonts.head, ...IXT.FONT_CHOICES.head])])}</div>
        <div class="field"><span class="lbl" id="fl-body">Text font</span>${sel('body', [...new Set([d.fonts.body, ...IXT.FONT_CHOICES.body])])}</div>
        <div class="field"><label for="fs">Text size <span class="muted" id="fsv">${Math.round(d.fontScale * 100)}%</span></label><input type="range" id="fs" min="0.85" max="1.3" step="0.05" data-k="design.fontScale" data-type="float"></div>
        <p class="tiny muted">Hindi and Punjabi text automatically use Noto Devanagari / Gurmukhi fonts for correct rendering.</p>
      </div>
      <div class="card stack"><h2>Colours</h2>
        <div class="row">
          <label class="field"><span class="lbl">Text</span><input type="color" data-color="textColor" value="${p.text.startsWith('#') ? p.text : '#000000'}"></label>
          <label class="field"><span class="lbl">Background</span><input type="color" data-color="bgColor" value="${p.bg}"></label>
          <label class="field"><span class="lbl">Accent / gold</span><input type="color" data-color="accentColor" value="${p.accent}"></label>
          <button class="btn sm" id="resetCol" style="align-self:end">Reset to theme colours</button>
        </div>
      </div>
      <div class="card stack"><h2>Style</h2>
        <div class="field"><span class="lbl">Border style</span>${seg('border', [['none', 'None'], ['thin', 'Thin'], ['double', 'Double'], ['ornate', 'Ornate']])}</div>
        <div class="field"><span class="lbl">Photo shape</span>${seg('photoShape', [['arch', 'Arch'], ['circle', 'Circle'], ['rounded', 'Rounded'], ['square', 'Square']])}</div>
        <div class="field"><span class="lbl">Animations</span>${seg('animation', [['none', 'None'], ['gentle', 'Gentle'], ['lively', 'Lively']])}</div>
        <div class="field"><span class="lbl">Spacing</span>${seg('spacing', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['airy', 'Airy']])}</div>
        <label class="check"><input type="checkbox" data-k="design.decorations"> Show decorative illustrations (flowers, mountains, mandalas…)</label>
        <label class="check"><input type="checkbox" data-k="design.musicAutoplay"> Start background music when the guest opens the invitation</label>
      </div>
      <div class="card stack"><h2>Sections &amp; order</h2>
        <p class="tiny muted">Switch sections on or off and change their order. Sections without content are hidden automatically.</p>
        <ul class="sec-list" id="secList"></ul>
      </div>`;
    bind(body);
    body.querySelectorAll('[data-pair]').forEach((b) => (b.onclick = () => {
      const pr = IXGallery.FONT_PAIRS.find((x) => x.id === b.dataset.pair);
      d.fonts = { ...d.fonts, ...pr.fonts };
      changed(); step5(body);
    }));
    body.querySelectorAll('[data-font]').forEach((b) => (b.onclick = () => {
      d.fonts[b.dataset.font] = b.dataset.f;
      b.parentElement.querySelectorAll('.font-opt').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
      changed();
    }));
    const fs = body.querySelector('#fs');
    fs.addEventListener('input', () => (body.querySelector('#fsv').textContent = Math.round(fs.value * 100) + '%'));
    body.querySelectorAll('[data-seg]').forEach((r) => (r.onchange = () => { d[r.dataset.seg] = r.value; changed(); }));
    body.querySelectorAll('[data-color]').forEach((c) => (c.oninput = () => { d[c.dataset.color] = c.value; changed(); }));
    body.querySelector('#resetCol').onclick = () => { Object.assign(d, { textColor: '', bgColor: '', accentColor: '' }); changed(); step5(body); };
    const renderSecs = () => {
      const ul = body.querySelector('#secList');
      ul.innerHTML = d.sectionOrder.map((id, i) => {
        const s = IXT.SECTIONS.find((x) => x.id === id);
        return `<li class="sec-item ${d.sections[id] ? '' : 'off'}"><input type="checkbox" id="sc-${id}" ${d.sections[id] ? 'checked' : ''} data-sec="${id}"><label class="name" for="sc-${id}">${esc(s ? s.name : id)}</label>
          <button class="btn sm ghost iconbtn" data-secmv="${i}.-1" aria-label="Move ${esc(s.name)} up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn sm ghost iconbtn" data-secmv="${i}.1" aria-label="Move ${esc(s.name)} down" ${i === d.sectionOrder.length - 1 ? 'disabled' : ''}>↓</button></li>`;
      }).join('');
      ul.querySelectorAll('[data-sec]').forEach((c) => (c.onchange = () => { d.sections[c.dataset.sec] = c.checked; changed(); renderSecs(); }));
      ul.querySelectorAll('[data-secmv]').forEach((b) => (b.onclick = () => {
        const [i, dd] = b.dataset.secmv.split('.').map(Number); const j = i + dd;
        [d.sectionOrder[i], d.sectionOrder[j]] = [d.sectionOrder[j], d.sectionOrder[i]];
        changed(); renderSecs(); ul.querySelectorAll('[data-secmv]')[j * 2 + (dd > 0 ? 1 : 0)]?.focus();
      }));
    };
    renderSecs();
  }

  /* ---------- Step 6: settings & publish ---------- */
  function readiness(inv) {
    const issues = [];
    if (!M.txt(inv, inv.defaultLang, 'title')) issues.push(['bad', 'Add an event title (step 2).']);
    if (!inv.events.some((e) => e.date)) issues.push(['bad', 'Add a date to at least one event (step 2).']);
    if (!inv.slug) issues.push(['bad', 'Choose a link name above.']);
    if (!inv.events.some((e) => e.venue || e.address)) issues.push(['warn', 'No venue yet – guests will not see a location or directions.']);
    if (!M.txt(inv, inv.defaultLang, 'message')) issues.push(['warn', 'No invitation message yet (step 2, “Main invitation message”).']);
    if (inv.events.some((e) => e.date && e.end && e.start && e.end <= e.start)) issues.push(['warn', 'An event ends before it starts – it will be treated as ending after midnight.']);
    return issues;
  }
  function step6(body) {
    const inv = W.inv, s = inv.settings;
    const base = IX.inviteUrl('').replace(/i=$/, 'i=');
    const issues = readiness(inv);
    const link = inv.slug ? IX.inviteUrl(inv.slug) : '';
    body.innerHTML = `
      <div class="card stack"><h2>Invitation link</h2>
        <div class="field"><label for="slug">Custom link name</label>
          <div class="copyrow"><span class="small muted" style="align-self:center;white-space:nowrap;max-width:45%;overflow:hidden;text-overflow:ellipsis" title="${esc(base)}">…invite.html?i=</span><input class="input" id="slug" value="${esc(inv.slug)}" placeholder="${esc(IX.slugify(M.txt(inv, 'en', 'title')) || 'my-event')}" autocapitalize="off" spellcheck="false" maxlength="48"></div>
          <span class="hint" id="slugMsg">Lowercase letters, numbers and hyphens, 3–48 characters.</span></div>
      </div>
      <div class="card stack"><h2>${inv.status === 'published' ? 'Your invitation is live' : 'Ready to publish?'}</h2>
        ${issues.length ? issues.map(([k, m]) => `<div class="notice ${k}">${k === 'bad' ? '✕' : '⚠'} ${esc(m)}</div>`).join('') : '<div class="notice ok">✔ Everything looks good.</div>'}
        ${inv.status !== 'published' || H.hasUnpublished(inv) ? `<button class="btn gold lg" id="pubBig">🚀 ${inv.status === 'published' ? 'Update published invitation' : 'Publish invitation'}</button>` : ''}
        ${inv.status === 'published' ? `<div class="notice ${H.hasUnpublished(inv) ? 'warn' : 'ok'}">${H.hasUnpublished(inv) ? 'You have edits that guests cannot see yet. Press <b>Update published invitation</b> to make them live.' : 'Guests are seeing the latest version.'}</div>
          <div class="copyrow"><input class="input" readonly value="${esc(link)}" aria-label="Invitation link"><button class="btn" data-copy="${esc(link)}">Copy</button></div>
          <div id="cmNote"></div>
          <div class="row"><a class="btn" target="_blank" rel="noopener" href="${esc(link)}">👁 Open invitation</a><a class="btn wa" href="#/dash/${esc(inv.id)}/share">💬 Share on WhatsApp</a><a class="btn" href="#/dash/${esc(inv.id)}">📊 RSVP dashboard</a><button class="btn danger" id="unpub">Unpublish</button></div>` : ''}
        ${IX.isProduction ? '' : '<div class="notice warn"><b>Demo/Local mode:</b> the published link works in this browser only. To let guests open it on their own phones and RSVP, set up Production mode (Supabase).</div>'}
      </div>
      <details class="card more-options"><summary><b>More options</b> <span class="tiny muted">– RSVP questions and limits, password, expiry date, map</span></summary><div class="stack" style="margin-top:.8rem">
      <div class="stack"><h2>RSVP settings</h2>
        <label class="check"><input type="checkbox" data-k="settings.rsvpEnabled"> Collect RSVPs on this invitation</label>
        <div class="grid3">
          <div class="field"><label for="dl">RSVP deadline</label><input class="input" type="date" id="dl" data-k="settings.rsvpDeadline"></div>
          <div class="field"><label for="mx">Maximum total guests</label><input class="input" type="number" min="0" id="mx" data-k="settings.maxGuestsTotal" data-type="int"><span class="hint">0 = no limit. Only “Yes” replies count.</span></div>
          <div class="field"><label for="mp">Max attendees per invitation</label><input class="input" type="number" min="0" id="mp" data-k="settings.maxPerInvite" data-type="int"><span class="hint">0 = no limit. Can be set per guest too.</span></div>
        </div>
        <label class="check"><input type="checkbox" data-k="settings.askChildren"> Ask for number of children separately</label>
        <label class="check"><input type="checkbox" data-k="settings.askFood"> Ask for food preference</label>
        <label class="check"><input type="checkbox" data-k="settings.askEvents"> Let guests choose which events they will attend</label>
        <label class="check"><input type="checkbox" data-k="settings.whatsappToHost"> After RSVP, offer guests a button to also send their reply to the contact number on WhatsApp</label>
      </div>
      <div class="stack"><h2>Privacy &amp; expiry</h2>
        <div class="row"><label class="check"><input type="checkbox" id="pwOn" ${s.passwordProtected ? 'checked' : ''}> Password-protect this invitation</label><span class="pill ${s.passwordProtected ? 'ok' : ''}">${s.passwordProtected ? 'Password set' : 'Public link'}</span></div>
        <div class="row" id="pwRow" ${s.passwordProtected ? '' : 'hidden'}><input class="input" style="max-width:260px" id="pw" type="text" autocomplete="off" placeholder="${s.passwordProtected ? 'Enter a new password to change it' : 'Choose a password'}"><button class="btn sm" id="pwSet">Set password</button></div>
        <div class="field" style="max-width:260px"><label for="exp">Invitation expires on</label><input class="input" type="date" id="exp" data-k="settings.expiresAt"><span class="hint">After this date guests see “This invitation has expired”. Leave empty to never expire.</span></div>
        <p class="tiny muted">Guest mobile numbers are never shown on the invitation. Only you can see RSVP details in your dashboard.</p>
      </div></div></details>
`;
    bind(body);
    // published but sharing not started yet: say that guests can open it after "Start sharing"
    if (inv.status === 'published' && window.IXCampaign) IXCampaign.load(inv).then(() => { const n = body.querySelector('#cmNote'); if (n) n.innerHTML = IXCampaign.lockedNote(inv); }).catch(() => {});
    const slugIn = body.querySelector('#slug'), msg = body.querySelector('#slugMsg');
    const checkSlug = IX.debounce(async () => {
      const v = slugIn.value.trim().toLowerCase();
      if (!v) { msg.textContent = 'Choose a link name.'; return; }
      if (!IX.validSlug(v)) { msg.innerHTML = '<span class="err">Use 3–48 lowercase letters, numbers and hyphens (not at the start or end).</span>'; slugIn.setAttribute('aria-invalid', 'true'); return; }
      if (!(await H.store.slugAvailable(v, inv.id))) { msg.innerHTML = '<span class="err">This link name is already taken. Try another.</span>'; slugIn.setAttribute('aria-invalid', 'true'); return; }
      slugIn.removeAttribute('aria-invalid');
      msg.innerHTML = '✔ Available: <b>' + esc(IX.inviteUrl(v)) + '</b>';
      if (inv.slug !== v) { inv.slug = v; changed(); }
      body.querySelectorAll('.notice.bad').forEach((n) => { if (/link name/.test(n.textContent)) n.remove(); });
    }, 350);
    slugIn.addEventListener('input', () => { slugIn.value = slugIn.value.toLowerCase().replace(/\s+/g, '-'); checkSlug(); });
    if (!inv.slug) { slugIn.value = IX.slugify(M.txt(inv, 'en', 'title') || M.txt(inv, inv.defaultLang, 'title')) || ''; if (slugIn.value) checkSlug(); }
    body.querySelector('#pwOn').onchange = async (e) => {
      body.querySelector('#pwRow').hidden = !e.target.checked;
      if (!e.target.checked && s.passwordProtected) { await H.store.setPassword(inv, null); changed(); IX.toast('Password removed', 'ok'); step6(body); }
    };
    body.querySelector('#pwSet').onclick = async () => {
      const pw = body.querySelector('#pw').value;
      if (pw.length < 4) return IX.toast('Use at least 4 characters', 'warn');
      await save();
      await H.store.setPassword(inv, pw);
      changed(); IX.toast('Password set. Share it with your guests separately.', 'ok'); step6(body);
    };
    body.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = async () => { await IX.copy(b.dataset.copy); IX.toast('Link copied', 'ok'); }));
    const pb = body.querySelector('#pubBig'); if (pb) pb.onclick = () => publish();
    const up = body.querySelector('#unpub');
    if (up) up.onclick = async () => {
      if (!(await H.confirm('Unpublish?', 'Guests will no longer be able to open the invitation. Your design and RSVPs are kept.', 'Unpublish', true))) return;
      await H.store.unpublish(inv); IX.toast('Invitation unpublished'); goStep(NSTEPS);
    };
  }

  async function publish() {
    const inv = W.inv;
    const hard = readiness(inv).filter(([k]) => k === 'bad');
    if (hard.length) { goStep(NSTEPS); return IX.toast(hard[0][1], 'bad', 5000); }
    try {
      await save();
      const saved = await H.store.publish(inv);
      W.inv.published = saved.published; W.inv.status = 'published'; W.inv.publishedAt = saved.publishedAt;
      W.dirty = false;
      IX.toast('🎉 Invitation published! Guests now see this version.', 'ok', 4500);
      goStep(NSTEPS);
    } catch (e) { IX.toast(e.message, 'bad', 5000); }
  }
})();
