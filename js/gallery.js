/* InviteX design gallery helpers (window.IXGallery).
 *  - META: what each ready design is good for, and its style in plain words
 *  - TABS: occasion tabs for the gallery
 *  - suggest(): "describe your card" – ranks ready designs + colours for a description
 *    and works out the matching AI painting style, colours and words
 *  - FONT_PAIRS / pairsFor(): ready font pairings
 * Runs fully in the browser. The only AI step is the existing painter
 * (supabase/functions/generate-card-art), which keeps its key on the server. */
(function () {
  'use strict';

  const META = {
    'royal-maroon': { style: 'Royal & floral', occ: ['wedding', 'engagement', 'reception', 'anniversary'], tags: 'royal regal palace grand rajasthani traditional floral flowers rose maroon red gold emerald green ivory indian wedding shaadi heritage luxurious ornate border' },
    'himalayan-dham': { style: 'Mountain heritage', occ: ['festival', 'family', 'religious', 'wedding'], tags: 'mountain mountains himachal pahadi hills deodar snow nature dham feast village heritage traditional green maroon' },
    'blush-rings': { style: 'Soft romantic', occ: ['engagement', 'reception', 'wedding', 'anniversary'], tags: 'romantic soft blush pink rose gold rings engagement pastel lavender modern love elegant delicate midnight' },
    'confetti-party': { style: 'Playful party', occ: ['birthday', 'school', 'family'], tags: 'fun playful party balloons confetti kids children birthday bright colourful colorful candy ocean night cute' },
    'golden-anniversary': { style: 'Classic elegance', occ: ['anniversary', 'wedding', 'reception', 'farewell'], tags: 'classic elegant gold golden ivory black tie ruby anniversary timeless minimal leaves refined formal premium' },
    'griha-pravesh': { style: 'Festive traditional', occ: ['housewarming', 'religious', 'festival'], tags: 'home house housewarming griha pravesh toran marigold mango leaves doorway traditional festive peacock saffron' },
    'saffron-puja': { style: 'Spiritual', occ: ['religious', 'festival', 'housewarming'], tags: 'puja pooja spiritual devotional mandala temple diya saffron orange kumkum red navratri diwali ganesh religious sacred lotus' },
    'corporate-slate': { style: 'Clean corporate', occ: ['corporate', 'conference', 'launch', 'farewell'], tags: 'corporate business office meeting professional clean modern minimal navy teal charcoal amber white formal geometric' },
    'conference-night': { style: 'Tech & modern', occ: ['conference', 'launch', 'corporate', 'school'], tags: 'tech technology conference summit network modern dark space electric blue futuristic startup' },
    'launch-burst': { style: 'Bold & energetic', occ: ['launch', 'corporate', 'birthday'], tags: 'launch product bold energetic bright burst electric citrus royal blue startup announcement' },
    'campus-stars': { style: 'Academic', occ: ['school', 'community', 'farewell'], tags: 'school college university campus annual day graduation convocation stars academic maroon blue' },
    'sunset-farewell': { style: 'Warm & nostalgic', occ: ['farewell', 'anniversary', 'family'], tags: 'farewell retirement sunset golden hour dusk warm nostalgic goodbye send off' },
    'community-leaf': { style: 'Fresh & natural', occ: ['community', 'family', 'festival', 'school'], tags: 'community society gathering natural green leaf eco fresh earth simple friendly' },
    'sage-garden': { style: 'Botanical watercolour', occ: ['wedding', 'engagement', 'reception', 'anniversary', 'housewarming', 'family'], tags: 'botanical greenery green sage leaves leaf olive willow watercolour watercolor garden nature ivory gold elegant minimal modern soft eucalyptus rose forest' },
    'eucalyptus-garland': { style: 'Botanical garland', occ: ['wedding', 'engagement', 'reception', 'birthday', 'anniversary', 'housewarming', 'family'], tags: 'botanical greenery green sage eucalyptus garland leaves leaf watercolour watercolor garden nature silver olive cream terracotta boho rustic soft' },
    'fern-meadow': { style: 'Botanical meadow', occ: ['wedding', 'engagement', 'anniversary', 'housewarming', 'family', 'community', 'farewell'], tags: 'botanical greenery green fern ferns meadow grass leaves leaf watercolour watercolor garden nature outdoor rustic moss linen blue fresh' },
    'champagne-arch': { style: 'Arch & roses', occ: ['wedding', 'engagement', 'reception', 'anniversary'], tags: 'arch arched doorway door roses rose cream champagne beige nude ivory gold elegant luxury luxurious romantic floral flowers sun mandala mocha blush pastel neutral' },
    'pampas-arch': { style: 'Arch & pampas', occ: ['wedding', 'engagement', 'reception', 'anniversary', 'housewarming', 'family'], tags: 'arch arched doorway pampas grass dried flowers boho bohemian rustic cream sand beige neutral terracotta sage gold sun elegant modern' },
    'minimal-ivory': { style: 'Minimal', occ: ['wedding', 'engagement', 'reception', 'birthday', 'anniversary', 'housewarming', 'religious', 'festival', 'family', 'corporate', 'conference', 'launch', 'school', 'farewell', 'community'], tags: 'minimal minimalist simple clean ivory white plain sage ink modern understated' },
  };

  const TABS = [
    ['all', 'All'], ['calligraphy', 'Calligraphy & Handwritten'], ['wedding', 'Wedding'], ['engagement', 'Engagement'], ['reception', 'Reception'], ['birthday', 'Birthday'],
    ['anniversary', 'Anniversary'], ['housewarming', 'Housewarming'], ['religious', 'Religious'], ['festival', 'Festivals'], ['family', 'Family gatherings'],
    ['corporate', 'Corporate'], ['conference', 'Conferences'], ['launch', 'Product launches'], ['school', 'School & college'], ['farewell', 'Retirement & farewell'], ['community', 'Community'],
  ];
  // The occasion tab that matches an event type.
  const TAB_FOR_CAT = { wedding: 'wedding', engagement: 'engagement', birthday: 'birthday', anniversary: 'anniversary', housewarming: 'housewarming', religious: 'religious', festival: 'festival', corporate: 'corporate', conference: 'conference', launch: 'launch', school: 'school', farewell: 'farewell', community: 'community', custom: 'all' };
  const inTab = (id, tab) => tab === 'all' || (META[id] && META[id].occ.includes(tab));

  /* ---------- describe your card ---------- */
  // colour words → hex, used to match palettes and to pick the AI colour set
  const COLOURS = {
    ivory: '#f8f1e3', cream: '#f5ecd7', white: '#ffffff', beige: '#e8d9bf', champagne: '#e6d3ad', gold: '#c9a15a', golden: '#c9a15a',
    maroon: '#6b1426', burgundy: '#6b1426', red: '#b3202a', pink: '#f2a7b8', blush: '#f4c9cf', rose: '#d27d8e', peach: '#ffcfae', coral: '#f28b6b',
    orange: '#ee8a24', saffron: '#f08a1c', yellow: '#f4cc3c', marigold: '#f2a516', green: '#2f7a4c', emerald: '#0f5a43', sage: '#a9b89a', teal: '#16747a',
    blue: '#2f5bea', navy: '#13224a', purple: '#5b2a86', lavender: '#c9b6e8', black: '#111111', dark: '#151022', silver: '#c0c4cc', grey: '#8a8f98', gray: '#8a8f98', pastel: '#f3d9e2',
  };
  const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const dist = (a, b) => Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  const words = (s) => String(s || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  const STOP = new Set('a an the and or with of for in on to my our card invitation invite please create make want like feel look design style very some'.split(' '));

  // map words to the AI painter's ready styles and colour sets
  const AI_STYLE_WORDS = {
    royal: 'royal regal palace rajasthani peacock grand heritage jharokha arch traditional', floral: 'floral flowers flower rose roses watercolour watercolor garden botanical pastel',
    temple: 'temple gopuram diya diyas banana south kerala tamil puja pooja', minimal: 'minimal minimalist simple clean elegant ivory paper fine plain',
    mehndi: 'mehndi henna marigold haldi sangeet', pichwai: 'pichwai lotus cow cows krishna shrinathji pond traditional art',
    birthday: 'birthday balloons balloon confetti kids cute animals party', corporate: 'corporate business office professional conference launch modern waves',
  };
  const AI_COLOR_WORDS = [
    ['maroon-gold', ['maroon', 'burgundy', 'red']], ['pink-peach', ['pink', 'peach', 'blush', 'pastel']], ['emerald-gold', ['emerald', 'green']],
    ['royal-blue', ['blue', 'navy']], ['ivory-gold', ['ivory', 'cream', 'white', 'champagne', 'beige']], ['saffron-yellow', ['saffron', 'orange', 'yellow', 'marigold']],
    ['purple-lavender', ['purple', 'lavender']], ['teal-coral', ['teal', 'coral']],
  ];

  function suggest(text, category) {
    const ws = words(text).filter((w) => !STOP.has(w));
    const colourWords = ws.filter((w) => COLOURS[w]);
    const tab = TAB_FOR_CAT[category] || 'all';
    const out = [];
    Object.keys(META).forEach((id) => {
      const th = (window.IXT && IXT.THEMES[id]) || { palettes: [{}], name: id };
      const tags = new Set(words(META[id].tags + ' ' + th.name));
      let score = 0;
      const hits = [];
      ws.forEach((w) => { if (tags.has(w)) { score += COLOURS[w] ? 1 : 2; hits.push(w); } });
      if (inTab(id, tab) && tab !== 'all') score += id === 'minimal-ivory' ? 0.5 : 1.5;
      if (id === 'minimal-ivory') score -= 0.5;
      // best palette for the colour words
      let pal = 0;
      if (colourWords.length) {
        let best = Infinity;
        (th.palettes || []).forEach((p, i) => {
          const pc = [p.bg, p.bg2, p.accent].map(hex).filter(Boolean);
          const d = colourWords.reduce((s, w) => s + Math.min(...pc.map((c) => dist(c, hex(COLOURS[w])))), 0) / colourWords.length;
          const named = colourWords.filter((w) => String(p.name || '').toLowerCase().includes(w)).length;
          const v = d - named * 60;
          if (v < best) { best = v; pal = i; }
        });
        score += Math.max(0, 2 - best / 90);
      }
      out.push({ theme: id, palette: pal, score, hits: [...new Set(hits)].slice(0, 4) });
    });
    out.sort((a, b) => b.score - a.score);
    // AI painter settings
    const GENERIC = new Set(['elegant', 'simple', 'clean', 'ivory', 'modern', 'traditional', 'pastel', 'party', 'plain']);
    const aiScore = Object.entries(AI_STYLE_WORDS).map(([id, t]) => [id, ws.filter((w) => t.split(' ').includes(w)).reduce((n, w) => n + (GENERIC.has(w) ? 0.4 : 1), 0) + (id === 'royal' && ws.includes('royal') ? 0.5 : 0)]).sort((a, b) => b[1] - a[1]);
    const aiStyle = aiScore[0][1] ? aiScore[0][0] : null;
    const colRank = AI_COLOR_WORDS.map(([id, list]) => [id, colourWords.filter((w) => list.includes(w)).length + (id === 'ivory-gold' && colourWords.some((w) => w === 'gold' || w === 'golden') ? 0.5 : 0)]).sort((a, b) => b[1] - a[1]);
    const aiColors = colRank[0][1] >= 1 ? colRank[0][0] : 'auto';
    const understood = colourWords.length > 0 || out.some((d) => d.hits.length) || !!aiStyle;
    return { designs: out.slice(0, 3), aiStyle, aiColors, words: String(text || '').trim().slice(0, 120), understood };
  }

  /* ---------- font pairings ---------- */
  const FONT_PAIRS = [
    { id: 'classic', name: 'Classic royal', fonts: { script: 'Great Vibes', head: 'Cormorant Garamond', body: 'Lora' }, for: ['royal-maroon', 'golden-anniversary', 'blush-rings', 'minimal-ivory', 'eucalyptus-garland', 'sage-garden', 'champagne-arch'] },
    { id: 'graceful', name: 'Graceful modern', fonts: { script: 'Parisienne', head: 'Playfair Display', body: 'Lato' }, for: ['blush-rings', 'golden-anniversary', 'sunset-farewell', 'minimal-ivory', 'royal-maroon', 'sage-garden', 'eucalyptus-garland', 'fern-meadow', 'champagne-arch', 'pampas-arch'] },
    { id: 'festive', name: 'Festive Indian', fonts: { script: 'Yatra One', head: 'Playfair Display', body: 'Mukta' }, for: ['himalayan-dham', 'griha-pravesh', 'saffron-puja', 'royal-maroon'] },
    { id: 'devotional', name: 'Devotional', fonts: { script: 'Yatra One', head: 'Tiro Devanagari Hindi', body: 'Mukta' }, for: ['saffron-puja', 'griha-pravesh', 'himalayan-dham'] },
    { id: 'hand', name: 'Warm handwritten', fonts: { script: 'Kalam', head: 'Poppins', body: 'Nunito' }, for: ['community-leaf', 'confetti-party', 'sunset-farewell', 'campus-stars', 'fern-meadow', 'eucalyptus-garland'] },
    { id: 'party', name: 'Party fun', fonts: { script: 'Pacifico', head: 'Baloo 2', body: 'Nunito' }, for: ['confetti-party', 'launch-burst', 'campus-stars'] },
    { id: 'business', name: 'Clean business', fonts: { script: 'Montserrat', head: 'Montserrat', body: 'Inter' }, for: ['corporate-slate', 'conference-night', 'launch-burst', 'minimal-ivory'] },
    { id: 'editorial', name: 'Editorial', fonts: { script: 'Playfair Display', head: 'Playfair Display', body: 'Source Sans 3' }, for: ['corporate-slate', 'campus-stars', 'golden-anniversary', 'minimal-ivory', 'fern-meadow', 'sage-garden', 'pampas-arch'] },
    { id: 'tech', name: 'Tech launch', fonts: { script: 'Bebas Neue', head: 'Space Grotesk', body: 'Inter' }, for: ['conference-night', 'launch-burst'] },
  ];
  const pairsFor = (themeId) => {
    const own = FONT_PAIRS.filter((p) => p.for.includes(themeId));
    return (own.length >= 3 ? own : own.concat(FONT_PAIRS.filter((p) => !own.includes(p)))).slice(0, 3);
  };


  /* ---------- studio filters: design style, colours, one-line descriptions ---------- */
  const STYLES = [['royal', 'Royal'], ['traditional', 'Traditional'], ['modern', 'Modern'], ['minimal', 'Minimal'], ['floral', 'Floral'], ['vintage', 'Vintage'], ['calligraphy', 'Calligraphy'], ['luxury', 'Luxury']];
  const STYLE_OF = {
    'royal-maroon': ['royal', 'traditional', 'floral', 'luxury'], 'himalayan-dham': ['traditional', 'vintage'], 'blush-rings': ['modern', 'floral'],
    'confetti-party': ['modern'], 'golden-anniversary': ['luxury', 'vintage', 'minimal'], 'griha-pravesh': ['traditional', 'floral'],
    'saffron-puja': ['traditional', 'royal'], 'corporate-slate': ['modern', 'minimal'], 'conference-night': ['modern'], 'launch-burst': ['modern'],
    'campus-stars': ['traditional', 'vintage'], 'sunset-farewell': ['vintage', 'modern'], 'community-leaf': ['modern', 'minimal', 'floral'], 'minimal-ivory': ['minimal', 'luxury', 'modern'],
    'sage-garden': ['floral', 'minimal', 'modern'], 'eucalyptus-garland': ['floral', 'modern'], 'fern-meadow': ['floral', 'minimal'],
    'champagne-arch': ['luxury', 'floral', 'royal'], 'pampas-arch': ['luxury', 'vintage', 'modern'],
  };
  const DESC = {
    'royal-maroon': 'Rich maroon with painted roses and palace doors that open.',
    'himalayan-dham': 'Mountains, deodar trees and a temple roof, in pahadi colours.',
    'blush-rings': 'Soft blush tones, two rings and an envelope opening.',
    'confetti-party': 'Balloons and confetti in bright, happy colours.',
    'golden-anniversary': 'Ivory and gold leaves for a timeless, formal feel.',
    'griha-pravesh': 'Marigold toran and mango leaves over a festive doorway.',
    'saffron-puja': 'Saffron mandala and diyas for pujas and festivals.',
    'corporate-slate': 'Clean lines and calm colours for business meetings.',
    'conference-night': 'Dark, techy network pattern for summits and events.',
    'launch-burst': 'Bold burst and big capitals for a launch day.',
    'campus-stars': 'Stars and classic serif type for school and college.',
    'sunset-farewell': 'Warm sunset hills for farewells and retirements.',
    'community-leaf': 'Fresh green leaves and friendly handwriting.',
    'minimal-ivory': 'Plain ivory paper and fine type. Lets your words lead.',
    'sage-garden': 'Watercolour sage leaves in two corners, ivory paper and a fine gold frame.',
    'eucalyptus-garland': 'A soft eucalyptus garland draped across the top of the card.',
    'fern-meadow': 'Watercolour ferns and wild grasses growing up from the bottom.',
    'champagne-arch': 'Cream roses over an arched doorway, with a gold sun opening.',
    'pampas-arch': 'Dried pampas and small roses over an arch, in sand and gold.',
  };
  const COLOURS_F = [['burgundy', 'Burgundy', '#6b1426'], ['gold', 'Gold', '#c9a15a'], ['ivory', 'Ivory', '#f6ecd8'], ['pink', 'Pink', '#f2a7b8'], ['blue', 'Blue', '#2f5bea'], ['green', 'Green', '#2f7a4c'], ['other', 'Other', 'conic-gradient(#ee8a24,#5b2a86,#111,#16747a,#ee8a24)']];
  const hsl = (h) => {
    const c = hex(h); if (!c) return null;
    const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let hue = 0; const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    if (d) hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(hue * 60 + 360) % 360, sat, l];
  };
  // The colour families one colour belongs to.
  function bucket(h) {
    const v = hsl(h); if (!v) return [];
    const [hu, sa, l] = v, red = hu >= 330 || hu < 15;
    if (l > 0.88 && (sa < 0.75 || (hu > 25 && hu < 60))) return ['ivory'];
    if (sa < 0.12) return l < 0.2 ? ['other'] : ['other'];
    if ((red || (hu >= 300 && hu < 330)) && l < 0.4) return ['burgundy'];
    if ((red || hu >= 300) && l >= 0.55) return ['pink'];
    if (red) return ['burgundy'];
    if (hu >= 28 && hu < 55 && sa > 0.25 && l > 0.3 && l < 0.75) return ['gold'];
    if (hu >= 75 && hu < 175) return ['green'];
    if (hu >= 175 && hu < 260) return ['blue'];
    return ['other'];
  }
  const palColours = (p) => [...new Set([].concat(bucket(p.bg), bucket(p.accent), bucket(p.gold || p.accent)))];
  // The first palette of a design that has every chosen colour, or -1.
  function palFor(themeId, colours) {
    const th = window.IXT && IXT.THEMES[themeId]; if (!th) return -1;
    if (!colours || !colours.length) return 0;
    return th.palettes.findIndex((p) => { const has = palColours(p); return colours.some((c) => has.includes(c)); });
  }
  const matches = (id, f) => inTab(id, f.occ || 'all') && (!f.styles || !f.styles.length || f.styles.some((st) => (STYLE_OF[id] || []).includes(st))) && palFor(id, f.colours) >= 0;

  window.IXGallery = { META, TABS, TAB_FOR_CAT, inTab, suggest, FONT_PAIRS, pairsFor, STYLES, STYLE_OF, DESC, COLOURS_F, palColours, palFor, matches };
})();
