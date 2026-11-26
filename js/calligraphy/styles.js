/* InviteX Calligraphy Studio – the 10 starting styles and the design data (window.IXC.styles).
 *
 * A calligraphy design is saved on the invitation as `inv.calligraphy`:
 *   { v, style, size, paper{…}, inks{…}, sheen, nameLayout, initials, orn{…}, el{ id: overrides }, added[], removed[] }
 * The words themselves stay in inv.text[lang] (new keys listed in TEXT_KEYS) and inv.events,
 * so WhatsApp messages, the RSVP page and the writing studio keep reading the same text. */
(function () {
  'use strict';
  const IXC = (window.IXC = window.IXC || {});

  /* Words used by the studio. "bind" keys live in inv.text[lang]; date, time and venue come from the first event. */
  const TEXT_KEYS = ['heading', 'bride', 'groom', 'underNames', 'brideParents', 'groomParents', 'message', 'reception', 'rsvpNote', 'blessing', 'coverLine', 'eventsTitle', 'rsvpTitle'];
  const FIELDS = [
    { key: 'heading', label: 'Invitation heading', hint: 'The line above the names', multi: true },
    { key: 'bride', label: "Bride's name", hint: 'Written exactly as you type it' },
    { key: 'groom', label: "Groom's name", hint: 'Written exactly as you type it' },
    { key: 'underNames', label: 'Line under the names', hint: 'Optional. Copy Studio can write it for you', multi: true },
    { key: 'brideParents', label: "Bride's parents", hint: 'For example: Daughter of Mrs Lata & Mr Vijay Rangam' },
    { key: 'groomParents', label: "Groom's parents", hint: 'For example: Son of Mrs Neha & Mr Arun Kumar' },
    { key: 'date', label: 'Wedding date', type: 'date', event: 'date' },
    { key: 'start', label: 'Wedding time', type: 'time', event: 'start' },
    { key: 'venue', label: 'Venue', event: 'venue' },
    { key: 'address', label: 'Venue address', event: 'address', multi: true },
    { key: 'city', label: 'Town or city', event: 'city' },
    { key: 'reception', label: 'Reception details', hint: 'For example: Reception 6:30 pm, Saturday 31st August', multi: true },
    { key: 'message', label: 'Personal invitation message', multi: true },
    { key: 'rsvpNote', label: 'RSVP details', hint: 'For example: Kindly reply by 1st August · Anita 98765 43210', multi: true },
    { key: 'blessing', label: 'Closing blessings', multi: true },
  ];
  // Words for the other pages of the set (cover, events, RSVP). Pages each have their own lines.
  const PAGE_FIELDS = [
    { key: 'coverLine', label: 'Line on the cover', hint: 'Shown above the names on the cover', multi: true },
    { key: 'eventsTitle', label: 'Title of the events page' },
    { key: 'rsvpTitle', label: 'Title of the RSVP page' },
  ];
  // Starting words for those lines; used until the host types their own (an empty line hides it).
  const PAGE_DEFAULTS = {
    en: { coverLine: 'Together with their families', eventsTitle: 'Order of Celebrations', rsvpTitle: 'Kindly Reply' },
    hi: { coverLine: 'शुभ विवाह', eventsTitle: 'मांगलिक कार्यक्रम', rsvpTitle: 'कृपया उत्तर दें' },
    pa: { coverLine: 'ਸ਼ੁਭ ਵਿਆਹ', eventsTitle: 'ਸਮਾਗਮਾਂ ਦਾ ਵੇਰਵਾ', rsvpTitle: 'ਕਿਰਪਾ ਕਰਕੇ ਜਵਾਬ ਦਿਓ' },
  };
  /* The four matching pages. The main card is always included; the others can be switched off. */
  const PAGES = [['cover', 'Cover'], ['main', 'Main card'], ['events', 'Events'], ['rsvp', 'RSVP']];
  const pagesOn = (cal) => PAGES.map(([id]) => id).filter((id) => id === 'main' || !cal.pages || cal.pages[id] !== false);
  // Starting words, written into empty lines when a style is first chosen.
  const DEFAULTS = {
    en: { heading: 'We joyfully request the honour of your presence\nas we are wed', blessing: 'With the blessings of our families', rsvpNote: 'Kindly reply at your earliest convenience' },
    hi: { heading: 'आपकी गरिमामयी उपस्थिति के आकांक्षी\nहमारे विवाह समारोह में', blessing: 'परिवारजनों के आशीर्वाद सहित', rsvpNote: 'कृपया अपनी उपस्थिति की सूचना दें' },
    pa: { heading: 'ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਦੀ ਬੇਨਤੀ ਹੈ\nਸਾਡੇ ਵਿਆਹ ਸਮਾਗਮ ਵਿੱਚ', blessing: 'ਪਰਿਵਾਰਾਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਸਹਿਤ', rsvpNote: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਹਾਜ਼ਰੀ ਦੀ ਸੂਚਨਾ ਦਿਓ' },
  };
  // Shown faintly in the editor until the host types their own (never exported).
  const SAMPLES = { bride: 'Raghavi', groom: 'Joshi', brideParents: '', groomParents: '', venue: 'The Venue', date: '' };

  /* Card sizes, in drawing units (1000 wide). */
  const SIZES = { '5x7': { name: '5 × 7 in', w: 1000, h: 1400, mm: [127, 178] }, a5: { name: 'A5', w: 1000, h: 1414, mm: [148, 210] } };

  /* Text roles: sizes are "visual" sizes (each font's own k makes them look alike). */
  const T = (font, size, extra = {}) => ({ font, size, w: 0, tracking: 0, leading: 1.25, ...extra });
  const IND = (hiD, hiT, paD, paT) => ({ deva: { display: hiD, text: hiT }, guru: { display: paD, text: paT } });
  const ORN = (o) => ({ top: '', under: '', divider: '', mark: '', initialFlourish: false, sprig: false, ...o });

  const STYLES = [
    {
      id: 'royal-english', name: 'Royal English Calligraphy', blurb: 'Broad-nib italic, red-brown decorated capitals, torn cotton paper',
      paper: { id: 'handmade-ivory' }, sheen: true,
      inks: { heading: 'antique-gold', initials: 'vermilion', bride: 'dark-brown', groom: 'dark-brown', amp: 'antique-gold', main: 'antique-gold', details: 'antique-gold', flourish: 'vermilion', sprig: 'antique-gold' },
      type: { heading: T('Tangerine', 60, { w: 700, leading: 1.05 }), names: T('Tangerine', 140, { w: 700 }), initial: T('UnifrakturCook', 1.9, { w: 700 }), amp: T('Tangerine', 44, { w: 700 }), main: T('Tangerine', 48, { w: 700, leading: 1.05 }), details: T('Tangerine', 50, { w: 700, leading: 1.02 }), small: T('Tangerine', 44, { w: 700 }) },
      indic: IND('Amita', 'Amita', 'Tiro Gurmukhi', 'Tiro Gurmukhi'),
      nameLayout: 'staggered', initials: 'flourished', orn: ORN({ divider: '', mark: '', initialFlourish: true, sprig: true }),
      border: 'none', corners: 'none',
    },
    {
      id: 'vintage-script', name: 'Vintage Wedding Script', blurb: 'Rouge Script names, roundhand details, bronze on parchment',
      paper: { id: 'antique-parchment' }, sheen: true,
      inks: { heading: 'bronze', initials: 'bronze', bride: 'bronze', groom: 'bronze', amp: 'dark-brown', main: 'dark-brown', details: 'dark-brown', flourish: 'bronze', sprig: 'bronze' },
      type: { heading: T('Petit Formal Script', 40), names: T('Rouge Script', 108), initial: T('Rouge Script', 1.25), amp: T('Petit Formal Script', 42), main: T('Petit Formal Script', 32, { leading: 1.45 }), details: T('Cormorant Garamond', 40, { w: 500 }), small: T('Cormorant Garamond', 30, { italic: true }) },
      indic: IND('Amita', 'Tiro Devanagari Hindi', 'Tiro Gurmukhi', 'Tiro Gurmukhi'),
      nameLayout: 'stacked', initials: 'plain', orn: ORN({ top: 'scroll-divider', under: 'swash-classic', divider: 'dots-divider', mark: 'fleuron' }),
      border: 'double', corners: 'corner-filigree',
    },
    {
      id: 'romantic-hand', name: 'Romantic Handwritten', blurb: 'Soft flowing hand, burgundy ink on warm cream',
      paper: { id: 'warm-cream' }, sheen: false,
      inks: { heading: 'burgundy', initials: 'burgundy', bride: 'burgundy', groom: 'burgundy', amp: 'burgundy', main: 'dark-brown', details: 'dark-brown', flourish: 'burgundy', sprig: 'burgundy' },
      type: { heading: T('Dancing Script', 40), names: T('Corinthia', 120, { w: 700 }), initial: T('Corinthia', 1.3, { w: 700 }), amp: T('Dancing Script', 44), main: T('Dancing Script', 32, { leading: 1.4 }), details: T('Dancing Script', 36, { w: 700 }), small: T('Dancing Script', 28) },
      indic: IND('Kalam', 'Kalam', 'Baloo Paaji 2', 'Baloo Paaji 2'),
      nameLayout: 'stacked', initials: 'none', orn: ORN({ top: 'heart-flourish', under: 'swash-underline', divider: 'leaf-pair', mark: 'paraph' }),
      border: 'none', corners: 'none',
    },
    {
      id: 'golden-ink', name: 'Golden Ink Calligraphy', blurb: 'Great Vibes in shining gold ink on champagne paper',
      paper: { id: 'champagne' }, sheen: true,
      inks: { heading: 'bronze', initials: 'antique-gold', bride: 'antique-gold', groom: 'antique-gold', amp: 'antique-gold', main: 'dark-brown', details: 'dark-brown', flourish: 'antique-gold', sprig: 'antique-gold' },
      type: { heading: T('Cormorant SC', 34, { w: 500, tracking: 3 }), names: T('Great Vibes', 116), initial: T('Great Vibes', 1.3), amp: T('Great Vibes', 54), main: T('Cormorant Garamond', 36, { italic: true, leading: 1.4 }), details: T('Cormorant Garamond', 38, { w: 500 }), small: T('Cormorant Garamond', 30, { italic: true }) },
      indic: IND('Amita', 'Tiro Devanagari Hindi', 'Tiro Gurmukhi', 'Noto Serif Gurmukhi'),
      nameLayout: 'stacked', initials: 'plain', orn: ORN({ top: 'arch-top', under: 'arch-bottom', divider: 'gold-rule', mark: '' }),
      border: 'rule', corners: 'none',
    },
    {
      id: 'modern-signature', name: 'Modern Signature Style', blurb: 'Fast signature lettering with spaced capitals, black on white',
      paper: { id: 'vintage-white' }, sheen: false,
      inks: { heading: 'black', initials: 'black', bride: 'black', groom: 'black', amp: 'black', main: 'black', details: 'black', flourish: 'black', sprig: 'black' },
      type: { heading: T('Cormorant SC', 30, { w: 500, tracking: 6 }), names: T('Herr Von Muellerhoff', 130), initial: T('Herr Von Muellerhoff', 1.2), amp: T('Cormorant SC', 34, { tracking: 4 }), main: T('Cormorant Garamond', 34, { leading: 1.45 }), details: T('Cormorant SC', 32, { w: 500, tracking: 4 }), small: T('Cormorant Garamond', 28, { italic: true }) },
      indic: IND('Kalam', 'Tiro Devanagari Hindi', 'Baloo Paaji 2', 'Noto Serif Gurmukhi'),
      nameLayout: 'inline', initials: 'none', orn: ORN({ under: 'paraph', divider: '', mark: '' }),
      border: 'none', corners: 'none',
    },
    {
      id: 'indian-traditional', name: 'Traditional Indian Wedding Calligraphy', blurb: 'Imperial Script names, gold and burgundy, paisley border',
      paper: { id: 'handmade-ivory', pattern: 'paisley' }, sheen: true,
      inks: { heading: 'burgundy', initials: 'antique-gold', bride: 'burgundy', groom: 'burgundy', amp: 'antique-gold', main: 'dark-brown', details: 'burgundy', flourish: 'antique-gold', sprig: 'antique-gold' },
      type: { heading: T('Cormorant Garamond', 36, { italic: true, leading: 1.3 }), names: T('Imperial Script', 116), initial: T('Imperial Script', 1.35), amp: T('Imperial Script', 54), main: T('Cormorant Garamond', 34, { leading: 1.4 }), details: T('Cormorant Garamond', 38, { w: 600 }), small: T('Cormorant Garamond', 30, { italic: true }) },
      indic: IND('Amita', 'Tiro Devanagari Hindi', 'Tiro Gurmukhi', 'Tiro Gurmukhi'),
      nameLayout: 'stacked', initials: 'plain', orn: ORN({ top: 'paisley', under: 'scroll-divider', divider: 'leaf-pair', mark: 'dots-divider' }),
      border: 'double', corners: 'corner-scroll',
    },
    {
      id: 'minimal-script', name: 'Minimalist Elegant Script', blurb: 'One fine script, lots of space, brown ink on cotton',
      paper: { id: 'cotton-rag', deckle: false }, sheen: false,
      inks: { heading: 'dark-brown', initials: 'dark-brown', bride: 'dark-brown', groom: 'dark-brown', amp: 'dark-brown', main: 'dark-brown', details: 'dark-brown', flourish: 'dark-brown', sprig: 'dark-brown' },
      type: { heading: T('Cormorant Garamond', 30, { italic: true }), names: T('WindSong', 100, { w: 500 }), initial: T('WindSong', 1.2, { w: 500 }), amp: T('Cormorant Garamond', 34, { italic: true }), main: T('Cormorant Garamond', 32, { leading: 1.5 }), details: T('Cormorant Garamond', 32, { w: 500 }), small: T('Cormorant Garamond', 26, { italic: true }) },
      indic: IND('Kalam', 'Tiro Devanagari Hindi', 'Noto Serif Gurmukhi', 'Noto Serif Gurmukhi'),
      nameLayout: 'stacked', initials: 'none', orn: ORN({ under: 'gold-rule', mark: '' }),
      border: 'none', corners: 'none',
    },
    {
      id: 'luxury-black', name: 'Luxury Black Ink', blurb: 'Champagne-gold Spencerian script on dark luxury paper',
      paper: { id: 'dark-luxury' }, sheen: true,
      inks: { heading: 'champagne-gold', initials: 'champagne-gold', bride: 'champagne-gold', groom: 'champagne-gold', amp: 'champagne-gold', main: 'ivory', details: 'ivory', flourish: 'champagne-gold', sprig: 'champagne-gold' },
      type: { heading: T('Cormorant SC', 30, { w: 500, tracking: 5 }), names: T('Monsieur La Doulaise', 120), initial: T('Monsieur La Doulaise', 1.2), amp: T('Monsieur La Doulaise', 56), main: T('Cormorant Garamond', 34, { leading: 1.45 }), details: T('Cormorant SC', 32, { w: 500, tracking: 3 }), small: T('Cormorant Garamond', 28, { italic: true }) },
      indic: IND('Amita', 'Tiro Devanagari Hindi', 'Tiro Gurmukhi', 'Noto Serif Gurmukhi'),
      nameLayout: 'stacked', initials: 'plain', orn: ORN({ top: 'swash-classic', under: 'swash-classic', divider: 'gold-rule', mark: '' }),
      border: 'fine', corners: 'corner-filigree',
    },
    {
      id: 'watercolour', name: 'Watercolour Calligraphy', blurb: 'Ballet swash names with a soft green watercolour wash',
      paper: { id: 'cotton-rag', pattern: 'wash' }, sheen: false,
      inks: { heading: 'deep-green', initials: 'deep-green', bride: 'deep-green', groom: 'deep-green', amp: 'deep-green', main: 'dark-brown', details: 'dark-brown', flourish: 'deep-green', sprig: 'deep-green' },
      type: { heading: T('Sacramento', 44), names: T('Ballet', 104), initial: T('Ballet', 1.15), amp: T('Sacramento', 50), main: T('Cormorant Garamond', 34, { italic: true, leading: 1.4 }), details: T('Cormorant Garamond', 36, { w: 500 }), small: T('Cormorant Garamond', 28, { italic: true }) },
      indic: IND('Kalam', 'Kalam', 'Baloo Paaji 2', 'Baloo Paaji 2'),
      nameLayout: 'stacked', initials: 'none', orn: ORN({ top: 'leaf-pair', under: '', divider: 'leaf-sprig', mark: '' }),
      border: 'none', corners: 'corner-leaf',
    },
    {
      id: 'antique-manuscript', name: 'Antique Manuscript', blurb: 'Gothic initials, fine italic, worn parchment edges',
      paper: { id: 'antique-parchment', deckle: true }, sheen: false,
      inks: { heading: 'dark-brown', initials: 'vermilion', bride: 'dark-brown', groom: 'dark-brown', amp: 'vermilion', main: 'dark-brown', details: 'dark-brown', flourish: 'vermilion', sprig: 'dark-brown' },
      type: { heading: T('Grenze Gotisch', 34, { w: 500 }), names: T('Tangerine', 116, { w: 700 }), initial: T('UnifrakturMaguntia', 1.7), amp: T('UnifrakturMaguntia', 36), main: T('Tangerine', 50, { w: 700, leading: 1.05 }), details: T('Tangerine', 54, { w: 700, leading: 1.02 }), small: T('Tangerine', 42, { w: 700 }) },
      indic: IND('Amita', 'Tiro Devanagari Hindi', 'Tiro Gurmukhi', 'Tiro Gurmukhi'),
      nameLayout: 'stacked', initials: 'flourished', orn: ORN({ under: 'swash-tail', divider: 'dots-divider', mark: 'fleuron', initialFlourish: true }),
      border: 'deckle-inset', corners: 'none',
    },
  ];
  const STYLE = Object.fromEntries(STYLES.map((s) => [s.id, s]));
  const NAME_LAYOUTS = [['stacked', 'Stacked'], ['staggered', 'Staggered'], ['inline', 'Side by side'], ['arch', 'Arched']];
  const INITIALS = [['none', 'Plain names'], ['plain', 'Large initials'], ['flourished', 'Decorated initials']];

  /** A fresh design for a style. */
  function newDesign(styleId, size = '5x7') {
    const s = STYLE[styleId] || STYLES[0];
    const base = IXC.lib.PAPER[s.paper.id];
    return {
      v: 1, style: s.id, size,
      paper: { id: base.id, color: base.color, texture: base.texture, grain: base.grain, deckle: !!base.deckle, pattern: 'none', border: s.border, borderInk: s.inks.flourish, corners: s.corners, ...s.paper },
      inks: { ...s.inks }, sheen: s.sheen, nameLayout: s.nameLayout, initials: s.initials, orn: { ...s.orn },
      el: {}, added: [], removed: [],
    };
  }
  /** Change style, keeping words. */
  const applyStyle = (cal, styleId) => Object.assign(cal, newDesign(styleId, cal.size), { size: cal.size });
  /** Put ornaments and positions back as the style made them (words, fonts and colours stay). */
  function restoreLayout(cal) {
    const s = STYLE[cal.style] || STYLES[0];
    Object.values(cal.el).forEach((o) => { ['dx', 'dy', 'rot', 'scale'].forEach((k) => delete o[k]); delete o.hidden; });
    cal.added = []; cal.removed = []; cal.orn = { ...s.orn };
    cal.paper.corners = s.corners;
  }
  /** Fill empty starting lines (heading, blessing…) and names from the title, without touching anything typed. */
  function fillWords(inv, lang) {
    inv.text[lang] = inv.text[lang] || {};
    const t = inv.text[lang], d = DEFAULTS[lang] || DEFAULTS.en;
    Object.entries(d).forEach(([k, v]) => { if (!t[k]) t[k] = v; });
    if (!t.bride && !t.groom && t.title && /\s(&|and|weds|संग|ਸੰਗ)\s/i.test(t.title)) {
      const [a, b] = t.title.split(/\s(?:&|and|weds|संग|ਸੰਗ)\s/i);
      t.bride = a.trim(); t.groom = (b || '').trim();
    }
  }
  /** Keep the app-wide title ("Raghavi & Joshi") in step with the names, unless the host wrote their own title. */
  function syncTitle(inv, lang) {
    const t = inv.text[lang] || {};
    if (!t.bride && !t.groom) return;
    const auto = [t.bride, t.groom].filter(Boolean).join(' & ');
    const prev = inv.calligraphy && inv.calligraphy.autoTitle;
    if (!t.title || t.title === prev || (prev && prev[lang] === t.title)) {
      t.title = auto;
      inv.calligraphy.autoTitle = { ...(typeof prev === 'object' && prev ? prev : {}), [lang]: auto };
    }
  }

  IXC.styles = { TEXT_KEYS, FIELDS, PAGE_FIELDS, PAGE_DEFAULTS, PAGES, pagesOn, DEFAULTS, SAMPLES, SIZES, STYLES, STYLE, NAME_LAYOUTS, INITIALS, newDesign, applyStyle, restoreLayout, fillWords, syncTitle };
})();
