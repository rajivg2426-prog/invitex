/* InviteX Calligraphy Studio – inks, papers, borders and the flourish library (window.IXC.lib).
 *
 * Every ornament is drawn here in SVG for InviteX (no third-party artwork), so it
 * stays sharp at print size and needs no image licences. Broad-nib strokes are
 * imitated the way a real pen makes them: the same line is drawn many times along
 * the angle of the nib, which gives thick downstrokes and thin hairlines. */
(function () {
  'use strict';
  const IXC = (window.IXC = window.IXC || {});

  /* ---------------- inks ----------------
   * metal: shown with a soft sheen on screen; flat warm colour in print.
   * We call this "gold-coloured ink", never foil. */
  const INKS = [
    { id: 'antique-gold', name: 'Antique gold', color: '#9c7a3c', metal: ['#7d5e28', '#c9a55a', '#efd99a', '#b08a44', '#86672d'] },
    { id: 'champagne-gold', name: 'Champagne gold', color: '#bfa26a', metal: ['#9d8250', '#d9c08a', '#f4e6c0', '#c8ab72', '#a68a55'] },
    { id: 'bronze', name: 'Burnished bronze', color: '#8a5a2e', metal: ['#6b4220', '#a8733f', '#d4a26a', '#91602f', '#6e4522'] },
    { id: 'copper', name: 'Copper', color: '#a85a35', metal: ['#7f3f22', '#c46d43', '#e9a57d', '#b0603a', '#844426'] },
    { id: 'burgundy', name: 'Burgundy', color: '#7a1f2e' },
    { id: 'vermilion', name: 'Vermilion red', color: '#b0381f', duo: ['#c8442a', '#9a2f17', '#6e2412'] },
    { id: 'dark-brown', name: 'Dark brown', color: '#3f2617' },
    { id: 'black', name: 'Black', color: '#1a1714' },
    { id: 'deep-green', name: 'Deep green', color: '#1f4a36' },
    { id: 'ivory', name: 'Ivory white', color: '#f5ecd9' },
  ];
  const INK = Object.fromEntries(INKS.map((i) => [i.id, i]));
  /** Plain colour of an ink id or a custom #hex. */
  const inkColor = (v) => (INK[v] ? INK[v].color : /^#[0-9a-f]{3,8}$/i.test(v || '') ? v : '#3f2617');

  /* ---------------- papers ---------------- */
  const PAPERS = [
    { id: 'handmade-ivory', name: 'Handmade ivory', color: '#f5efe2', texture: 'cotton', grain: 0.45, deckle: true, dark: false },
    { id: 'antique-parchment', name: 'Antique parchment', color: '#eddcb6', texture: 'mottled', grain: 0.6, deckle: false, edgeTone: true },
    { id: 'cotton-rag', name: 'Cotton rag', color: '#f7f4ec', texture: 'cotton', grain: 0.4, deckle: true },
    { id: 'warm-cream', name: 'Warm cream', color: '#f4e7cc', texture: 'fine', grain: 0.35 },
    { id: 'vintage-white', name: 'Vintage white', color: '#faf8f2', texture: 'laid', grain: 0.2 },
    { id: 'champagne', name: 'Champagne textured', color: '#efe5cf', texture: 'linen', grain: 0.3 },
    { id: 'deep-burgundy', name: 'Deep burgundy', color: '#4a1420', texture: 'fine', grain: 0.4, dark: true },
    { id: 'dark-luxury', name: 'Dark luxury', color: '#1e1b1a', texture: 'linen', grain: 0.25, dark: true },
  ];
  const PAPER = Object.fromEntries(PAPERS.map((p) => [p.id, p]));
  const TEXTURES = [['none', 'Smooth'], ['fine', 'Fine grain'], ['cotton', 'Cotton fibres'], ['laid', 'Laid lines'], ['linen', 'Linen weave'], ['mottled', 'Parchment mottling']];
  const PATTERNS = [['none', 'None'], ['damask', 'Damask'], ['paisley', 'Paisley'], ['dots', 'Tiny dots'], ['wash', 'Watercolour wash']];
  const BORDERS = [['none', 'None'], ['fine', 'Fine line'], ['double', 'Double line'], ['rule', 'Gold rule with dots'], ['deckle-inset', 'Inset frame']];
  const CORNERS = [['none', 'None'], ['corner-scroll', 'Scroll corners'], ['corner-filigree', 'Vintage filigree'], ['corner-leaf', 'Leaf corners']];

  const lum = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0.5;
    const n = parseInt(m[1], 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  /* ---------------- drawing helpers ---------------- */
  const r1 = (n) => Math.round(n * 10) / 10;
  /** Broad-nib stroke: `d` drawn repeatedly along the nib angle. w = nib width. */
  function nib(d, w = 7, angle = 40, thin = 1.5) {
    const a = (angle * Math.PI) / 180, n = Math.max(3, Math.round(w / 0.55));
    let s = '';
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      s += `<path d="${d}" transform="translate(${r1(Math.cos(a) * w * t)} ${r1(-Math.sin(a) * w * t)})"/>`;
    }
    return `<g fill="none" stroke="currentColor" stroke-width="${thin}" stroke-linecap="round" stroke-linejoin="round">${s}</g>`;
  }
  const hair = (d, w = 1.4) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const leaf = (x, y, len, deg, wide = 0.38) =>
    `<path transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(deg)})" d="M0 0 C${r1(len * 0.3)} ${r1(-len * wide)} ${r1(len * 0.75)} ${r1(-len * wide * 0.8)} ${len} 0 C${r1(len * 0.75)} ${r1(len * wide * 0.8)} ${r1(len * 0.3)} ${r1(len * wide)} 0 0Z" fill="currentColor"/>`;
  const dot = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor"/>`;
  const diamond = (x, y, r) => `<path d="M${x} ${y - r}L${x + r * 0.7} ${y}L${x} ${y + r}L${x - r * 0.7} ${y}Z" fill="currentColor"/>`;
  const mirrorX = (w, inner) => `<g transform="translate(${w} 0) scale(-1 1)">${inner}</g>`;
  const mirrorY = (h, inner) => `<g transform="translate(0 ${h}) scale(1 -1)">${inner}</g>`;
  /** A sprig: leaves along a curved stem from (x0,y0) towards (x1,y1). */
  function sprig(x0, y0, x1, y1, n = 5, size = 22, bend = 0.25) {
    const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend;
    let s = hair(`M${x0} ${y0} Q${r1(mx)} ${r1(my)} ${x1} ${y1}`, 1.6);
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 0.6), u = 1 - t;
      const x = u * u * x0 + 2 * u * t * mx + t * t * x1, y = u * u * y0 + 2 * u * t * my + t * t * y1;
      const dx = 2 * u * (mx - x0) + 2 * t * (x1 - mx), dy = 2 * u * (my - y0) + 2 * t * (y1 - my);
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI, side = i % 2 ? -1 : 1, sz = size * (1 - t * 0.35);
      s += leaf(x, y, sz, ang + side * 48, 0.36);
    }
    return s + leaf(x1, y1, size * 0.62, (Math.atan2(y1 - my, x1 - mx) * 180) / Math.PI, 0.36);
  }

  /* ---------------- the flourish library ----------------
   * w/h = drawing box. kind: where it suits (divider, swash, corner, motif, mark). */
  const O = {};
  const def = (id, name, kind, w, h, draw) => (O[id] = { id, name, kind, w, h, draw });

  def('swash-classic', 'Classic swash', 'divider', 400, 70, () => {
    const half = nib('M200 35 C214 24 236 21 258 29 C288 41 322 45 348 31 C366 21 372 9 362 7 C351 5 349 21 364 28 C377 34 390 31 396 25', 5, 40, 1.1);
    return half + mirrorX(400, half) + diamond(200, 35, 7);
  });
  def('swash-underline', 'Underline swash', 'swash', 420, 80, () =>
    nib('M22 52 C34 22 76 18 70 44 C64 66 28 62 42 40 C62 10 150 58 250 53 C320 49 372 34 404 16', 6, 38, 1.1) + dot(408, 14, 2.2));
  def('swash-tail', 'Swash with tail', 'swash', 380, 70, () =>
    nib('M10 40 C70 62 150 64 230 44 C290 29 330 14 350 20 C368 26 360 46 342 44 C322 42 330 18 372 12', 6, 35, 1.1));
  def('scroll-divider', 'Scroll divider', 'divider', 360, 50, () => {
    const half = hair('M188 25 C206 10 226 10 236 25 C246 40 266 40 276 25 C284 13 302 12 309 22 C315 31 305 38 299 31', 1.5) + leaf(240, 25, 16, -30) + dot(330, 25, 2.2);
    return half + mirrorX(360, half) + diamond(180, 25, 8);
  });
  def('gold-rule', 'Gold rule', 'divider', 420, 24, () =>
    hair('M30 12 H186', 1.3) + hair('M234 12 H390', 1.3) + diamond(210, 12, 8) + dot(198, 12, 2.4) + dot(222, 12, 2.4) + dot(24, 12, 2) + dot(396, 12, 2));
  def('dots-divider', 'Small separator', 'divider', 160, 24, () => diamond(50, 12, 5) + diamond(80, 12, 8) + diamond(110, 12, 5));
  def('leaf-sprig', 'Gold leaf sprig', 'motif', 120, 120, () => sprig(12, 110, 104, 14, 5, 24, 0.18));
  def('leaf-pair', 'Leaf pair', 'divider', 300, 80, () => {
    const half = sprig(146, 52, 20, 30, 6, 20, -0.12);
    return half + mirrorX(300, half) + dot(150, 52, 3.2);
  });
  def('laurel', 'Laurel wreath', 'motif', 260, 200, () => {
    const half = sprig(122, 188, 30, 40, 8, 26, -0.32);
    return half + mirrorX(260, half) + hair('M116 188 C124 180 136 180 144 188', 1.6);
  });
  def('vintage-rose', 'Vintage rose', 'motif', 170, 120, () =>
    hair('M85 60 m-6 0 a6 6 0 1 1 12 0 a10 10 0 1 1 -20 2 a15 15 0 1 1 28 -2 a19 19 0 1 1 -36 4', 2.2) +
    leaf(70, 72, 34, 165, 0.3) + leaf(100, 72, 34, 15, 0.3) + leaf(76, 86, 24, 130, 0.3) + leaf(94, 86, 24, 50, 0.3) + hair('M85 84 C85 96 80 106 72 114', 1.6));
  def('fleuron', 'Fleuron', 'mark', 100, 80, () =>
    `<path d="M50 66 C24 62 12 40 26 26 C36 16 48 22 50 32 C52 22 64 16 74 26 C88 40 76 62 50 66Z" fill="currentColor"/>` + hair('M50 66 C50 72 44 76 38 74 C32 72 34 64 40 66', 1.6) + hair('M50 32 C52 18 60 10 70 8', 1.4));
  def('heart-flourish', 'Heart flourish', 'mark', 140, 110, () =>
    nib('M70 96 C40 70 18 52 22 32 C26 12 54 10 64 30 C66 34 68 38 70 42 C72 38 74 34 76 30 C86 10 114 12 118 32 C122 52 100 70 70 96', 4.5, 40, 1) +
    hair('M70 96 C60 104 40 106 20 98', 1.3) + hair('M70 96 C80 104 100 106 120 98', 1.3));
  def('paraph', 'Signature mark', 'mark', 280, 80, () =>
    nib('M12 52 C60 12 92 70 122 42 C142 22 112 12 108 36 C104 62 176 70 266 28', 4, 35, 1));
  def('arch-top', 'Arch above names', 'swash', 480, 90, () => {
    const half = nib('M240 22 C200 20 150 24 110 42 C80 56 60 72 44 74 C30 76 26 62 36 58 C46 54 52 66 44 74', 5, 40, 1.05);
    return half + mirrorX(480, half) + diamond(240, 22, 6) + dot(224, 22, 2) + dot(256, 22, 2);
  });
  def('arch-bottom', 'Arch below names', 'swash', 480, 90, () => mirrorY(90, O['arch-top'].draw()));
  def('curl', 'Hairline curl', 'mark', 150, 90, () => hair('M140 80 C80 82 24 62 30 32 C36 6 92 8 86 38 C82 58 46 56 48 38 C50 26 64 26 66 34', 1.5));
  def('paisley', 'Paisley', 'motif', 90, 130, () =>
    hair('M45 122 C10 110 6 66 30 40 C46 22 52 8 44 4 C70 10 86 46 82 76 C78 104 64 120 45 122Z', 2) +
    hair('M44 104 C26 98 24 72 38 56 C48 46 52 36 50 30 C64 40 68 62 64 80 C60 96 54 104 44 104Z', 1.3) +
    dot(46, 78, 5) + dot(40, 18, 2) + dot(60, 46, 2) + dot(28, 96, 2) + dot(66, 100, 2));
  def('corner-scroll', 'Scroll corner', 'corner', 200, 200, () =>
    hair('M14 196 L14 70 C14 34 34 14 70 14 L196 14', 1.4) +
    nib('M34 150 C34 80 70 40 140 34', 4, 40, 1) +
    hair('M70 66 C48 68 44 46 58 42 C72 38 76 56 64 60', 1.6) + dot(196, 14, 2.4) + dot(14, 196, 2.4) + leaf(92, 56, 22, -40) + leaf(56, 92, 22, -50));
  def('corner-filigree', 'Vintage filigree corner', 'corner', 200, 200, () =>
    hair('M10 190 C10 90 30 40 60 24 C90 8 140 10 190 10', 1.4) +
    hair('M24 130 C24 70 52 30 110 26 C140 24 150 40 138 50 C126 60 112 46 124 38', 1.4) +
    hair('M30 160 C34 120 44 96 60 84 C72 76 84 86 76 96 C68 104 58 94 66 88', 1.3) +
    hair('M130 24 C150 30 170 26 184 18', 1.2) + diamond(42, 42, 6) + dot(190, 10, 2.2) + dot(10, 190, 2.2));
  def('corner-leaf', 'Leaf corner', 'corner', 200, 200, () =>
    sprig(16, 16, 180, 30, 6, 22, 0.08) + sprig(16, 16, 30, 180, 6, 22, -0.08) + dot(16, 16, 4));

  const ORNAMENTS = Object.values(O);
  /** SVG markup for an ornament drawn in its own box, centred on (0,0). */
  function ornament(id) {
    const o = O[id]; if (!o) return '';
    return `<g transform="translate(${-o.w / 2} ${-o.h / 2})">${o.draw()}</g>`;
  }

  /* ---------------- paper defs ---------------- */
  // Each texture is an SVG noise filter; strength is capped so words stay easy to read.
  function paperDefs(uid, paper, W, H, inkHex) {
    const g = Math.max(0, Math.min(1, paper.grain == null ? 0.4 : paper.grain)) * 0.6;
    const dark = lum(paper.color) < 0.18;
    const tone = dark ? '1 1 1' : '0.35 0.28 0.18';
    const T = {
      fine: `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>`,
      cotton: `<feTurbulence type="fractalNoise" baseFrequency="0.16 0.2" numOctaves="3" seed="7"/>`,
      laid: `<feTurbulence type="fractalNoise" baseFrequency="0.002 0.35" numOctaves="2" seed="5"/>`,
      linen: `<feTurbulence type="fractalNoise" baseFrequency="0.5 0.02" numOctaves="2" seed="9"/>`,
      mottled: `<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed="11"/>`,
    }[paper.texture];
    let s = '';
    // alpha follows the noise (red channel), scaled by the grain setting, so the texture stays faint
    const a = (k, b) => `${r1(k * g * 100) / 100} 0 0 0 ${r1(b * g * 100) / 100}`;
    const [tr, tg, tb] = tone.split(' ');
    if (T) s += `<filter id="${uid}-tex" x="0" y="0" width="100%" height="100%">${T}<feColorMatrix type="matrix" values="0 0 0 0 ${tr}  0 0 0 0 ${tg}  0 0 0 0 ${tb}  ${paper.texture === 'mottled' ? a(1.0, -0.45) : dark ? a(0.9, -0.42) : a(1.4, -0.56)}"/></filter>`;
    s += `<filter id="${uid}-fib" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.015 0.22" numOctaves="2" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 ${dark ? 1 : 0.42}  0 0 0 0 ${dark ? 1 : 0.34}  0 0 0 0 ${dark ? 1 : 0.24}  ${a(1.1, -0.18)}"/></filter>`;
    if (paper.deckle) s += `<filter id="${uid}-deckle" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    s += `<radialGradient id="${uid}-vig" cx="50%" cy="48%" r="75%"><stop offset="60%" stop-color="${dark ? '#000' : '#7a5a2a'}" stop-opacity="0"/><stop offset="100%" stop-color="${dark ? '#000' : '#7a5a2a'}" stop-opacity="${paper.edgeTone ? 0.28 : dark ? 0.35 : 0.08}"/></radialGradient>`;
    if (paper.pattern === 'wash') {
      const c = inkHex || '#9c7a3c';
      s += `<filter id="${uid}-wash"><feGaussianBlur stdDeviation="40"/></filter><radialGradient id="${uid}-w1"><stop offset="0" stop-color="${c}" stop-opacity=".14"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
    }
    if (paper.pattern === 'damask' || paper.pattern === 'paisley' || paper.pattern === 'dots') {
      const pc = dark ? '#ffffff' : '#6b4a20', op = dark ? 0.05 : 0.06;
      const cell = paper.pattern === 'dots' ? 36 : 120;
      const art = paper.pattern === 'dots' ? dot(18, 18, 1.6)
        : paper.pattern === 'paisley' ? `<g transform="translate(30 0) scale(.6)">${O.paisley.draw()}</g><g transform="translate(90 60) scale(.6)">${O.paisley.draw()}</g>`
          : `<g transform="translate(10 20) scale(1)">${O.fleuron.draw()}</g><g transform="translate(70 80) scale(.5)">${O.fleuron.draw()}</g>`;
      s += `<pattern id="${uid}-pat" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse"><g color="${pc}" opacity="${op}">${art}</g></pattern>`;
    }
    return s;
  }

  IXC.lib = { INKS, INK, inkColor, PAPERS, PAPER, TEXTURES, PATTERNS, BORDERS, CORNERS, ORNAMENTS, O, ornament, paperDefs, lum, contrast, nib, hair, leaf, dot, diamond, sprig };
})();
