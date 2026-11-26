/* InviteX Calligraphy Studio – font library (window.IXC.fonts).
 *
 * Every font here is self-hosted in fonts/calligraphy/ under the SIL Open Font
 * License (see fonts/calligraphy/LICENSES.md), so the studio, the guest page and
 * exports all draw with the same files.
 *
 * Hindi (Devanagari) and Punjabi (Gurmukhi) are never drawn with an English
 * calligraphy font: each text block works out which script it is written in and
 * uses a font made for that script. English-only fonts are not offered for it. */
(function () {
  'use strict';
  const IXC = (window.IXC = window.IXC || {});

  // k = size multiplier so "size 60" looks about the same in every font
  // (fine scripts such as Tangerine have tiny letters, display fonts large ones).
  const F = (name, cat, k, extra = {}) => ({ name, cat, k, script: 'latn', weights: [400], ...extra });
  const LIST = [
    // A. Traditional English calligraphy
    F('Pinyon Script', 'copperplate', 0.95),
    F('Italianno', 'copperplate', 1.35),
    F('Monsieur La Doulaise', 'spencerian', 1.15),
    F('Mrs Saint Delafield', 'spencerian', 1.25),
    F('Petit Formal Script', 'roundhand', 0.78),
    F('Alex Brush', 'roundhand', 1.05),
    F('UnifrakturCook', 'gothic', 0.95, { weights: [700], w: 700 }),
    F('UnifrakturMaguntia', 'gothic', 1.0),
    F('Grenze Gotisch', 'gothic', 0.9, { weights: [500, 700], w: 500 }),
    F('Great Vibes', 'formal', 1.05),
    F('Tangerine', 'formal', 1.5, { weights: [400, 700], w: 700 }),
    F('Parisienne', 'formal', 0.95),
    // B. Modern calligraphy
    F('Dancing Script', 'flowing', 0.95, { weights: [400, 700] }),
    F('Sacramento', 'flowing', 1.2),
    F('Water Brush', 'flowing', 1.0),
    F('Herr Von Muellerhoff', 'signature', 1.3),
    F('Ms Madi', 'signature', 1.1),
    F('WindSong', 'minimal', 0.75, { weights: [400, 500] }),
    F('Allura', 'minimal', 1.1),
    F('Corinthia', 'romantic', 1.2, { weights: [400, 700] }),
    F('Rouge Script', 'romantic', 1.1),
    F('Ballet', 'romantic', 0.85),
    F('Imperial Script', 'romantic', 1.05),
    F('Mea Culpa', 'romantic', 1.05),
    // Calm serif partners for dates and small print
    F('Cormorant Garamond', 'serif', 0.82, { weights: [400, 500, 600], italic: true }),
    F('Cormorant SC', 'serif', 0.8, { weights: [500, 600] }),
    // C. Indian languages
    F('Amita', 'hindi', 0.78, { script: 'deva', weights: [400, 700], note: 'Calligraphic' }),
    F('Kalam', 'hindi', 0.8, { script: 'deva', weights: [400, 700], note: 'Handwritten' }),
    F('Tiro Devanagari Hindi', 'hindi', 0.8, { script: 'deva', note: 'Traditional' }),
    F('Rozha One', 'hindi', 0.72, { script: 'deva', note: 'Bold display' }),
    F('Tiro Gurmukhi', 'punjabi', 0.8, { script: 'guru', note: 'Traditional' }),
    F('Baloo Paaji 2', 'punjabi', 0.74, { script: 'guru', weights: [500, 700], w: 500, note: 'Soft rounded' }),
    F('Noto Serif Gurmukhi', 'punjabi', 0.78, { script: 'guru', weights: [400, 600], note: 'Formal' }),
  ];
  // Indian-language fonts also contain English letters, but we only offer them for their own script.
  const BY = Object.fromEntries(LIST.map((f) => [f.name, f]));

  const CATEGORIES = [
    { id: 'traditional', name: 'Traditional English calligraphy', groups: [['copperplate', 'Copperplate-inspired'], ['spencerian', 'Spencerian-inspired'], ['roundhand', 'English Roundhand-inspired'], ['gothic', 'Gothic-inspired'], ['formal', 'Formal script']] },
    { id: 'modern', name: 'Modern calligraphy', groups: [['flowing', 'Flowing handwritten'], ['signature', 'Signature style'], ['minimal', 'Minimalist script'], ['romantic', 'Romantic lettering']] },
    { id: 'serif', name: 'Classic lettering for details', groups: [['serif', 'Elegant serif']] },
    { id: 'indian', name: 'Indian languages', groups: [['hindi', 'Hindi (Devanagari)'], ['punjabi', 'Punjabi (Gurmukhi)']] },
  ];

  /* ---------- scripts ---------- */
  const RX = { deva: /[ऀ-ॿ꣠-ꣿ]/g, guru: /[਀-੿]/g, latn: /[A-Za-zÀ-ɏ]/g };
  const OTHER = /[ঀ-৿઀-෿؀-ۿ฀-๿一-鿿Ѐ-ӿ]/; // Bengali…Sinhala, Arabic, Thai, CJK, Cyrillic
  /** Main script of a piece of text: 'latn', 'deva', 'guru' or 'other'. */
  function scriptOf(text) {
    const s = String(text || '');
    const n = { latn: (s.match(RX.latn) || []).length, deva: (s.match(RX.deva) || []).length, guru: (s.match(RX.guru) || []).length };
    const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    if (!best[1]) return OTHER.test(s) ? 'other' : 'latn';
    if (OTHER.test(s) && (s.match(new RegExp(OTHER.source, 'g')) || []).length > best[1]) return 'other';
    return best[0];
  }
  const hasScript = (text, sc) => new RegExp(RX[sc].source).test(String(text || ''));
  const SCRIPT_NAME = { latn: 'English', deva: 'Hindi', guru: 'Punjabi', other: 'this language' };

  /** Fonts that can draw a script, for menus. */
  const forScript = (sc) => LIST.filter((f) => (sc === 'latn' ? f.script === 'latn' : f.script === sc));
  const fallbackFor = (sc) => ({ latn: 'Cormorant Garamond', deva: 'Tiro Devanagari Hindi', guru: 'Tiro Gurmukhi' }[sc] || 'Cormorant Garamond');
  /** Choose a font for text: the element's own choice for that script if it can draw it, else the fallback. */
  function pick(choice, sc) {
    const f = BY[choice];
    if (f && (f.script === sc)) return f;
    return BY[fallbackFor(sc)];
  }
  /** CSS font-family stack: the chosen font first, then script partners so mixed lines still draw every letter. */
  const stack = (primary, hi, pa) => [primary, hi || 'Amita', pa || 'Tiro Gurmukhi', 'Noto Sans Devanagari', 'Noto Sans Gurmukhi', 'serif'].filter((v, i, a) => a.indexOf(v) === i).map((n) => (n === 'serif' ? n : `'${n}'`)).join(', ');
  const weightOf = (f, want) => { const w = want || f.w || 400; return f.weights.includes(w) ? w : f.weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)); };

  /* ---------- loading ---------- */
  let cssReady = null;
  function addCss() {
    if (cssReady) return cssReady;
    let l = document.getElementById('ixcFonts');
    if (l && l.sheet) return (cssReady = Promise.resolve());
    if (!l) {
      l = document.createElement('link');
      l.id = 'ixcFonts'; l.rel = 'stylesheet'; l.href = 'fonts/calligraphy/fonts.css';
      document.head.appendChild(l);
    }
    cssReady = new Promise((r) => { l.addEventListener('load', r, { once: true }); l.addEventListener('error', r, { once: true }); setTimeout(r, 8000); });
    return cssReady;
  }
  const loaded = new Map();
  /** Load the given fonts ([[name, weight]]) and wait for them, at most `ms`. Fonts are only downloaded when used. */
  async function ensure(list, ms = 8000) {
    await addCss();
    const todo = list.filter(([n, w]) => n && !loaded.has(n + '|' + (w || 400)))
      .map(([n, w]) => document.fonts.load(`${w || 400} 40px '${n}'`).catch(() => []).then((r) => { loaded.set(n + '|' + (w || 400), !!(r && r.length)); }));
    if (todo.length) await Promise.race([Promise.all(todo), new Promise((r) => setTimeout(r, ms))]);
  }
  const isLoaded = (n, w = 400) => document.fonts.check(`${w} 40px '${n}'`);

  IXC.fonts = { LIST, BY, CATEGORIES, scriptOf, hasScript, SCRIPT_NAME, forScript, pick, stack, weightOf, ensure, isLoaded, addCss };
})();
