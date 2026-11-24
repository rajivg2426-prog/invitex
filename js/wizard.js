/* InviteX creation wizard with live preview. */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model, esc = IX.esc, H = window.H;
  const STEPS = ['Template', 'Photos & media', 'Details & events', 'Message', 'Design', 'Publish'];
  // One line per step telling the host what to do here and what comes next.
  const STEP_HELP = [
    'Pick what you are celebrating and a design. You can change these any time.',
    'Add a cover photo and any family or gallery photos. All optional – you can skip this step.',
    'Choose the kind of message you want, then fill in names, date and venue. The preview updates as you type.',
    'Check the main invitation message. It was already written for you in the style you picked – edit it freely.',
    'Optional: change fonts, colours and which sections appear.',
    'Choose your link name and publish. Then share it on WhatsApp.',
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
    W = { inv, step: IX.clamp(IX.int(step, 1), 1, 6), lang: inv.defaultLang, pv: 'mobile', pvLang: null, saving: false, ready: false };
    H.render(`
      <div class="wiz-head">
        <div><h1 id="wTitle">${esc(H.title(inv))}</h1><span class="save-state" id="saveState" aria-live="polite">All changes saved</span></div>
        <div class="row"><span class="pill ${inv.status}" id="wStatus"></span><a class="btn sm" href="#/dash/${esc(inv.id)}">📊 RSVP dashboard</a></div>
      </div>
      <div class="wiz">
        <div class="wiz-main">
          <nav class="steps" aria-label="Steps">${STEPS.map((s, i) => `<button type="button" class="step-tab" data-step="${i + 1}"><span class="n">${i + 1}</span>${esc(s)}</button>`).join('')}</nav>
          <div id="stepBody"></div>
          <div class="wiz-foot no-print">
            <button class="btn" id="prevBtn">← Back</button>
            <button class="btn ghost" id="draftBtn">💾 Save draft</button>
            <button class="btn primary" id="nextBtn">Next →</button>
          </div>
        </div>
        <aside class="wiz-preview" id="pvPane" aria-label="Live preview">
          <div class="pv-tools"><div class="seg" role="group" aria-label="Preview size"><button type="button" data-pv="mobile" class="on">📱 Mobile</button><button type="button" data-pv="desktop">🖥 Desktop</button></div>
            <button class="btn sm ghost" id="replayOpen" title="Show the opening animation again">↺ Opening</button></div>
          <div class="pv-frame" id="pvFrame"><iframe id="pvIframe" title="Live preview of the invitation" src="invite.html?preview=1"></iframe></div>
          <p class="tiny muted" style="text-align:center;margin-top:.5rem">Live preview · RSVP is disabled here</p>
          <button class="btn pv-close" id="pvClose">✕ Close preview</button>
        </aside>
      </div>
      <button class="btn primary fab-preview" id="fabPv">👁 Preview</button>`);
    const iframe = document.getElementById('pvIframe');
    const onMsg = (e) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === 'ix-preview-ready') { W.ready = true; pushPreview(); }
      if (e.data?.type === 'ix-preview-lang') W.pvLang = e.data.lang;
    };
    window.addEventListener('message', onMsg);
    const onLeave = (e) => { if (W && W.dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    H.cleanup.push(() => { window.removeEventListener('message', onMsg); window.removeEventListener('beforeunload', onLeave); if (W && W.dirty) save(); });
    v.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => goStep(+b.dataset.step)));
    v.querySelector('#prevBtn').onclick = () => goStep(W.step - 1);
    v.querySelector('#nextBtn').onclick = () => (W.step < 6 ? goStep(W.step + 1) : publish());
    v.querySelector('#draftBtn').onclick = async () => { await save(); IX.toast('Draft saved', 'ok'); };
    v.querySelectorAll('[data-pv]').forEach((b) => (b.onclick = () => {
      W.pv = b.dataset.pv;
      v.querySelectorAll('[data-pv]').forEach((x) => x.classList.toggle('on', x === b));
      document.getElementById('pvFrame').classList.toggle('desktop', W.pv === 'desktop');
    }));
    v.querySelector('#replayOpen').onclick = () => pushPreview(false);
    v.querySelector('#fabPv').onclick = () => document.getElementById('pvPane').classList.add('open');
    v.querySelector('#pvClose').onclick = () => document.getElementById('pvPane').classList.remove('open');
    iframe.addEventListener('load', () => setTimeout(pushPreview, 50));
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
  const pushPreview = (opened) => {
    const f = document.getElementById('pvIframe');
    if (!f || !f.contentWindow || !W) return;
    const msg = { type: 'ix-preview', inv: IX.deepClone(W.inv), lang: W.pvLang || W.lang };
    if (opened === false) msg.opened = false;
    f.contentWindow.postMessage(msg, location.origin);
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
  function changed(rerenderTitle = true) {
    W.dirty = true;
    const st = document.getElementById('saveState');
    if (st) st.textContent = 'Unsaved changes…';
    if (rerenderTitle) { const t = document.getElementById('wTitle'); if (t) t.textContent = H.title(W.inv); }
    debouncedSave();
    debouncedPreview();
  }
  function updateStatus() {
    const s = document.getElementById('wStatus');
    if (!s) return;
    const dirty = H.hasUnpublished(W.inv);
    s.className = 'pill ' + (W.inv.status === 'published' ? (dirty ? 'maybe' : 'published') : 'draft');
    s.textContent = W.inv.status === 'published' ? (dirty ? 'Published · unpublished edits' : '● Published') : 'Draft';
  }

  function goStep(n) {
    if (n < 1 || n > 6) return;
    W.step = n;
    history.replaceState(null, '', `#/edit/${W.inv.id}/${n}`);
    document.querySelectorAll('.step-tab').forEach((b) => { const s = +b.dataset.step; b.classList.toggle('on', s === n); b.classList.toggle('done', s < n); b.setAttribute('aria-current', s === n ? 'step' : 'false'); });
    document.getElementById('prevBtn').disabled = n === 1;
    const nb = document.getElementById('nextBtn');
    nb.textContent = n === 6 ? (W.inv.status === 'published' ? '🚀 Update published invitation' : '🚀 Publish invitation') : 'Next →';
    nb.className = 'btn ' + (n === 6 ? 'gold' : 'primary');
    updateStatus();
    if (n < 6) nb.textContent = `Next: ${STEPS[n]} →`;
    const body = document.getElementById('stepBody');
    [null, step1, step2, step3, step4, step5, step6][n](body);
    body.insertAdjacentHTML('afterbegin', `<div class="step-guide"><span class="sg-n">Step ${n} of 6</span><span>${esc(STEP_HELP[n - 1])}</span></div>`);
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

  /* ---------- Step 1: template ---------- */
  function step1(body) {
    const inv = W.inv;
    const cat = IXT.CATEGORIES.find((c) => c.id === inv.category);
    const themeIds = Object.keys(IXT.THEMES).sort((a, b) => (a === cat.theme ? -1 : b === cat.theme ? 1 : 0));
    const th = IXT.THEMES[inv.theme];
    body.innerHTML = `<div class="card stack">
      <h2>1. What are you celebrating?</h2>
      <div class="cat-grid" role="radiogroup" aria-label="Event type">${IXT.CATEGORIES.map((c) => `<button type="button" class="cat ${c.id === inv.category ? 'on' : ''}" role="radio" aria-checked="${c.id === inv.category}" data-cat="${c.id}"><span class="ic" aria-hidden="true">${c.icon}</span>${esc(c.name)}</button>`).join('')}</div>
    </div>
    <div class="card stack">
      <div class="row between"><h2 style="margin:0">2. Choose a design</h2><button class="btn sm" data-theme-pick="minimal-ivory">Start from a blank design</button></div>
      <div class="theme-grid" role="radiogroup" aria-label="Design template">${themeIds.map((id) => {
        const t = IXT.THEMES[id], p = t.palettes[0], mo = IXT.motif(t.motif, p);
        return `<button type="button" class="theme ${id === inv.theme ? 'on' : ''}" role="radio" aria-checked="${id === inv.theme}" data-theme-pick="${id}">
          <div class="theme-sw" style="background:linear-gradient(135deg,${p.bg},${p.bg2});color:${p.accent}">${mo.corner || ''}<span class="tt" style="font-family:'${t.fonts.script}',serif">Aa</span></div>
          <div class="theme-name">${esc(t.name)}${id === cat.theme ? '<small>Recommended</small>' : ''}</div></button>`;
      }).join('')}</div>
    </div>
    <div class="card stack">
      <h2>3. Colour theme</h2>
      <div class="swatches" role="radiogroup" aria-label="Colour theme">${th.palettes.map((p, i) => `<button type="button" class="swatch ${i === inv.paletteIndex ? 'on' : ''}" role="radio" aria-checked="${i === inv.paletteIndex}" data-pal="${i}"><i style="background:linear-gradient(135deg,${p.bg} 50%,${p.accent} 50%)"></i>${esc(p.name)}</button>`).join('')}</div>
      <p class="tiny muted">You can fine-tune any colour later in step 5 (Design).</p>
    </div>
    <div class="card stack">
      <h2>4. Layout</h2>
      <div class="seg" role="radiogroup" aria-label="Layout">${['portrait', 'landscape', 'square'].map((l) => `<label><input type="radio" name="layout" value="${l}" ${inv.layout === l ? 'checked' : ''}>${l[0].toUpperCase() + l.slice(1)}</label>`).join('')}</div>
      <p class="tiny muted">Portrait is best for WhatsApp on phones. Landscape suits desktop screens and corporate events.</p>
    </div>`;
    body.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
      const c = IXT.CATEGORIES.find((x) => x.id === b.dataset.cat);
      inv.category = c.id;
      const untouched = inv.events.every((e) => !e.date && !e.venue);
      if (untouched) inv.events = [M.newEvent(c.main || c.events[0])];
      const keepWording = inv.tone && !wordingUntouched(inv);
      if (!keepWording) applyTone(inv, IXWording.tones(c.id)[0].id, c.id);
      setTheme(c.theme);
      IX.toast(`Design set to “${IXT.THEMES[c.theme].name}”. You can choose any other below.`);
      changed(); step1(body);
    }));
    body.querySelectorAll('[data-theme-pick]').forEach((b) => (b.onclick = () => { setTheme(b.dataset.themePick); changed(); step1(body); }));
    body.querySelectorAll('[data-pal]').forEach((b) => (b.onclick = () => { inv.paletteIndex = +b.dataset.pal; Object.assign(inv.design, { textColor: '', bgColor: '', accentColor: '' }); changed(); step1(body); }));
    body.querySelectorAll('input[name=layout]').forEach((r) => (r.onchange = () => { inv.layout = r.value; changed(); }));
  }
  // Fill every wording field in one matching style ("type of message"), in all languages.
  function applyTone(inv, tone, category = inv.category) {
    inv.tone = tone;
    inv.languages.forEach((l) => {
      const w = IXWording.build(category, l, tone, { host: M.txt(inv, l, 'hostName'), title: M.txt(inv, l, 'title') });
      TONE_FIELDS.forEach((k) => (inv.text[l][k] = w[k]));
    });
  }
  // True when the wording is still exactly what the chosen style wrote (or empty).
  function wordingUntouched(inv) {
    return inv.languages.every((l) => {
      const w = inv.tone ? IXWording.build(inv.category, l, inv.tone, { host: M.txt(inv, l, 'hostName'), title: M.txt(inv, l, 'title') }) : {};
      return TONE_FIELDS.every((k) => { const cur = (inv.text[l][k] || '').trim(); return !cur || cur === (w[k] || '').trim(); });
    });
  }
  function setTheme(id) {
    const t = IXT.THEMES[id];
    W.inv.theme = id; W.inv.paletteIndex = 0;
    W.inv.design.fonts = { ...t.fonts };
    Object.assign(W.inv.design, { textColor: '', bgColor: '', accentColor: '' });
  }

  /* ---------- Step 2: media ---------- */
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
      <div class="card stack"><h2>Background, logo &amp; decoration</h2>
        ${slot('background', 'Background image or artwork', 'Becomes the background of your card. Text is placed on soft panels so it stays easy to read.')}
        ${m.background ? `<div class="field"><span class="lbl">How should the background be used?</span><div class="seg" role="radiogroup"><label><input type="radio" name="bgMode" value="full" data-bgmode ${inv.design.bgMode !== 'soft' ? 'checked' : ''}>As the card background</label><label><input type="radio" name="bgMode" value="soft" data-bgmode ${inv.design.bgMode === 'soft' ? 'checked' : ''}>Faint texture only</label></div></div>` : ''}
        ${slot('logo', 'Company / family logo', 'Shown small, in a round frame at the top of the card. A PNG with a transparent background works best.')}
      </div>
      <div class="card stack"><h2>Audio &amp; video</h2>
        ${slot('music', 'Background music (MP3)', 'Starts after the guest taps “Open Invitation”. Guests can pause it any time. Max 12 MB.', 'audio')}
        ${slot('voice', 'Voice welcome message (MP3)', 'A personal spoken invitation. Max 12 MB.', 'audio')}
        ${slot('video', 'Short video introduction (MP4)', 'Keep it under 1 minute. Max 40 MB.', 'video')}
        <p class="tiny muted">Audio and video files are stored as uploaded (browsers cannot compress them). Use short clips for fast loading. Only upload music you have the right to use.</p>
      </div>`;
    const rerender = () => step2(body);
    body.querySelectorAll('[data-bgmode]').forEach((r) => (r.onchange = () => { inv.design.bgMode = r.value; changed(); }));
    const aspectOf = (key) => ({ cover: '4:5', background: '3:4', logo: 'free' }[key] || '4:5');
    body.querySelectorAll('input[data-slot]').forEach((inp) => (inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const key = inp.dataset.slot, kind = inp.dataset.kind;
      const ref = kind === 'image' ? await IXMedia.addImage(f, { invId: inv.id, askCrop: true, aspect: aspectOf(key), keepAlpha: key === 'logo', maxDim: key === 'logo' ? 600 : 1600 }) : await IXMedia.addFile(f, kind, inv.id);
      if (!ref) return;
      if (m[key]) await H.store.deleteMedia(m[key]).catch(() => {});
      m[key] = ref; changed(); rerender();
    }));
    body.querySelectorAll('[data-recrop]').forEach((b) => (b.onclick = async () => {
      const key = b.dataset.recrop;
      const ref = await IXMedia.recrop(m[key], { aspect: aspectOf(key), keepAlpha: key === 'logo', invId: inv.id });
      if (ref) { m[key] = ref; changed(); rerender(); }
    }));
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      const key = b.dataset.del;
      await H.store.deleteMedia(m[key]).catch(() => {});
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
      await H.store.deleteMedia(arr[+i].ref).catch(() => {});
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
      await H.store.deleteMedia(it.ref).catch(() => {});
      it.ref = ref; changed(); rerender();
    }));
  }

  /* ---------- Step 3: details & events ---------- */
  const TONE_FIELDS = ['familyName', 'subtitle', 'welcome', 'thankyou', 'message'];
  function langTabs(active, attr = 'data-lt') {
    return `<div class="ltabs" role="tablist">${W.inv.languages.map((l) => `<button type="button" role="tab" aria-selected="${l === active}" class="ltab ${l === active ? 'on' : ''}" ${attr}="${l}" lang="${l}">${esc(LANGS[l])}${l === W.inv.defaultLang ? ' ★' : ''}</button>`).join('')}</div>`;
  }
  function step3(body) {
    const inv = W.inv, L = W.lang;
    const cat = IXT.CATEGORIES.find((c) => c.id === inv.category);
    const tf = (k, label, ph = '', ta = false, req = false) => `<div class="field"><label for="tf-${k}">${esc(label)}${req ? ' *' : ''}</label>${ta ? `<textarea class="input" id="tf-${k}" lang="${L}" data-k="text.${L}.${k}" placeholder="${esc(ph)}" rows="3"></textarea>` : `<input class="input" id="tf-${k}" lang="${L}" data-k="text.${L}.${k}" placeholder="${esc(ph)}" ${req ? 'required' : ''}>`}${suggRow(k)}</div>`;
    const suggRow = (k) => {
      // lines covered by the "type of message" sets are not offered one by one any more
      if (window.IXWording && TONE_FIELDS.includes(k)) return '';
      const list = window.IXSuggest ? IXSuggest.list(inv.category, L, k) : [];
      if (!list.length) return '';
      return `<div class="sugg" data-sugg="${k}"><span class="sugg-l">${IXSuggest.APPEND.includes(k) ? 'Tap to add:' : 'Suggestions:'}</span>${list.map((t, i) => `<button type="button" class="chip" data-sg="${k}.${i}" lang="${L}" title="Use this text">${esc(t)}</button>`).join('')}</div>`;
    };
    const tzs = TZ_CHOICES.some(([z]) => z === inv.timezone) ? TZ_CHOICES : [[inv.timezone, inv.timezone.replace(/_/g, ' ')], ...TZ_CHOICES];
    const tones = window.IXWording ? IXWording.tones(inv.category, 'en') : [];
    const tonePicker = tones.length ? `<div class="tone-pick">
        <div class="lbl">What kind of message do you want to send?</div>
        <p class="tiny muted" style="margin:.1rem 0 .6rem">Pick one and all the wording on your card is written in that same style, so it reads as one message. You can still change any line below.</p>
        <div class="tone-grid" role="radiogroup" aria-label="Type of message">${tones.map((t) => {
          const w = IXWording.build(inv.category, L, t.id);
          return `<button type="button" class="tone ${inv.tone === t.id ? 'on' : ''}" role="radio" aria-checked="${inv.tone === t.id}" data-tone="${t.id}"><b>${esc(t.label)}</b><span lang="${L}">${esc(w.familyName)} · ${esc(w.subtitle)}</span><i lang="${L}">“${esc(w.welcome)}”</i></button>`;
        }).join('')}</div></div>` : '';
    body.innerHTML = `
      <div class="card stack"><h2>Languages</h2>
        <div class="row">${Object.entries(LANGS).map(([l, n]) => `<label class="check"><input type="checkbox" data-langtoggle="${l}" ${inv.languages.includes(l) ? 'checked' : ''}> <span lang="${l}">${esc(n)}</span></label>`).join('')}</div>
        <div class="field" style="max-width:260px"><label for="defLang">Default language (shown first)</label><select class="input" id="defLang">${inv.languages.map((l) => `<option value="${l}" ${l === inv.defaultLang ? 'selected' : ''}>${esc(LANGS[l])}</option>`).join('')}</select></div>
        <p class="tiny muted">Guests see a language switch at the top of the invitation. Write the text for each language yourself — nothing is machine-translated. Empty fields fall back to the default language.</p>
      </div>
      <div class="card stack"><h2>Invitation text</h2>
        ${langTabs(L)}
        ${tonePicker}
        <p class="tiny muted" style="margin:0">The fields are in the same order as they appear on the card, top to bottom.</p>
        ${tf('familyName', 'Small line at the top', 'e.g. Together with their families')}
        ${tf('title', cat.id === 'wedding' || cat.id === 'engagement' ? 'Names of the couple' : 'Event title', cat.id === 'wedding' ? 'Aarav & Diya' : 'e.g. Riya turns 5!', false, true)}
        ${tf('subtitle', 'Line under the names', cat.id === 'wedding' ? 'Invite you to celebrate their wedding' : 'e.g. You are invited')}
        ${tf('welcome', 'Welcome message', 'A warm line to greet your guests', true)}
        ${tf('hostName', 'Invited by (host names)', 'e.g. The Sharma Family')}
        ${tf('thankyou', 'Thank-you at the end', 'Your presence and blessings mean the world to us.', true)}
        <details class="more"><summary>More text (optional): special instructions, extra information</summary>
          ${tf('instructions', 'Special instructions', 'Parking, gifts, timings, children…', true)}
          ${tf('extraInfo', 'Additional event information', 'Accommodation, travel, live stream…', true)}
        </details>
      </div>
      <div class="card stack"><h2>General details</h2>
        <div class="grid2">
          <div class="field"><label for="tz">Country where the event takes place</label><select class="input" id="tz" data-k="timezone">${tzs.map(([z, n]) => `<option value="${esc(z)}" ${z === inv.timezone ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select><span class="hint">Sets the event's clock. Guests abroad also see the time in their own zone.</span></div>
          <div class="field"><label for="dc">Dress code</label><input class="input" id="dc" data-k="dressCode" placeholder="e.g. Traditional / Formal"></div>
          <div class="field"><label for="cn">Contact person</label><input class="input" id="cn" data-k="contact.name" autocomplete="name"></div>
          <div class="field"><label for="cp">Contact mobile number</label><input class="input" id="cp" type="tel" data-k="contact.phone" placeholder="+91 98765 43210"><span class="hint">Shown to guests with Call and WhatsApp buttons.</span></div>
        </div>
      </div>
      <div class="card stack"><div class="row between"><h2 style="margin:0">Events &amp; schedule</h2><span class="tiny muted">Each event has its own date, time and venue</span></div>
        <div id="evList">${inv.events.map((e, i) => eventCard(e, i)).join('')}</div>
        <div class="row"><button class="btn" id="addEv">+ Add event</button>${cat.events.filter((n) => !inv.events.some((e) => e.name === n)).map((n) => `<button class="btn sm ghost" data-addev="${esc(n)}">+ ${esc(n)}</button>`).join('')}
          ${inv.category === 'wedding' ? ['Mehendi', 'Haldi', 'Sangeet', 'Wedding Ceremony', 'Reception'].filter((n) => !inv.events.some((e) => e.name === n) && !cat.events.includes(n)).map((n) => `<button class="btn sm ghost" data-addev="${n}">+ ${n}</button>`).join('') : ''}</div>
      </div>
      <div class="card stack"><h2>Highlights <span class="tiny muted">(optional – menu, agenda, speakers, activities)</span></h2>
        <div class="field" style="max-width:360px"><label for="hlT">Section heading</label><input class="input" id="hlT" data-k="highlightsTitle" placeholder="e.g. Traditional Dham Menu / Agenda"></div>
        <div id="hlList" class="stack">${inv.highlights.map((h, i) => `<div class="row"><input class="input" style="width:64px" aria-label="Icon" value="${esc(h.icon || '')}" data-hl="${i}.icon" maxlength="4"><input class="input grow" aria-label="Title" placeholder="Title" value="${esc(h.title || '')}" data-hl="${i}.title"><input class="input grow" aria-label="Description" placeholder="Short description" value="${esc(h.desc || '')}" data-hl="${i}.desc"><button class="btn sm danger" data-hldel="${i}" aria-label="Remove highlight">✕</button></div>`).join('')}</div>
        <button class="btn sm" id="addHl">+ Add highlight</button>
      </div>`;
    bind(body);
    // "type of message": rewrite every wording field at once, in one tone, in every language
    body.querySelectorAll('[data-tone]').forEach((b) => (b.onclick = async () => {
      const tone = b.dataset.tone;
      const label = b.querySelector('b').textContent;
      if (!wordingUntouched(inv) && !(await H.confirm(`Use the “${esc(label)}” wording?`, 'The top line, the line under the names, the welcome, the main message and the thank-you will be rewritten in this style (in every language you chose). Names, dates and venues stay as they are.', 'Use this wording'))) return;
      applyTone(inv, tone);
      changed(); step3(body); IX.toast('Wording updated – see the preview', 'ok');
    }));
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
        if (inv.tone && TONE_FIELDS.every((k) => !(inv.text[l][k] || '').trim())) {
          const w = IXWording.build(inv.category, l, inv.tone, { host: M.txt(inv, l, 'hostName'), title: M.txt(inv, l, 'title') });
          TONE_FIELDS.forEach((k) => (inv.text[l][k] = w[k]));
        }
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
    <div class="card stack">
      <h2>✨ Try another style <span class="tiny muted">(optional)</span></h2>
      <p class="small muted">See the message written in a different style. It is shown here first and <b>never replaces your text unless you choose to</b>.</p>
      <div class="row"><select class="input" id="aiStyle" style="width:auto" aria-label="Type of message">${IXWording.tones(inv.category, 'en').map((t) => `<option value="${t.id}" ${t.id === inv.tone ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
        <button class="btn" id="aiGen">Suggest wording (${esc(LANGS[L])})</button></div>
      <div id="aiOut"></div>
      <p class="tiny muted">The assistant uses built-in wording templates and works offline. A cloud AI writer can be plugged in for production (see docs).</p>
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
    body.querySelector('#aiGen').onclick = () => {
      const style = body.querySelector('#aiStyle').value;
      const sug = IXWording.build(inv.category, L, style, { host: M.txt(inv, L, 'hostName'), title: M.txt(inv, L, 'title') }).message;
      const styleName = body.querySelector('#aiStyle').selectedOptions[0].textContent;
      const out = body.querySelector('#aiOut');
      out.innerHTML = `<div class="suggest"><b>Suggestion (${esc(styleName)})</b><div class="body" lang="${L}">${IX.sanitizeHTML(sug)}</div>
        <div class="row"><button class="btn sm primary" id="aiIns">Insert below my text</button><button class="btn sm" id="aiRep">Replace my text…</button><button class="btn sm ghost" id="aiNo">Discard</button></div></div>`;
      out.querySelector('#aiIns').onclick = () => { rte.innerHTML += sug; sync(); out.innerHTML = ''; IX.toast('Suggestion added below your text', 'ok'); };
      out.querySelector('#aiRep').onclick = async () => {
        if (IX.htmlToText(rte.innerHTML) && !(await H.confirm('Replace your message?', 'Your current message in this language will be replaced by the suggestion. You can undo with Ctrl+Z immediately after.', 'Replace'))) return;
        rte.focus(); document.execCommand('selectAll'); document.execCommand('insertHTML', false, sug); sync(); out.innerHTML = '';
      };
      out.querySelector('#aiNo').onclick = () => (out.innerHTML = '');
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
        <p class="tiny muted" style="margin:0">Each box shows your own text in that font, exactly as guests will see it.</p>
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
    if (!M.txt(inv, inv.defaultLang, 'title')) issues.push(['bad', 'Add an event title (step 3).']);
    if (!inv.events.some((e) => e.date)) issues.push(['bad', 'Add a date to at least one event (step 3).']);
    if (!inv.slug) issues.push(['bad', 'Choose a link name below.']);
    if (!inv.events.some((e) => e.venue || e.address)) issues.push(['warn', 'No venue yet – guests will not see a location or directions.']);
    if (!M.txt(inv, inv.defaultLang, 'message')) issues.push(['warn', 'No invitation message yet (step 4).']);
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
      <div class="card stack"><h2>RSVP settings</h2>
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
      <div class="card stack"><h2>Privacy &amp; expiry</h2>
        <div class="row"><label class="check"><input type="checkbox" id="pwOn" ${s.passwordProtected ? 'checked' : ''}> Password-protect this invitation</label><span class="pill ${s.passwordProtected ? 'ok' : ''}">${s.passwordProtected ? 'Password set' : 'Public link'}</span></div>
        <div class="row" id="pwRow" ${s.passwordProtected ? '' : 'hidden'}><input class="input" style="max-width:260px" id="pw" type="text" autocomplete="off" placeholder="${s.passwordProtected ? 'Enter a new password to change it' : 'Choose a password'}"><button class="btn sm" id="pwSet">Set password</button></div>
        <div class="field" style="max-width:260px"><label for="exp">Invitation expires on</label><input class="input" type="date" id="exp" data-k="settings.expiresAt"><span class="hint">After this date guests see “This invitation has expired”. Leave empty to never expire.</span></div>
        <label class="check"><input type="checkbox" data-k="settings.mapEmbed"> Show an embedded Google Map of the venue</label>
        <p class="tiny muted">Guest mobile numbers are never shown on the invitation. Only you can see RSVP details in your dashboard.</p>
      </div>
      <div class="card stack"><h2>Ready to publish?</h2>
        ${issues.length ? issues.map(([k, m]) => `<div class="notice ${k}">${k === 'bad' ? '✕' : '⚠'} ${esc(m)}</div>`).join('') : '<div class="notice ok">✔ Everything looks good.</div>'}
        ${inv.status === 'published' ? `<div class="notice ${H.hasUnpublished(inv) ? 'warn' : 'ok'}">${H.hasUnpublished(inv) ? 'You have edits that guests cannot see yet. Press <b>Update published invitation</b> to make them live.' : 'Guests are seeing the latest version.'}</div>
          <div class="copyrow"><input class="input" readonly value="${esc(link)}" aria-label="Invitation link"><button class="btn" data-copy="${esc(link)}">Copy</button></div>
          <div class="row"><a class="btn" target="_blank" rel="noopener" href="${esc(link)}">👁 Open invitation</a><a class="btn wa" href="#/dash/${esc(inv.id)}/share">💬 Share on WhatsApp</a><a class="btn" href="#/dash/${esc(inv.id)}">📊 RSVP dashboard</a><button class="btn danger" id="unpub">Unpublish</button></div>` : ''}
        ${IX.isProduction ? '' : '<div class="notice warn"><b>Demo/Local mode:</b> the published link works in this browser only. To let guests open it on their own phones and RSVP, set up Production mode (Supabase).</div>'}
      </div>`;
    bind(body);
    const slugIn = body.querySelector('#slug'), msg = body.querySelector('#slugMsg');
    const checkSlug = IX.debounce(async () => {
      const v = slugIn.value.trim().toLowerCase();
      if (!v) { msg.textContent = 'Choose a link name.'; return; }
      if (!IX.validSlug(v)) { msg.innerHTML = '<span class="err">Use 3–48 lowercase letters, numbers and hyphens (not at the start or end).</span>'; slugIn.setAttribute('aria-invalid', 'true'); return; }
      if (!(await H.store.slugAvailable(v, inv.id))) { msg.innerHTML = '<span class="err">This link name is already taken. Try another.</span>'; slugIn.setAttribute('aria-invalid', 'true'); return; }
      slugIn.removeAttribute('aria-invalid');
      msg.innerHTML = '✔ Available: <b>' + esc(IX.inviteUrl(v)) + '</b>';
      if (inv.slug !== v) { inv.slug = v; changed(); }
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
    const up = body.querySelector('#unpub');
    if (up) up.onclick = async () => {
      if (!(await H.confirm('Unpublish?', 'Guests will no longer be able to open the invitation. Your design and RSVPs are kept.', 'Unpublish', true))) return;
      await H.store.unpublish(inv); IX.toast('Invitation unpublished'); goStep(6);
    };
  }

  async function publish() {
    const inv = W.inv;
    const hard = readiness(inv).filter(([k]) => k === 'bad');
    if (hard.length) { goStep(6); return IX.toast(hard[0][1], 'bad', 5000); }
    try {
      await save();
      const saved = await H.store.publish(inv);
      W.inv.published = saved.published; W.inv.status = 'published'; W.inv.publishedAt = saved.publishedAt;
      W.dirty = false;
      IX.toast('🎉 Invitation published! Guests now see this version.', 'ok', 4500);
      goStep(6);
    } catch (e) { IX.toast(e.message, 'bad', 5000); }
  }
})();
