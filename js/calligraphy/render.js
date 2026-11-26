/* InviteX Calligraphy Studio – the drawing engine (window.IXC.render / IXC.draw).
 *
 * Turns the saved design (inv.calligraphy + the invitation's words) into one SVG
 * page. The studio, the gallery thumbnails, the guest page and the exports all use
 * this, so what the host sees is what guests and printers get.
 *
 * Text is always live SVG text in its font (never an image), so it stays editable
 * and sharp. Names are never respelled: they are drawn exactly as typed. */
(function () {
  'use strict';
  const IXC = (window.IXC = window.IXC || {});
  const FN = () => IXC.fonts, LIB = () => IXC.lib, ST = () => IXC.styles;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const r1 = (n) => Math.round(n * 10) / 10;
  let ctx = null;
  const cx2d = () => ctx || (ctx = document.createElement('canvas').getContext('2d'));

  /* ---------- words ---------- */
  function htmlText(h) {
    const s = String(h || '');
    if (!/[<&]/.test(s)) return s;
    const d = document.createElement('div');
    d.innerHTML = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n');
    return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
  }
  const ORD = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  function whenText(inv, ev, lang) {
    if (!ev || !ev.date) return '';
    const tz = inv.timezone || 'Asia/Kolkata';
    let date;
    if (lang === 'en') {
      const d = IX.zonedToUtc(ev.date, '12:00', tz);
      const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).formatToParts(d).map((x) => [x.type, x.value]));
      date = `${p.weekday}, ${p.day}^{${ORD(+p.day)}} ${p.month} ${p.year}`;
    } else date = IX.fmtDate(ev.date, tz, lang);
    let time = ev.start ? IX.fmtTime(ev.date, ev.start, tz, lang) : '';
    if (time) time = lang === 'hi' ? `${time} बजे` : lang === 'pa' ? `${time} ਵਜੇ` : `at ${time.replace(/\s?([ap])m$/i, ' $1.m.').toLowerCase()}`;
    return [date, time].filter(Boolean).join('\n');
  }
  /** The date alone, without the weekday (cover and "reply by"). */
  function shortDate(inv, ev, lang) {
    if (!ev || !ev.date) return '';
    const tz = inv.timezone || 'Asia/Kolkata';
    if (lang !== 'en') return IX.fmtDate(ev.date, tz, lang);
    const d = IX.zonedToUtc(ev.date, '12:00', tz);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.day}^{${ORD(+p.day)}} ${p.month} ${p.year}`;
  }
  /** All words the page can show, for one language. */
  function words(inv, lang, placeholders) {
    const t = (k) => {
      const own = inv.text && inv.text[lang] && inv.text[lang][k];
      if (own) return own;
      // names and the heading fall back to the main language so a second language never loses them
      if (['bride', 'groom'].includes(k)) return (inv.text[inv.defaultLang] || {})[k] || (inv.text.en || {})[k] || '';
      return '';
    };
    const ev = (inv.events || [])[0] || {};
    const out = {
      heading: t('heading'), bride: t('bride'), groom: t('groom'),
      parents: [t('brideParents'), t('groomParents')].filter(Boolean).join('\n'),
      message: htmlText(t('message')), when: whenText(inv, ev, lang), reception: t('reception'),
      venue: [ev.venue, ev.address, ev.city].filter(Boolean).join('\n'), rsvp: t('rsvpNote'), blessing: t('blessing'),
    };
    // lines for the other pages: titles fall back to starting words until the host types (an empty line hides them)
    const pd = (k) => { const v = inv.text && inv.text[lang] && inv.text[lang][k]; return v == null ? ((ST().PAGE_DEFAULTS[lang] || ST().PAGE_DEFAULTS.en)[k] || '') : v; };
    out.coverLine = pd('coverLine'); out.eventsTitle = pd('eventsTitle'); out.rsvpTitle = pd('rsvpTitle');
    out.underNames = t('underNames');
    out.shortDate = shortDate(inv, ev, lang); out.city = ev.city || '';
    (inv.events || []).forEach((e, i) => {
      if (!e || !(e.name || e.date)) return;
      out['ev' + i + 'n'] = e.name || '';
      out['ev' + i + 'd'] = [whenText(inv, e, lang).replace(/\n/, lang === 'en' ? ' ' : ', '), [e.venue, e.city].filter(Boolean).join(', ')].filter(Boolean).join('\n');
    });
    const dl = inv.settings && inv.settings.rsvpDeadline;
    if (dl) {
      const d = shortDate(inv, { date: dl }, lang);
      out.rsvpBy = lang === 'hi' ? `${d} तक उत्तर की प्रतीक्षा रहेगी` : lang === 'pa' ? `${d} ਤੱਕ ਜਵਾਬ ਦੀ ਉਡੀਕ ਰਹੇਗੀ` : `The favour of a reply is requested by ${d}`;
    } else out.rsvpBy = '';
    const c = inv.contact || {};
    out.contact = [c.name, c.phone].filter(Boolean).join(' · ');
    out.rsvpLink = inv.slug && IX.inviteUrl ? IX.inviteUrl(inv.slug).replace(/^https?:\/\//, '') : '';
    const ph = {};
    if (placeholders) {
      const S = ST().SAMPLES;
      if (!out.bride) { out.bride = S.bride; ph.bride = 1; }
      if (!out.groom) { out.groom = S.groom; ph.groom = 1; }
      if (!out.when) { out.when = lang === 'en' ? 'Saturday, 14^{th} February 2027\nat 7 p.m.' : ''; ph.when = 1; }
      if (!out.venue) { out.venue = S.venue; ph.venue = 1; }
      if (!out.shortDate && lang === 'en') { out.shortDate = '14^{th} February 2027'; ph.shortDate = 1; }
      if (!out.rsvpLink) { out.rsvpLink = 'Your invitation link appears here once it is published'; ph.rsvpLink = 1; }
      if (!out.ev0n && !out.ev0d) { out.ev0n = 'Wedding Ceremony'; out.ev0d = out.when.replace(/\n/, ' ') + '\n' + out.venue; ph.ev0n = ph.ev0d = 1; }
    }
    return { w: out, ph };
  }

  /* ---------- fonts for a piece of text ---------- */
  function fontFor(cal, style, role, o, text) {
    const sc = FN().scriptOf(text);
    const disp = role === 'names' || role === 'heading' || role === 'amp';
    let choice;
    if (sc === 'deva') choice = o.fontHi || (style.indic.deva || {})[disp ? 'display' : 'text'];
    else if (sc === 'guru') choice = o.fontPa || (style.indic.guru || {})[disp ? 'display' : 'text'];
    else choice = o.font || style.type[role].font;
    const f = FN().pick(choice, sc === 'other' ? 'latn' : sc);
    const r = style.type[role] || {};
    const w = FN().weightOf(f, sc === 'latn' && !o.font ? r.w || undefined : o.w);
    const italic = sc === 'latn' && f.italic && (o.font ? o.italic : o.italic != null ? o.italic : r.italic);
    const hi = sc === 'deva' ? f.name : (o.fontHi || (style.indic.deva || {}).text);
    const pa = sc === 'guru' ? f.name : (o.fontPa || (style.indic.guru || {}).text);
    return { f, sc, w, italic: !!italic, family: FN().stack(f.name, hi, pa) };
  }
  const cssFont = (ff, px) => `${ff.italic ? 'italic ' : ''}${ff.w} ${r1(px)}px ${ff.family}`;
  function measure(text, ff, px, tracking = 0) {
    const c = cx2d();
    c.font = cssFont(ff, px);
    try { c.letterSpacing = tracking + 'px'; } catch (e) { /* older browsers */ }
    const plain = String(text).replace(/\^\{(.*?)\}/g, '$1');
    let w = c.measureText(plain).width;
    if ('letterSpacing' in c === false) w += tracking * Math.max(0, plain.length - 1);
    // superscripts are drawn at 60%
    const sups = String(text).match(/\^\{(.*?)\}/g) || [];
    sups.forEach((s) => { w -= c.measureText(s.slice(2, -1)).width * 0.4; });
    return w;
  }
  function wrap(text, ff, px, tracking, maxW) {
    const out = [];
    String(text).split('\n').forEach((para) => {
      if (!para.trim()) { out.push(''); return; }
      const ws = para.split(/\s+/);
      let line = '';
      ws.forEach((w) => {
        const t = line ? line + ' ' + w : w;
        if (line && measure(t, ff, px, tracking) > maxW) { out.push(line); line = w; } else line = t;
      });
      out.push(line);
    });
    return out;
  }
  /** Wrap, then narrow the width as far as possible without adding lines, so lines come out even (no lonely last word). */
  function wrapEven(text, ff, px, tracking, maxW) {
    const base = wrap(text, ff, px, tracking, maxW);
    if (base.length < 2) return base;
    let lo = maxW * 0.45, hi = maxW, best = base;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2, t = wrap(text, ff, px, tracking, mid);
      if (t.length <= base.length) { hi = mid; best = t; } else lo = mid;
    }
    return best;
  }
  const tspanText = (line, px) => esc(line).replace(/\^\{(.*?)\}/g, (_m, s) => `<tspan baseline-shift="super" font-size="${r1(px * 0.55)}">${s}</tspan>`);

  /* ---------- inks ---------- */
  function paintFor(D, ink, kind) {
    const L = LIB();
    const i = L.INK[ink];
    if (i && i.metal && D.sheen) { D.use.add('m:' + ink); return `url(#${D.uid}-${kind === 'orn' ? 'mo' : 'mt'}-${ink})`; }
    if (i && i.duo && D.sheen !== 'flat') { D.use.add('d:' + ink); return `url(#${D.uid}-${kind === 'orn' ? 'do' : 'dt'}-${ink})`; }
    return L.inkColor(ink);
  }
  function inkDefs(D) {
    let s = '';
    D.use.forEach((k) => {
      const [t, id] = k.split(':'), i = LIB().INK[id];
      const mk = (list) => list.map((c, n, a) => `<stop offset="${r1((n / (a.length - 1)) * 100)}%" stop-color="${c}"/>`).join('');
      const stops = mk(t === 'm' ? i.metal : i.duo);
      if (t === 'm') {
        // on light paper small gold text keeps to the deeper tones so it stays readable
        const textStops = D.darkPaper ? stops : mk([i.metal[0], i.metal[1], i.metal[0], i.metal[4]]);
        s += `<linearGradient id="${D.uid}-mt-${id}" x1="0" y1="0" x2="1" y2="1">${textStops}</linearGradient>`;
        s += `<linearGradient id="${D.uid}-mo-${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${D.W}" y2="${D.H * 0.6}" spreadMethod="reflect">${stops}</linearGradient>`;
      } else {
        s += `<linearGradient id="${D.uid}-dt-${id}" x1="0" y1="0" x2="0.35" y2="1">${stops}</linearGradient>`;
        s += `<linearGradient id="${D.uid}-do-${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${D.H}">${stops}</linearGradient>`;
      }
    });
    return s;
  }

  /* ---------- text blocks ---------- */
  const ROLE_OF = { heading: 'heading', parents: 'small', message: 'main', when: 'details', reception: 'details', venue: 'details', rsvp: 'small', blessing: 'main',
    underNames: 'main', coverLine: 'heading', shortDate: 'details', city: 'small', eventsTitle: 'names', rsvpTitle: 'names', rsvpBy: 'details', rsvpLink: 'small', contact: 'details' };
  const INK_OF = { heading: 'heading', parents: 'main', message: 'main', when: 'details', reception: 'details', venue: 'details', rsvp: 'main', blessing: 'heading',
    underNames: 'main', coverLine: 'heading', shortDate: 'details', city: 'details', eventsTitle: 'bride', rsvpTitle: 'bride', rsvpBy: 'details', rsvpLink: 'details', contact: 'details' };
  // page titles use the names' lettering at about half the size; event names use the heading lettering
  const SIZE_OF = { eventsTitle: 0.5, rsvpTitle: 0.5, shortDate: 1.1, evn: 1.15, coverLine: 1.2, 'rsvp:rsvp': 1.35 };
  /** "cover:names" → "names"; "ev2n" → "evn". */
  const baseOf = (id) => String(id).split(':').pop();
  const kindOf = (b) => (/^ev\d+n$/.test(b) ? 'evn' : /^ev\d+d$/.test(b) ? 'evd' : b);
  const roleOf = (id) => { const k = kindOf(baseOf(id)); return k === 'names' ? 'names' : k === 'evn' ? 'heading' : k === 'evd' ? 'details' : ROLE_OF[k]; };
  const inkOf = (id) => { const k = kindOf(baseOf(id)); return k === 'evn' ? 'heading' : k === 'evd' ? 'details' : INK_OF[k]; };
  function textBlock(D, id, text, ph) {
    const role = roleOf(id), o = D.cal.el[id] || {}, r = D.style.type[role];
    const ff = fontFor(D.cal, D.style, role, o, text);
    if (ff.sc === 'other') D.warn.add('other');
    const px = r.size * ff.f.k * (o.size || 1) * D.fit * (SIZE_OF[id] || SIZE_OF[kindOf(baseOf(id))] || 1);
    const tracking = o.tracking != null ? o.tracking : r.tracking || 0;
    const leading = Math.max(o.leading || r.leading || 1.25, ff.sc === 'deva' || ff.sc === 'guru' ? 1.3 : 0);
    const maxW = D.safeW * (o.width || 1);
    const lines = wrapEven(text, ff, px, tracking, maxW);
    const lh = px * leading;
    const h = lines.length * lh;
    const align = o.align || 'center';
    const paint = paintFor(D, o.ink || D.cal.inks[inkOf(id)], 'text');
    const lw = Math.max(...lines.map((l) => measure(l, ff, px, tracking)), 10);
    return {
      id, h, hw: lw, align, draw: (y) => {
        const x = align === 'left' ? D.mx : align === 'right' ? D.W - D.mx : D.W / 2;
        const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
        const tsp = lines.map((ln, i) => `<tspan x="${r1(x)}" y="${r1(y + lh * i + lh * 0.74)}">${tspanText(ln, px)}</tspan>`).join('');
        return `<text text-anchor="${anchor}" font-family="${esc(ff.family)}" font-size="${r1(px)}" font-weight="${ff.w}"${ff.italic ? ' font-style="italic"' : ''}${tracking ? ` letter-spacing="${tracking}"` : ''} fill="${paint}"${ph ? ' opacity=".38"' : ''}>${tsp}</text>`;
      },
    };
  }

  /* ---------- ornaments in the flow ---------- */
  const ORN_WIDTH = { top: 0.6, under: 0.62, divider: 0.42, mark: 0.26 };
  function ornBlock(D, id, slot, ref) {
    const o = LIB().O[ref]; if (!o) return null;
    const el = D.cal.el[id] || {};
    const isMotif = o.kind === 'motif' || o.kind === 'mark';
    let sc = isMotif ? Math.min((D.safeW * ORN_WIDTH[slot]) / o.w, (slot === 'mark' ? 70 : 96) / o.h) : (D.safeW * ORN_WIDTH[slot]) / o.w;
    sc *= (el.scale || 1) * Math.max(D.fit, 0.75);
    const h = o.h * sc;
    const paint = paintFor(D, el.ink || D.cal.inks.flourish, 'orn');
    return { id, h, hw: o.w * sc, orn: true, draw: (y) => `<g transform="translate(${r1(D.W / 2)} ${r1(y + h / 2)}) scale(${r1(sc * 1000) / 1000})" opacity="${el.opacity != null ? el.opacity : 1}">${LIB().ornament(ref).replace(/currentColor/g, paint)}</g>` };
  }

  /* ---------- the names ---------- */
  function nameRuns(D, name, which, px, initPx, ffN, ffI, ph) {
    const chars = Array.from(name);
    const useInit = D.cal.initials !== 'none' && ffN.sc === 'latn' && /[A-Za-zÀ-ɏ]/.test(chars[0] || '') && chars.length > 1;
    const o = D.cal.el.names || {};
    const inkName = (which === 'bride' ? o.inkBride : o.inkGroom) || D.cal.inks[which];
    const runs = [];
    if (useInit) {
      runs.push({ t: chars[0], ff: ffI, px: initPx, paint: paintFor(D, o.inkInitials || D.cal.inks.initials, 'text'), init: true });
      runs.push({ t: chars.slice(1).join(''), ff: ffN, px, paint: paintFor(D, inkName, 'text') });
    } else runs.push({ t: name, ff: ffN, px, paint: paintFor(D, inkName, 'text') });
    runs.forEach((r) => { r.w = measure(r.t, r.ff, r.px); r.ph = ph; });
    const kern = useInit ? -initPx * 0.03 : 0;
    return { runs, kern, w: runs.reduce((a, r) => a + r.w, 0) + kern, init: useInit };
  }
  function namesBlock(D, W, ph) {
    const o = D.cal.el.names || {}, st = D.style;
    const layout = D.cal.nameLayout || 'stacked';
    const sizeK = (o.size || 1) * Math.sqrt(D.fit) * (D.nameScale || 1);
    const mk = (which) => {
      const text = W[which];
      const ff = fontFor(D.cal, st, 'names', o, text);
      const ffI = fontFor(D.cal, st, 'initial', { font: o.initialFont }, text);
      const px = st.type.names.size * ff.f.k * sizeK * (which === 'bride' ? o.sizeBride || 1 : o.sizeGroom || 1);
      const initPx = px * (st.type.initial.size || 1.4) * (ffI.f.k / ff.f.k) * (D.cal.initials === 'none' ? 1 : 1);
      return { which, text, ff, ffI, px, initPx };
    };
    const a = mk('bride'), b = mk('groom');
    const ampText = o.amp || (D.lang === 'hi' ? 'संग' : D.lang === 'pa' ? 'ਸੰਗ' : '&');
    const ffA = fontFor(D.cal, st, 'amp', o, ampText);
    const ampPx = st.type.amp.size * ffA.f.k * sizeK * 1.45;
    const maxW = layout === 'inline' ? D.safeW : D.safeW * (layout === 'staggered' ? 0.84 : 1);
    // build lines; shrink to fit, and only split a name over two lines when shrinking is not enough
    const build = (k) => {
      const lines = [];
      [a, b].forEach((n, i) => {
        let parts = [n.text];
        const one = nameRuns(D, n.text, n.which, n.px * k, n.initPx * k, n.ff, n.ffI, ph[n.which]);
        if (one.w > maxW / (layout === 'inline' ? 2.2 : 1) && k <= 0.5 && /\s/.test(n.text.trim())) {
          const ws = n.text.trim().split(/\s+/), mid = Math.ceil(ws.length / 2);
          parts = [ws.slice(0, mid).join(' '), ws.slice(mid).join(' ')];
        }
        parts.forEach((p, j) => lines.push({ ...nameRuns(D, p, n.which, n.px * k, j ? n.px * k : n.initPx * k, n.ff, j ? n.ff : n.ffI, ph[n.which]), which: n.which, px: n.px * k, initPx: j ? n.px * k : n.initPx * k, cont: j > 0 }));
        if (i === 0) lines.push({ amp: true, t: ampText, px: ampPx * Math.max(k, 0.75), w: measure(ampText, ffA, ampPx * Math.max(k, 0.75)) });
      });
      return lines;
    };
    let k = 1, lines = build(k);
    const widest = (ls) => (layout === 'inline' ? ls.reduce((s, l) => s + l.w, 0) + ampPx * 0.6 : Math.max(...ls.map((l) => l.w)));
    for (let i = 0; i < 8 && widest(lines) > maxW; i++) { k *= Math.max(0.55, maxW / widest(lines)); lines = build(k); }
    if (widest(lines) > maxW * 1.02) D.warn.add('long');
    // vertical metrics
    const asc = (l) => (l.amp ? l.px * 0.75 : Math.max(l.px * 0.72, l.init ? l.initPx * 0.7 : 0));
    const step = (l) => (l.amp ? l.px * 0.9 : l.px * (layout === 'staggered' ? 0.8 : 0.86));
    let h;
    if (layout === 'inline') h = Math.max(...lines.map(asc)) + lines[0].px * 0.42;
    else if (layout === 'arch') h = asc(lines[0]) + D.safeW * 0.1 + lines.slice(1).reduce((s, l) => s + step(l) + (l.amp ? 0 : D.safeW * 0.03), 0) + lines[lines.length - 1].px * 0.3;
    else h = asc(lines[0]) + lines.slice(1).reduce((s, l) => s + step(l), 0) + lines[lines.length - 1].px * 0.3;

    const drawRuns = (l, x, y) => {
      let s = '', cx = x;
      l.runs.forEach((r, i) => {
        s += `<text x="${r1(cx)}" y="${r1(y)}" font-family="${esc(r.ff.family)}" font-size="${r1(r.px)}" font-weight="${r.ff.w}"${r.ff.italic ? ' font-style="italic"' : ''} fill="${r.paint}"${r.ph ? ' opacity=".38"' : ''}${r.init ? ' data-init="1"' : ''}>${esc(r.t)}</text>`;
        cx += r.w + (i === 0 ? l.kern : 0);
      });
      return s;
    };
    const deco = (l, x, y) => {
      if (!l.init || l.cont || D.cal.initials !== 'flourished') return '';
      let s = '';
      const ip = l.initPx, iw = l.runs[0].w;
      if (D.cal.orn.initialFlourish && !D.cal.removed.includes('names-curl')) {
        const sc = ip / 240;
        s += `<g transform="translate(${r1(x + iw * 0.12)} ${r1(y - ip * 0.6)}) scale(${r1(-sc * 1000) / 1000} ${r1(sc * 1000) / 1000})" opacity=".8">${LIB().ornament('curl').replace(/currentColor/g, paintFor(D, D.cal.inks.flourish, 'orn'))}</g>`;
      }
      if (D.cal.orn.sprig && !D.cal.removed.includes('names-sprig')) {
        const sc = ip / 170;
        s += `<g transform="translate(${r1(x + iw * 0.55)} ${r1(y + ip * 0.02)}) rotate(-30) scale(${r1(sc * 1000) / 1000})">${LIB().ornament('leaf-sprig').replace(/currentColor/g, paintFor(D, D.cal.inks.sprig || D.cal.inks.flourish, 'orn'))}</g>`;
      }
      return s;
    };
    const ampDraw = (l, x, y) => `<text x="${r1(x)}" y="${r1(y)}" text-anchor="middle" font-family="${esc(ffA.family)}" font-size="${r1(l.px)}" font-weight="${ffA.w}" fill="${paintFor(D, o.inkAmp || D.cal.inks.amp, 'text')}">${esc(l.t)}</text>`;

    return {
      id: 'names', h, hw: Math.min(D.safeW * 1.04, widest(lines) * (layout === 'staggered' ? 1.2 : 1)), draw: (top) => {
        const cx = D.W / 2;
        let s = '', y = top + asc(lines[0]);
        if (layout === 'inline') {
          const total = widest(lines);
          let x = cx - total / 2;
          lines.forEach((l) => {
            if (l.amp) { x += ampPx * 0.3; s += ampDraw(l, x + l.w / 2, y); x += l.w + ampPx * 0.3; return; }
            s += deco(l, x, y) + drawRuns(l, x, y); x += l.w;
          });
          return s;
        }
        if (layout === 'arch') {
          const sag = D.safeW * 0.1;
          y += sag;
          lines.forEach((l, i) => {
            if (i) y += step(l) + (l.amp ? 0 : D.safeW * 0.03);
            if (l.amp) { s += ampDraw(l, cx, y); return; }
            const up = l.which === 'bride' && !l.cont;
            const half = Math.min(D.safeW / 2, l.w * 0.62), pid = `${D.uid}-arc-${i}`;
            const d = `M${r1(cx - half * 1.3)} ${r1(y)} Q${r1(cx)} ${r1(up ? y - sag * 2 : y + sag * 1.4)} ${r1(cx + half * 1.3)} ${r1(y)}`;
            s += `<path id="${pid}" d="${d}" fill="none"/>`;
            s += `<text font-family="${esc(l.runs[l.runs.length - 1].ff.family)}"><textPath href="#${pid}" startOffset="50%" text-anchor="middle">${l.runs.map((r) => `<tspan font-family="${esc(r.ff.family)}" font-size="${r1(r.px)}" font-weight="${r.ff.w}" fill="${r.paint}"${r.ph ? ' opacity=".38"' : ''}>${esc(r.t)}</tspan>`).join('')}</textPath></text>`;
          });
          return s;
        }
        lines.forEach((l, i) => {
          if (i) y += step(l);
          let x;
          if (layout === 'staggered') {
            const off = D.safeW * 0.08;
            x = l.amp ? cx + off * 0.2 : l.which === 'bride' ? cx - l.w / 2 - off : cx - l.w / 2 + off;
            x = Math.max(D.mx - D.safeW * 0.02, Math.min(x, D.W - D.mx - l.w));
          } else x = cx - l.w / 2;
          if (l.amp) {
            if (layout === 'staggered') {
              const g = lines[i + 1], gx = Math.max(D.mx - D.safeW * 0.02, Math.min(cx - g.w / 2 + D.safeW * 0.08, D.W - D.mx - g.w));
              s += ampDraw(l, Math.max(D.mx + l.w / 2, gx - l.w * 0.9), y - l.px * 0.15);
              y -= l.px * 0.55;
            } else s += ampDraw(l, cx, y);
            return;
          }
          s += deco(l, x, y) + drawRuns(l, x, y);
        });
        return s;
      },
    };
  }

  /* ---------- paper, border, corners ---------- */
  function paperLayer(D) {
    const p = D.cal.paper, L = LIB();
    const base = { ...L.PAPER[p.id], ...p };
    const inset = base.deckle ? 10 : 0;
    let s = `<g${base.deckle ? ` filter="url(#${D.uid}-deckle)"` : ''}><rect x="${inset}" y="${inset}" width="${D.W - inset * 2}" height="${D.H - inset * 2}" fill="${base.color}"/>`;
    if (base.pattern === 'wash') s += `<g filter="url(#${D.uid}-wash)"><ellipse cx="${D.W * 0.18}" cy="${D.H * 0.12}" rx="${D.W * 0.32}" ry="${D.H * 0.14}" fill="url(#${D.uid}-w1)"/><ellipse cx="${D.W * 0.85}" cy="${D.H * 0.9}" rx="${D.W * 0.36}" ry="${D.H * 0.16}" fill="url(#${D.uid}-w1)"/><ellipse cx="${D.W * 0.9}" cy="${D.H * 0.2}" rx="${D.W * 0.16}" ry="${D.H * 0.08}" fill="url(#${D.uid}-w1)"/></g>`;
    else if (base.pattern && base.pattern !== 'none') s += `<rect x="${inset}" y="${inset}" width="${D.W - inset * 2}" height="${D.H - inset * 2}" fill="url(#${D.uid}-pat)"/>`;
    if (base.texture && base.texture !== 'none') s += `<rect x="${inset}" y="${inset}" width="${D.W - inset * 2}" height="${D.H - inset * 2}" filter="url(#${D.uid}-tex)"/>`;
    if (base.texture === 'cotton' || base.deckle) s += `<rect x="${inset}" y="${inset}" width="${D.W - inset * 2}" height="${D.H - inset * 2}" filter="url(#${D.uid}-fib)"/>`;
    s += `<rect x="${inset}" y="${inset}" width="${D.W - inset * 2}" height="${D.H - inset * 2}" fill="url(#${D.uid}-vig)"/></g>`;
    // border
    const bp = paintFor(D, p.borderInk || D.cal.inks.flourish, 'orn'), b = p.border;
    const R = (i, w, extra = '') => `<rect x="${i}" y="${i}" width="${D.W - i * 2}" height="${D.H - i * 2}" fill="none" stroke="${bp}" stroke-width="${w}"${extra}/>`;
    if (b === 'fine') s += R(44, 1.6);
    else if (b === 'double') s += R(40, 2.4) + R(52, 1);
    else if (b === 'rule') s += R(46, 1.2) + [[46, 46], [D.W - 46, 46], [46, D.H - 46], [D.W - 46, D.H - 46]].map(([x, y]) => `<path d="M${x} ${y - 9}L${x + 7} ${y}L${x} ${y + 9}L${x - 7} ${y}Z" fill="${bp}"/>`).join('');
    else if (b === 'deckle-inset') s += R(58, 1, ' opacity=".55"') + R(66, 0.6, ' opacity=".4"');
    // corners
    if (p.corners && p.corners !== 'none' && L.O[p.corners]) {
      const o = L.O[p.corners], sc = 150 / o.w, off = b && b !== 'none' ? 50 : 40;
      [['tl', 1, 1, off, off], ['tr', -1, 1, D.W - off, off], ['bl', 1, -1, off, D.H - off], ['br', -1, -1, D.W - off, D.H - off]].forEach(([k, sx, sy, x, y]) => {
        if (D.cal.removed.includes('corner-' + k)) return;
        const el = D.cal.el['corner-' + k] || {};
        s += `<g data-el="corner-${k}" data-kind="orn" transform="translate(${x + (el.dx || 0)} ${y + (el.dy || 0)}) scale(${sx * sc * (el.scale || 1)} ${sy * sc * (el.scale || 1)})" opacity="${el.opacity != null ? el.opacity : 1}">${o.draw().replace(/currentColor/g, paintFor(D, el.ink || D.cal.inks.flourish, 'orn'))}</g>`;
      });
    }
    return s;
  }

  /* ---------- the page ---------- */
  const FLOW = [
    ['heading', 'text'], ['orn-top', 'orn', 'top'], ['names', 'names'], ['underNames', 'text'], ['orn-under', 'orn', 'under'], ['parents', 'text'], ['message', 'text'],
    ['when', 'text'], ['reception', 'text'], ['orn-divider', 'orn', 'divider'], ['venue', 'text'], ['rsvp', 'text'], ['blessing', 'text'], ['orn-mark', 'orn', 'mark'],
  ];
  /* The other pages of the set, in the same paper, inks and lettering. Ids on them are "<page>:<item>". */
  function flowFor(page, Wd) {
    if (page === 'cover') return [['coverLine', 'text'], ['orn-top', 'orn', 'top'], ['names', 'names'], ['orn-under', 'orn', 'under'], ['shortDate', 'text'], ['city', 'text'], ['orn-mark', 'orn', 'mark']];
    if (page === 'events') {
      const f = [['eventsTitle', 'text'], ['orn-under', 'orn', 'under']];
      Object.keys(Wd).filter((k) => /^ev\d+n$/.test(k)).forEach((k, i) => {
        const n = k.slice(2, -1);
        if (i) f.push(['orn-d' + n, 'orn', 'divider']);
        f.push(['ev' + n + 'n', 'text'], ['ev' + n + 'd', 'text']);
      });
      return f.concat([['orn-mark', 'orn', 'mark']]);
    }
    if (page === 'rsvp') return [['rsvpTitle', 'text'], ['orn-under', 'orn', 'under'], ['rsvp', 'text'], ['rsvpBy', 'text'], ['qr', 'qr'], ['rsvpLink', 'text'], ['contact', 'text'], ['orn-mark', 'orn', 'mark']];
    return FLOW;
  }
  const GAP_AFTER = { heading: 1.1, 'orn-top': 0.5, names: 0.9, underNames: 0.9, 'orn-under': 0.9, parents: 1, message: 1.2, when: 0.8, reception: 0.9, 'orn-divider': 0.9, venue: 1.1, rsvp: 1, blessing: 0.7,
    coverLine: 1.2, shortDate: 0.5, city: 1.4, eventsTitle: 0.6, evn: 0.35, evd: 0.9, rsvpTitle: 0.6, rsvpBy: 1, qr: 0.7, rsvpLink: 1.2, contact: 1 };
  const LABELS = { heading: 'Heading', names: 'Bride & groom names', underNames: 'Line under the names', parents: 'Parents', message: 'Message', when: 'Date & time', reception: 'Reception', venue: 'Venue', rsvp: 'RSVP', blessing: 'Blessing', 'orn-top': 'Flourish above names', 'orn-under': 'Flourish below names', 'orn-divider': 'Divider', 'orn-mark': 'Closing mark',
    coverLine: 'Cover line', shortDate: 'Date', city: 'Town or city', eventsTitle: 'Events title', evn: 'Event name', evd: 'Event date and place', 'orn-d': 'Divider', rsvpTitle: 'RSVP title', rsvpBy: 'Reply-by date', qr: 'QR code', rsvpLink: 'Invitation link', contact: 'Contact' };
  const labelOf = (id) => { const b = baseOf(id); return LABELS[b] || LABELS[kindOf(b)] || (/^orn-d\d+$/.test(b) ? 'Divider' : ''); };

  /* ---------- QR code for the RSVP page (drawn in ink, straight on the paper) ---------- */
  function qrBlock(D, id, url, ph) {
    const side = 210 * Math.max(D.fit, 0.8) * ((D.cal.el[id] || {}).scale || 1);
    // the darkest-against-paper ink of the design, so phones can read it
    const pc = D.cal.paper.color || LIB().PAPER[D.cal.paper.id].color;
    const best = ['details', 'main', 'bride', 'groom', 'heading'].map((k) => D.cal.inks[k]).sort((a, b) => LIB().contrast(LIB().inkColor(b), pc) - LIB().contrast(LIB().inkColor(a), pc))[0];
    const paint = LIB().inkColor((D.cal.el[id] || {}).ink || best);
    let inner = '';
    if (url && typeof qrcode === 'function') {
      const q = qrcode(0, 'M'); q.addData(unescape(encodeURIComponent(url))); q.make();
      const n = q.getModuleCount(), m = side / n;
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${r1(c * m)} ${r1(r * m)}h${r1(m + 0.2)}v${r1(m + 0.2)}h${r1(-m - 0.2)}z`;
      inner = `<path d="${d}" fill="${paint}" shape-rendering="crispEdges"/>`;
    } else if (ph) inner = `<rect x="0" y="0" width="${r1(side)}" height="${r1(side)}" fill="none" stroke="${paint}" stroke-dasharray="8 6" opacity=".45"/><text x="${r1(side / 2)}" y="${r1(side / 2 + 10)}" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="30" fill="${paint}" opacity=".5">QR code</text>`;
    else return null;
    return { id, h: side, hw: side, draw: (y) => `<g transform="translate(${r1(D.W / 2 - side / 2)} ${r1(y)})">${inner}</g>` };
  }

  /**
   * Draw a page. opts: page (cover | main | events | rsvp), lang, editing (adds element hooks), placeholders, print (flat inks), uid.
   * Returns { svg, warnings[], fit, W, H }.
   */
  function draw(inv, opts = {}) {
    const cal = inv.calligraphy;
    const style = ST().STYLE[cal.style] || ST().STYLES[0];
    const size = ST().SIZES[cal.size] || ST().SIZES['5x7'];
    const lang = opts.lang || inv.defaultLang || 'en';
    const W = size.w, H = size.h;
    const corners = cal.paper.corners && cal.paper.corners !== 'none';
    const D = {
      cal: { el: {}, removed: [], added: [], orn: {}, ...cal }, style, lang, W, H, uid: opts.uid || 'ixc' + Math.random().toString(36).slice(2, 7),
      sheen: opts.print ? false : cal.sheen !== false, use: new Set(), warn: new Set(), fit: 1,
    };
    D.darkPaper = LIB().lum(cal.paper.color || LIB().PAPER[cal.paper.id].color) < 0.2;
    D.mx = corners ? 120 : 100; D.safeW = W - D.mx * 2;
    const my = corners ? 150 : 110, avail = H - my * 2;
    const { w: Wd, ph } = words(inv, lang, opts.placeholders);
    const page = ['cover', 'events', 'rsvp'].includes(opts.page) ? opts.page : 'main';
    const pid = (b) => (page === 'main' ? b : page + ':' + b);
    D.nameScale = page === 'cover' ? 1.15 : 1;
    const build = () => {
      D.use = new Set();
      const items = [];
      flowFor(page, Wd).forEach(([b, kind, slot]) => {
        const id = pid(b);
        if (D.cal.removed.includes(id) || (D.cal.el[id] || {}).hidden) return;
        if (kind === 'text') { if (Wd[b] && String(Wd[b]).trim()) items.push(textBlock(D, id, Wd[b], ph[b])); }
        else if (kind === 'names') { const nb = namesBlock(D, Wd, ph); nb.id = id; items.push(nb); }
        else if (kind === 'qr') { const q = qrBlock(D, id, inv.slug && IX.inviteUrl ? IX.inviteUrl(inv.slug) : '', opts.placeholders); if (q) items.push(q); }
        else { const ref = (D.cal.el[id] || {}).ref || D.cal.orn[slot]; if (ref) { const ob = ornBlock(D, id, slot, ref); if (ob) items.push(ob); } }
      });
      const unit = 26 * D.fit;
      let total = 0;
      items.forEach((it, i) => { const k = kindOf(baseOf(it.id)); it.gap = i < items.length - 1 ? unit * (GAP_AFTER[k] || 1) : 0; total += it.h + it.gap; });
      return { items, total };
    };
    let L = build();
    for (let i = 0; i < 4 && L.total > avail && D.fit > 0.58; i++) { D.fit = Math.max(0.58, D.fit * (avail / L.total) * 0.99); L = build(); }
    if (L.total > avail * 1.03) D.warn.add('overflow');
    let y = my + Math.max(0, (avail - L.total) / 2);
    let body = '';
    L.items.forEach((it) => {
      const o = D.cal.el[it.id] || {};
      let inner = it.draw(y);
      if (opts.editing) {
        // an invisible box so the whole line can be tapped, not only the ink of the letters
        const w = it.hw || D.safeW, x = it.align === 'left' ? D.mx : it.align === 'right' ? W - D.mx - w : (W - w) / 2;
        inner = `<rect class="ixc-hit" x="${r1(x - 8)}" y="${r1(y - 6)}" width="${r1(w + 16)}" height="${r1(it.h + 12)}" fill="transparent" pointer-events="all"/>` + inner;
      }
      const cy = y + it.h / 2;
      const tf = `translate(${o.dx || 0} ${o.dy || 0})${o.rot ? ` rotate(${o.rot} ${W / 2} ${r1(cy)})` : ''}`;
      body += opts.editing ? `<g data-el="${it.id}" data-kind="${it.orn ? 'orn' : baseOf(it.id) === 'names' ? 'names' : baseOf(it.id) === 'qr' ? 'qr' : 'text'}" transform="${tf}">${inner}</g>` : `<g transform="${tf}">${inner}</g>`;
      y += it.h + it.gap;
    });
    // ornaments the host added
    (D.cal.added || []).forEach((a) => {
      const o = LIB().O[a.ref]; if (!o || (a.page || 'main') !== page) return;
      const sc = (a.scale || 1) * (a.w || 160) / o.w;
      const inner = (opts.editing ? `<rect x="${-o.w / 2}" y="${-o.h / 2}" width="${o.w}" height="${o.h}" fill="transparent" pointer-events="all"/>` : '') + LIB().ornament(a.ref).replace(/currentColor/g, paintFor(D, a.ink || D.cal.inks.flourish, 'orn'));
      body += `<g${opts.editing ? ` data-el="${a.id}" data-kind="orn"` : ''} transform="translate(${r1(a.x)} ${r1(a.y)}) rotate(${a.rot || 0}) scale(${r1(sc * 1000) / 1000})" opacity="${a.opacity != null ? a.opacity : 1}">${inner}</g>`;
    });
    const paper = paperLayer(D);
    const pdefs = LIB().paperDefs(D.uid, { ...LIB().PAPER[cal.paper.id], ...cal.paper }, W, H, LIB().inkColor(cal.inks.flourish));
    // readable ink check
    const pc = cal.paper.color || LIB().PAPER[cal.paper.id].color;
    if (['heading', 'details', 'main'].some((k) => LIB().contrast(LIB().inkColor(cal.inks[k]), pc) < 2.6)) D.warn.add('contrast');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="ixc-page" role="img" aria-label="${esc([Wd.bride, Wd.groom].filter(Boolean).join(' & ') || 'Calligraphy invitation')}"><defs>${pdefs}${inkDefs(D)}</defs>${paper}${body}</svg>`;
    return { svg, warnings: [...D.warn], fit: D.fit, W, H, page };
  }
  /** Every page of the set that is switched on, in order. */
  async function renderPages(inv, opts = {}) {
    await FN().ensure(fontsNeeded(inv, opts.lang || inv.defaultLang || 'en'));
    return ST().pagesOn(inv.calligraphy).map((page) => draw(inv, { ...opts, page, uid: (opts.uid || 'ixp') + '-' + page }));
  }

  /** Fonts a design needs (for loading before drawing). */
  function fontsNeeded(inv, lang) {
    const cal = inv.calligraphy, st = ST().STYLE[cal.style] || ST().STYLES[0];
    const out = [];
    const add = (n, w) => n && out.push([n, w || (FN().BY[n] ? FN().BY[n].w || FN().BY[n].weights[0] : 400)]);
    Object.values(st.type).forEach((r) => add(r.font, r.w || undefined));
    Object.values(cal.el || {}).forEach((o) => { add(o.font, o.w); add(o.fontHi); add(o.fontPa); add(o.initialFont); });
    const { w } = words(inv, lang, true);
    const all = Object.values(w).join(' ');
    if (FN().hasScript(all, 'deva')) { add(st.indic.deva.display); add(st.indic.deva.text); }
    if (FN().hasScript(all, 'guru')) { add(st.indic.guru.display); add(st.indic.guru.text); }
    // every weight a font offers that a style asks for
    Object.values(st.type).forEach((r) => { const f = FN().BY[r.font]; if (f) f.weights.forEach((wt) => add(r.font, wt)); });
    return out;
  }
  async function render(inv, opts = {}) {
    await FN().ensure(fontsNeeded(inv, opts.lang || inv.defaultLang || 'en'));
    return draw(inv, opts);
  }
  const WARN_TEXT = {
    other: 'Some words are in a language our calligraphy fonts do not cover, so a standard font is used for them.',
    long: 'A name is very long, so it has been made smaller to fit. Try "Stacked" names or a narrower font.',
    overflow: 'There are a lot of words for one card, so some may sit close to the edge. Shorten a line or hide one.',
    contrast: 'Some ink is hard to read on this paper. Try a lighter ink on dark paper, or a darker ink on light paper.',
  };

  Object.assign(IXC, { draw, render, renderPages, fontsNeeded, words, htmlText, WARN_TEXT, LABELS, FLOW, baseOf, kindOf, roleOf, inkOf, labelOf });
})();
