/* InviteX Calligraphy Studio – downloads (window.IXC.exporter).
 *
 *  • PNG / JPG of one page at 300 dpi (1500 × 2100 px for 5 × 7 in).
 *  • All pages as PNGs in one ZIP.
 *  • PDF of all pages, for sharing and home printing.
 *  • Print PDF: 3 mm bleed on every side, crop marks, flat inks.
 *
 * Nothing is a screenshot. Each page is drawn again from the design:
 *  – lettering is shaped with HarfBuzz from the licensed font files (so Hindi and Punjabi
 *    letters join correctly and script fonts keep their connecting strokes) and written as
 *    vector outlines, sharp at any size;
 *  – flourishes, borders and corners stay vectors;
 *  – only the paper texture (made of noise filters) is a 300 dpi picture behind them.
 * The libraries (jsPDF, svg2pdf.js, HarfBuzz) load only when the host asks for a download. */
(function () {
  'use strict';
  const IXC = (window.IXC = window.IXC || {});
  const ST = () => IXC.styles, FN = () => IXC.fonts;
  const DPI = 300, BLEED_MM = 3, SLUG_MM = 8;

  /* ---------- libraries, on demand ---------- */
  const scripts = new Map();
  const loadScript = (src) => scripts.get(src) || scripts.set(src, new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s);
  })).get(src);
  async function pdfLibs() {
    await loadScript('js/vendor/jspdf.umd.min.js');
    await loadScript('js/vendor/svg2pdf.umd.min.js');
    return { jsPDF: window.jspdf.jsPDF, svg2pdf: window.svg2pdf.svg2pdf };
  }
  let hbP = null;
  const hb = () => hbP || (hbP = import(new URL('js/vendor/harfbuzz/index.mjs', document.baseURI).href));

  /* ---------- font files (read from the same fonts.css the studio uses) ---------- */
  let filesP = null;
  function fontFiles() {
    if (filesP) return filesP;
    const base = new URL('fonts/calligraphy/', document.baseURI);
    filesP = fetch(new URL('fonts.css', base)).then((r) => r.text()).then((css) => {
      const map = {};
      (css.match(/@font-face\s*{[^}]*}/g) || []).forEach((b) => {
        const fam = (/font-family:\s*'([^']+)'/.exec(b) || [])[1], url = (/url\('([^']+)'\)/.exec(b) || [])[1];
        if (!fam || !url) return;
        (map[fam] = map[fam] || []).push({ w: +((/font-weight:\s*(\d+)/.exec(b) || [])[1] || 400), italic: /font-style:\s*italic/.test(b), url: new URL(url, base).href });
      });
      return map;
    });
    return filesP;
  }
  const faces = new Map();
  async function face(family, weight = 400, italic = false) {
    const list = (await fontFiles())[family];
    if (!list) return null;
    const pick = list.slice().sort((a, b) => (a.italic !== italic) - (b.italic !== italic) || Math.abs(a.w - weight) - Math.abs(b.w - weight))[0];
    if (!faces.has(pick.url)) {
      faces.set(pick.url, (async () => {
        const H = await hb();
        const buf = await (await fetch(pick.url)).arrayBuffer();
        const f = new H.Face(new H.Blob(buf), 0);
        return { family, font: new H.Font(f), upem: f.upem, glyphs: new Map() };
      })());
    }
    return faces.get(pick.url);
  }

  /* ---------- lettering → outlines ---------- */
  const DEVA = /[ऀ-ॿ᳐-᳿꣠-ꣿ]/, GURU = /[਀-੿]/, LETTER = /\p{L}/u;
  const scriptOfChar = (c) => (DEVA.test(c) ? 'deva' : GURU.test(c) ? 'guru' : LETTER.test(c) ? 'latn' : '');
  /** Split a run into pieces of one script; spaces, digits and punctuation stay with their neighbours. */
  function segments(text) {
    const out = [];
    for (const ch of Array.from(text)) {
      const sc = scriptOfChar(ch), last = out[out.length - 1];
      if (last && (!sc || last.sc === sc || !last.sc)) { last.t += ch; if (!last.sc) last.sc = sc; } else out.push({ t: ch, sc });
    }
    return out.map((s) => ({ ...s, sc: s.sc || 'latn' }));
  }
  const familiesOf = (ff) => String(ff || '').split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  async function faceFor(families, sc, weight, italic) {
    const files = await fontFiles();
    const have = families.filter((n) => files[n]);
    const by = (n) => (FN().BY[n] || {}).script || 'latn';
    const name = (sc === 'latn' ? have.find((n) => by(n) === 'latn') || have[0] : have.find((n) => by(n) === sc)) || have[0] || 'Cormorant Garamond';
    return face(name, weight, italic && by(name) === 'latn');
  }
  /** Shape one run; returns glyphs with positions in user units, starting at pen x = 0. */
  async function shapeRun(run) {
    const out = []; let pen = 0;
    for (const seg of segments(run.text)) {
      let F = await faceFor(run.families, seg.sc, run.weight, run.italic);
      let r = shapeWith(F, seg.t);
      // a letter the font lacks: try the classic serif that ships with the studio
      if (r.some((g) => g.gid === 0) && F.family !== 'Cormorant Garamond') { const F2 = await face('Cormorant Garamond', run.weight, run.italic); const r2 = shapeWith(F2, seg.t); if (r2.filter((g) => g.gid === 0).length < r.filter((g) => g.gid === 0).length) { F = F2; r = r2; } }
      const s = run.size / F.upem;
      r.forEach((g) => { out.push({ F, gid: g.gid, x: pen + g.dx * s, y: -g.dy * s, adv: g.adv * s + run.spacing, s }); pen += g.adv * s + run.spacing; });
    }
    return { glyphs: out, width: pen };
  }
  let H0 = null;
  function shapeWith(F, text) {
    const H = H0;
    const b = new H.Buffer(); b.addText(text); b.guessSegmentProperties();
    H.shape(F.font, b);
    const inf = b.getGlyphInfos(), pos = b.getGlyphPositions();
    return inf.map((g, i) => ({ gid: g.codepoint, adv: pos[i].xAdvance, dx: pos[i].xOffset, dy: pos[i].yOffset }));
  }
  const n2 = (v) => Math.round(v * 100) / 100;
  /** Glyph outline moved to (x, y) at scale s, optionally turned by `ang` around (x, y). */
  function glyphPath(F, gid, x, y, s, ang = 0) {
    let cmds = F.glyphs.get(gid);
    if (!cmds) { cmds = F.font.glyphToJson(gid); F.glyphs.set(gid, cmds); }
    const c = Math.cos(ang), sn = Math.sin(ang);
    const P = (gx, gy) => { const u = gx * s, v = -gy * s; return `${n2(x + u * c - v * sn)} ${n2(y + u * sn + v * c)}`; };
    return cmds.map((k) => { const v = k.values; return k.type + (k.type === 'Z' ? '' : Array.from({ length: v.length / 2 }, (_, i) => P(v[i * 2], v[i * 2 + 1])).join(' ')); }).join('');
  }
  const attrUp = (el, name, stop) => { for (let e = el; e && e !== stop.parentNode; e = e.parentNode) { if (e.getAttribute && e.getAttribute(name) != null) return e.getAttribute(name); } return null; };
  function runStyle(el, top) {
    return {
      families: familiesOf(attrUp(el, 'font-family', top)), size: +attrUp(el, 'font-size', top) || 16, weight: +attrUp(el, 'font-weight', top) || 400,
      italic: attrUp(el, 'font-style', top) === 'italic', fill: attrUp(el, 'fill', top) || '#000', spacing: +(attrUp(el, 'letter-spacing', top) || 0),
    };
  }
  let measurer = null;
  function pathMeasurer(d) {
    if (!measurer) { measurer = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); measurer.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;left:-9999px'); document.body.appendChild(measurer); }
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); measurer.appendChild(p);
    return { len: p.getTotalLength(), at: (l) => p.getPointAtLength(Math.max(0, Math.min(p.getTotalLength(), l))), done: () => p.remove() };
  }

  /** Replace every <text> in an SVG string with outlined paths (same look, no fonts needed to show it). */
  async function outline(svg) {
    H0 = await hb();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const NS = 'http://www.w3.org/2000/svg';
    for (const t of [...doc.querySelectorAll('text')]) {
      const g = doc.createElementNS(NS, 'g');
      if (t.getAttribute('opacity')) g.setAttribute('opacity', t.getAttribute('opacity'));
      let d = '';
      const emit = (fill, path) => { const p = doc.createElementNS(NS, 'path'); p.setAttribute('d', path); p.setAttribute('fill', fill); g.appendChild(p); };
      const tp = t.querySelector('textPath');
      if (tp) {
        // names arched along a curve: each letter sits on the curve, turned with it
        const ref = (tp.getAttribute('href') || tp.getAttribute('xlink:href') || '').slice(1);
        const pe = doc.getElementById(ref); if (!pe) { t.remove(); continue; }
        const runs = [];
        for (const sp of tp.querySelectorAll('tspan')) runs.push({ ...runStyle(sp, t), text: sp.textContent });
        const shaped = await Promise.all(runs.map(shapeRun));
        const total = shaped.reduce((a, r) => a + r.width, 0);
        const m = pathMeasurer(pe.getAttribute('d'));
        let pen = m.len / 2 - total / 2;
        shaped.forEach((r, i) => {
          let path = '';
          r.glyphs.forEach((gl) => {
            const mid = pen + gl.x + gl.adv / 2, a = m.at(mid - 0.5), b = m.at(mid + 0.5), ang = Math.atan2(b.y - a.y, b.x - a.x), c = m.at(mid);
            path += glyphPath(gl.F, gl.gid, c.x - Math.cos(ang) * gl.adv / 2, c.y - Math.sin(ang) * gl.adv / 2, gl.s, ang);
          });
          pen += r.width;
          if (path) emit(runs[i].fill, path);
        });
        m.done();
      } else {
        // lines: <text x y>words</text>, or <text><tspan x y>line <tspan baseline-shift="super">st</tspan></tspan>…
        const lines = [];
        const lineEls = [...t.children].filter((c) => c.tagName === 'tspan' && c.getAttribute('x') != null);
        if (!lineEls.length) lineEls.push(t);
        for (const le of lineEls) {
          const base = runStyle(le, t), runs = [];
          for (const n of le.childNodes) {
            if (n.nodeType === 3) { if (n.textContent) runs.push({ ...base, text: n.textContent, shift: 0 }); }
            else if (n.tagName === 'tspan') { const st = runStyle(n, t); runs.push({ ...st, text: n.textContent, shift: n.getAttribute('baseline-shift') === 'super' ? base.size * 0.34 : 0 }); }
          }
          lines.push({ x: +le.getAttribute('x') || 0, y: +le.getAttribute('y') || 0, anchor: attrUp(le, 'text-anchor', t) || 'start', runs });
        }
        for (const L of lines) {
          const shaped = await Promise.all(L.runs.map(shapeRun));
          const total = shaped.reduce((a, r) => a + r.width, 0);
          let pen = L.x - (L.anchor === 'middle' ? total / 2 : L.anchor === 'end' ? total : 0);
          shaped.forEach((r, i) => {
            const path = r.glyphs.map((gl) => glyphPath(gl.F, gl.gid, pen + gl.x, L.y + gl.y - L.runs[i].shift, gl.s)).join('');
            pen += r.width;
            if (path) emit(L.runs[i].fill, path);
          });
        }
      }
      t.parentNode.replaceChild(g, t);
    }
    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  /* ---------- drawing a page for export ---------- */
  const sizeOf = (inv) => ST().SIZES[inv.calligraphy.size] || ST().SIZES['5x7'];
  const unitsPerMm = (inv) => sizeOf(inv).w / sizeOf(inv).mm[0];
  async function pageSvg(inv, page, o = {}) {
    await FN().ensure(IXC.fontsNeeded(inv, o.lang));
    const r = IXC.draw(inv, { page, lang: o.lang, print: !!o.print, layer: o.layer, bleed: o.bleed || 0, uid: 'ex' + page + (o.layer || '') });
    return { svg: await outline(r.svg), r };
  }
  /** SVG string → canvas at the given pixel size. */
  async function raster(svg, wPx, hPx, bg) {
    const s = svg.replace('<svg ', `<svg width="${wPx}" height="${hPx}" preserveAspectRatio="none" `);
    const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not draw the page')); i.src = url; });
      const c = document.createElement('canvas'); c.width = wPx; c.height = hPx;
      const x = c.getContext('2d');
      if (bg) { x.fillStyle = bg; x.fillRect(0, 0, wPx, hPx); }
      x.drawImage(img, 0, 0, wPx, hPx);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }
  const px = (mm) => Math.round((mm / 25.4) * DPI);
  const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));

  /** One page as a picture: { blob, name, width, height }. type: 'png' | 'jpeg'. */
  async function image(inv, o = {}) {
    const page = o.page || 'main', lang = o.lang || inv.defaultLang || 'en', z = sizeOf(inv);
    const { svg } = await pageSvg(inv, page, { lang });
    const w = px(z.mm[0]), h = Math.round(w * z.h / z.w);
    const jpg = o.type === 'jpeg';
    const c = await raster(svg, w, h, jpg ? '#ffffff' : '');
    return { blob: await toBlob(c, jpg ? 'image/jpeg' : 'image/png', 0.93), name: fileName(inv, page, lang, jpg ? 'jpg' : 'png'), width: w, height: h };
  }
  function fileName(inv, page, lang, ext) {
    const t = (inv.text[lang] || {}), who = [t.bride, t.groom].filter(Boolean).join('-') || 'invitation';
    const safe = who.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}-]+/gu, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'invitation';
    return `${safe}-${page ? (ST().PAGES.findIndex(([id]) => id === page) + 1) + '-' + page : 'card'}.${ext}`;
  }

  /** All pages as PNGs, in one ZIP. */
  async function zip(inv, o = {}) {
    const files = [];
    for (const page of ST().pagesOn(inv.calligraphy)) {
      const r = await image(inv, { ...o, page, type: 'png' });
      files.push({ name: r.name, data: new Uint8Array(await r.blob.arrayBuffer()) });
      o.progress && o.progress(files.length);
    }
    return { blob: zipStore(files), name: fileName(inv, '', o.lang || inv.defaultLang || 'en', 'zip').replace('-card.zip', '-pages.zip') };
  }

  /** PDF of every page that is switched on. print: bleed, crop marks and flat inks. */
  async function pdf(inv, o = {}) {
    const { jsPDF } = await pdfLibs();
    const lang = o.lang || inv.defaultLang || 'en', z = sizeOf(inv), print = !!o.print;
    const [tw, th] = [z.mm[0], z.mm[0] * z.h / z.w];
    const bl = print ? BLEED_MM : 0, sl = print ? SLUG_MM : 0;
    const pw = tw + 2 * (bl + sl), ph = th + 2 * (bl + sl);
    const doc = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: 'portrait', compress: true });
    const t = inv.text[lang] || {};
    doc.setProperties({ title: [t.bride, t.groom].filter(Boolean).join(' & ') + (print ? ' – print file' : ' – invitation'), creator: 'InviteX Calligraphy Studio', subject: 'Wedding invitation' });
    const pages = ST().pagesOn(inv.calligraphy);
    const bu = bl * unitsPerMm(inv);
    for (let i = 0; i < pages.length; i++) {
      if (i) doc.addPage([pw, ph], 'portrait');
      // 1. paper, as a 300 dpi picture (it is made of texture filters a PDF cannot hold)
      const paper = await pageSvg(inv, pages[i], { lang, print, layer: 'paper', bleed: bu });
      const c = await raster(paper.svg, px(tw + 2 * bl), px(th + 2 * bl), print ? '' : '#ffffff');
      doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', sl, sl, tw + 2 * bl, th + 2 * bl, undefined, 'FAST');
      // 2. words, flourishes, borders: vectors on top
      const ink = await pageSvg(inv, pages[i], { lang, print, layer: 'ink', bleed: bu });
      const el = new DOMParser().parseFromString(ink.svg, 'image/svg+xml').documentElement;
      solidStrokes(el);
      const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;overflow:hidden';
      host.appendChild(document.importNode(el, true)); document.body.appendChild(host);
      try { await doc.svg(host.firstChild, { x: sl, y: sl, width: tw + 2 * bl, height: th + 2 * bl }); } finally { host.remove(); }
      if (print) cropMarks(doc, sl, bl, tw, th);
      o.progress && o.progress(i + 1);
    }
    return { blob: doc.output('blob'), name: fileName(inv, '', lang, 'pdf').replace('-card.pdf', print ? '-print.pdf' : '-invitation.pdf'), pages: pages.length };
  }
  /** PDF readers do not paint gradient outlines (thin borders, hairlines): give those the gradient's middle colour. */
  function solidStrokes(svg) {
    svg.querySelectorAll('[stroke^="url("]').forEach((el) => {
      const g = svg.querySelector('#' + CSS.escape(/url\(#([^)]+)\)/.exec(el.getAttribute('stroke'))[1]));
      const stops = g ? [...g.querySelectorAll('stop')] : [];
      el.setAttribute('stroke', stops.length ? stops[Math.floor(stops.length / 2)].getAttribute('stop-color') : '#8a6a2a');
    });
  }
  function cropMarks(doc, sl, bl, tw, th) {
    const x0 = sl + bl, y0 = sl + bl, x1 = x0 + tw, y1 = y0 + th, gap = bl, len = sl - 1.5;
    doc.setDrawColor(0); doc.setLineWidth(0.1);
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(([x, y]) => {
      const sx = x === x0 ? -1 : 1, sy = y === y0 ? -1 : 1;
      doc.line(x + sx * gap, y, x + sx * (gap + len), y); // horizontal mark
      doc.line(x, y + sy * gap, x, y + sy * (gap + len)); // vertical mark
    });
  }

  /* ---------- a ZIP without compression (PNGs are compressed already) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, size, 4], [22, size, 4], [26, name.length, 2], [28, 0, 2]].forEach(([o, v, n]) => (n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true)));
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, size, 4], [24, size, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, n]) => (n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true)));
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + size;
    });
    const cs = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cs, 4], [16, off, 4], [20, 0, 2]].forEach(([o, v, n]) => (n === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true)));
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }

  IXC.exporter = { image, zip, pdf, outline, pageSvg, fileName, BLEED_MM, DPI };
})();
