/* InviteX design studio helpers (window.IXPicks).
 *  - favourites, recently viewed designs and remembered gallery filters, kept in this browser only
 *  - quickLook(): a large live preview of one design without choosing it
 *  - compare(): two or three designs side by side
 * Nothing here is saved to the account or the database. */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc, H = window.H;
  const KEY = 'ix-studio-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* storage blocked: keep working without it */ } };
  const get = () => { const o = read(); return { favs: Array.isArray(o.favs) ? o.favs : [], recent: Array.isArray(o.recent) ? o.recent : [], prefs: o.prefs && typeof o.prefs === 'object' ? o.prefs : {} }; };
  const save = (fn) => { const o = get(); fn(o); write(o); return o; };

  const isFav = (id) => get().favs.includes(id);
  const toggleFav = (id) => save((o) => { o.favs = o.favs.includes(id) ? o.favs.filter((x) => x !== id) : [id].concat(o.favs).slice(0, 40); }).favs.includes(id);
  const viewed = (id) => save((o) => { o.recent = [id].concat(o.recent.filter((x) => x !== id)).slice(0, 8); });
  const prefs = () => get().prefs;
  const setPrefs = (p) => save((o) => { o.prefs = Object.assign({}, o.prefs, p); });

  // A preview iframe of invite.html that shows whatever invitation it is given.
  function previewFrame(host, inv, cls = '') {
    host.innerHTML = `<div class="pv-frame ql-frame ${cls}"><iframe title="Preview of this design" src="invite.html?preview=1"></iframe></div>`;
    const f = host.querySelector('iframe');
    let cur = inv;
    const push = () => f.contentWindow && f.contentWindow.postMessage({ type: 'ix-preview', inv: cur, lang: cur.defaultLang, samples: [], opened: true }, location.origin);
    const onMsg = (e) => { if (e.source === f.contentWindow && e.data && e.data.type === 'ix-preview-ready') push(); };
    window.addEventListener('message', onMsg);
    return { set(v) { cur = v; push(); }, stop() { window.removeEventListener('message', onMsg); } };
  }

  const fontLine = (t) => [...new Set([t.fonts.script, t.fonts.head, t.fonts.body])].join(' · ');
  const OPENER = { doors: 'Palace doors open', curtain: 'Curtains part', envelope: 'Envelope opens', pop: 'Confetti pop', fade: 'Gentle fade' };
  const swatch = (p) => `<i class="ql-sw" style="background:linear-gradient(135deg,${p.bg} 50%,${p.accent} 50%)" title="${esc(p.name)}"></i>`;

  /* Quick look: build(themeId, pal) returns the invitation to show; onUse(themeId, pal) chooses it. */
  function quickLook({ themeId, pal = 0, build, onUse, isOn }) {
    const t = IXT.THEMES[themeId], G = window.IXGallery;
    viewed(themeId);
    let p = pal, frame = null;
    const body = `<div class="ql">
        <div class="ql-pv" id="qlPv"></div>
        <div class="ql-info stack">
          <p class="small muted" style="margin:0">${esc(G.DESC[themeId] || '')}</p>
          <dl class="ql-facts"><dt>Style</dt><dd>${esc((G.META[themeId] || {}).style || '')}</dd>
            <dt>Fonts</dt><dd>${esc(fontLine(t))}</dd><dt>Opening</dt><dd>${esc(OPENER[t.opener] || 'Gentle fade')}</dd>
            <dt>Languages</dt><dd>English · हिन्दी · ਪੰਜਾਬੀ</dd></dl>
          <div class="field"><span class="lbl">Colours</span><div class="ql-pals" role="radiogroup" aria-label="Colours">${t.palettes.map((x, i) => `<button type="button" role="radio" class="ql-pal ${i === p ? 'on' : ''}" aria-checked="${i === p}" data-ql-pal="${i}">${swatch(x)}${esc(x.name)}</button>`).join('')}</div></div>
          <p class="tiny muted" style="margin:0">Sample names are shown. Your own details go in after you choose.</p>
        </div></div>`;
    return H.modal({
      title: t.name.replace(' (blank)', ''), wide: true, body,
      actions: [{ label: 'Close', value: null }, { label: isOn && isOn(themeId) ? '✓ On your card' : 'Use this design', cls: 'primary', onClick: () => { onUse(themeId, p); return true; } }],
      onOpen: (m) => {
        m.classList.add('ql-modal');
        frame = previewFrame(m.querySelector('#qlPv'), build(themeId, p));
        m.querySelectorAll('[data-ql-pal]').forEach((b) => (b.onclick = () => {
          p = +b.dataset.qlPal;
          m.querySelectorAll('[data-ql-pal]').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
          frame.set(build(themeId, p));
        }));
      },
    }).finally(() => frame && frame.stop());
  }

  /* Compare two or three designs side by side; onUse(themeId, pal) chooses one. */
  function compare({ items, build, onUse }) {
    const G = window.IXGallery, frames = [];
    const body = `<div class="cmp" style="--n:${items.length}">${items.map(({ id, pal }, i) => {
      const t = IXT.THEMES[id];
      return `<div class="cmp-col"><h3>${esc(t.name.replace(' (blank)', ''))}</h3><div class="cmp-pv" data-cmp-pv="${i}"></div>
        <dl class="ql-facts"><dt>Style</dt><dd>${esc((G.META[id] || {}).style || '')}</dd>
          <dt>Colours</dt><dd class="cmp-sw">${t.palettes.map(swatch).join('')}<span class="tiny muted">${esc(t.palettes[pal].name)} shown</span></dd>
          <dt>Fonts</dt><dd>${esc(fontLine(t))}</dd><dt>Opening</dt><dd>${esc(OPENER[t.opener] || 'Gentle fade')}</dd>
          <dt>About</dt><dd>${esc(G.DESC[id] || '')}</dd></dl>
        <button type="button" class="btn primary" data-cmp-use="${i}">Use this one</button></div>`;
    }).join('')}</div>`;
    return H.modal({
      title: 'Compare designs', wide: true, body,
      onOpen: (m, done) => {
        m.classList.add('cmp-modal');
        items.forEach(({ id, pal }, i) => frames.push(previewFrame(m.querySelector(`[data-cmp-pv="${i}"]`), build(id, pal), 'cmp-frame')));
        m.querySelectorAll('[data-cmp-use]').forEach((b) => (b.onclick = () => { const it = items[+b.dataset.cmpUse]; onUse(it.id, it.pal); done(true); }));
      },
    }).finally(() => frames.forEach((f) => f.stop()));
  }

  window.IXPicks = { isFav, toggleFav, viewed, recent: () => get().recent, favs: () => get().favs, prefs, setPrefs, quickLook, compare };
})();
