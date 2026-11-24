/* Invitation categories, design themes, illustration motifs and the
 * template-based message assistant. Exposed as window.IXT */
(function () {
  'use strict';

  /* ---------------- Categories ---------------- */
  const CATEGORIES = [
    { id: 'wedding', name: 'Wedding', icon: '💍', theme: 'royal-maroon', main: 'Wedding Ceremony', events: ['Mehendi', 'Haldi', 'Wedding Ceremony', 'Reception'], occasion: { en: 'wedding', hi: 'विवाह', pa: 'ਵਿਆਹ' } },
    { id: 'engagement', name: 'Engagement & Reception', icon: '💞', theme: 'blush-rings', events: ['Ring Ceremony', 'Reception'], occasion: { en: 'engagement', hi: 'सगाई', pa: 'ਮੰਗਣੀ' } },
    { id: 'birthday', name: 'Birthday', icon: '🎂', theme: 'confetti-party', events: ['Birthday Party'], occasion: { en: 'birthday celebration', hi: 'जन्मदिन समारोह', pa: 'ਜਨਮਦਿਨ ਸਮਾਰੋਹ' } },
    { id: 'anniversary', name: 'Anniversary', icon: '🥂', theme: 'golden-anniversary', events: ['Anniversary Dinner'], occasion: { en: 'wedding anniversary', hi: 'विवाह वर्षगांठ', pa: 'ਵਿਆਹ ਦੀ ਵਰ੍ਹੇਗੰਢ' } },
    { id: 'housewarming', name: 'Housewarming', icon: '🏡', theme: 'griha-pravesh', events: ['Griha Pravesh Puja', 'Lunch'], occasion: { en: 'housewarming ceremony', hi: 'गृह प्रवेश', pa: 'ਗ੍ਰਹਿ ਪ੍ਰਵੇਸ਼' } },
    { id: 'religious', name: 'Religious Function / Puja', icon: '🪔', theme: 'saffron-puja', events: ['Puja', 'Aarti', 'Prasad'], occasion: { en: 'puja', hi: 'पूजा', pa: 'ਪੂਜਾ' } },
    { id: 'festival', name: 'Festival & Family Gathering', icon: '🏔️', theme: 'himalayan-dham', events: ['Family Gathering', 'Dham (Community Feast)'], occasion: { en: 'family celebration', hi: 'पारिवारिक उत्सव', pa: 'ਪਰਿਵਾਰਕ ਜਸ਼ਨ' } },
    { id: 'corporate', name: 'Corporate Meeting', icon: '💼', theme: 'corporate-slate', events: ['Meeting'], occasion: { en: 'meeting', hi: 'बैठक', pa: 'ਮੀਟਿੰਗ' } },
    { id: 'conference', name: 'Business Conference', icon: '🎤', theme: 'conference-night', events: ['Registration', 'Keynote', 'Networking Dinner'], occasion: { en: 'conference', hi: 'सम्मेलन', pa: 'ਸੰਮੇਲਨ' } },
    { id: 'launch', name: 'Product Launch', icon: '🚀', theme: 'launch-burst', events: ['Launch Event'], occasion: { en: 'product launch', hi: 'उत्पाद लॉन्च', pa: 'ਉਤਪਾਦ ਲਾਂਚ' } },
    { id: 'school', name: 'School & College Event', icon: '🎓', theme: 'campus-stars', events: ['Annual Function'], occasion: { en: 'event', hi: 'समारोह', pa: 'ਸਮਾਰੋਹ' } },
    { id: 'farewell', name: 'Retirement & Farewell', icon: '🌅', theme: 'sunset-farewell', events: ['Farewell Dinner'], occasion: { en: 'farewell celebration', hi: 'विदाई समारोह', pa: 'ਵਿਦਾਇਗੀ ਸਮਾਰੋਹ' } },
    { id: 'community', name: 'Community Function', icon: '🤝', theme: 'community-leaf', events: ['Community Gathering'], occasion: { en: 'community gathering', hi: 'सामुदायिक समारोह', pa: 'ਭਾਈਚਾਰਕ ਸਮਾਰੋਹ' } },
    { id: 'custom', name: 'Custom Event', icon: '✨', theme: 'minimal-ivory', events: ['Main Event'], occasion: { en: 'celebration', hi: 'समारोह', pa: 'ਸਮਾਰੋਹ' } },
  ];

  /* ---------------- Themes ----------------
   palette keys: bg, bg2 (gradient end), surface, text, muted, accent, accent2, onAccent */
  const THEMES = {
    'royal-maroon': {
      name: 'Royal Maroon Florals', motif: 'floral', opener: 'doors',
      fonts: { script: 'Great Vibes', head: 'Cormorant Garamond', body: 'Cormorant Garamond' },
      palettes: [
        { name: 'Maroon & Gold', bg: '#3b0a16', bg2: '#22050c', surface: 'rgba(255,240,220,0.06)', text: '#f6e7cf', muted: '#d7b98f', accent: '#d4a557', accent2: '#b5455c', onAccent: '#2a0710' },
        { name: 'Emerald & Gold', bg: '#0f3329', bg2: '#071c16', surface: 'rgba(255,240,220,0.06)', text: '#f4ecd8', muted: '#cdbf95', accent: '#d8b464', accent2: '#c26a7a', onAccent: '#0b2119' },
        { name: 'Ivory & Rose', bg: '#fbf3ea', bg2: '#f1dfd0', surface: 'rgba(120,40,50,0.05)', text: '#4a1420', muted: '#8a5a5f', accent: '#a8803a', accent2: '#b5455c', onAccent: '#fff' },
      ],
    },
    'himalayan-dham': {
      name: 'Himalayan Dham', motif: 'himalayan', opener: 'curtain',
      fonts: { script: 'Yatra One', head: 'Playfair Display', body: 'Lora' },
      palettes: [
        { name: 'Pahadi Maroon', bg: '#f4e4dc', bg2: '#e9cfc4', surface: 'rgba(110,30,40,0.06)', text: '#5a1622', muted: '#7d5a4e', accent: '#7a1f2e', accent2: '#5d7a4a', gold: '#c49a45', onAccent: '#fff6ea' },
        { name: 'Deodar Green', bg: '#e9efe2', bg2: '#d4e0c8', surface: 'rgba(40,70,40,0.07)', text: '#283d26', muted: '#5b6b52', accent: '#3f5f37', accent2: '#9b3446', gold: '#b8903c', onAccent: '#fff' },
        { name: 'Snow Peak', bg: '#eef1f5', bg2: '#dfe5ee', surface: 'rgba(30,50,80,0.06)', text: '#24324a', muted: '#5d6b80', accent: '#7a1f2e', accent2: '#4d6b52', gold: '#c49a45', onAccent: '#fff' },
      ],
    },
    'blush-rings': {
      name: 'Blush Rings', motif: 'rings', opener: 'envelope',
      fonts: { script: 'Parisienne', head: 'Cormorant Garamond', body: 'Lato' },
      palettes: [
        { name: 'Blush & Rose Gold', bg: '#fdf0ef', bg2: '#f6d9d6', surface: 'rgba(160,70,80,0.06)', text: '#5b2a33', muted: '#9a6b70', accent: '#b76e79', accent2: '#c9a26b', onAccent: '#fff' },
        { name: 'Lavender', bg: '#f3effa', bg2: '#e2d8f2', surface: 'rgba(80,60,120,0.06)', text: '#3d2d5c', muted: '#776a90', accent: '#8a6fb8', accent2: '#c9a26b', onAccent: '#fff' },
        { name: 'Midnight Rose', bg: '#2a1a2e', bg2: '#170d1a', surface: 'rgba(255,220,230,0.06)', text: '#f8e6ea', muted: '#cfaab3', accent: '#e8a0ae', accent2: '#d9b779', onAccent: '#2a1a2e' },
      ],
    },
    'confetti-party': {
      name: 'Confetti Party', motif: 'balloons', opener: 'pop',
      fonts: { script: 'Pacifico', head: 'Baloo 2', body: 'Nunito' },
      palettes: [
        { name: 'Candy Pop', bg: '#fff6e9', bg2: '#ffe3ef', surface: 'rgba(90,40,120,0.05)', text: '#3a2350', muted: '#7a6690', accent: '#ff5d8f', accent2: '#2ec4b6', gold: '#ffbf3c', onAccent: '#fff' },
        { name: 'Ocean Splash', bg: '#e9f7ff', bg2: '#d6efff', surface: 'rgba(20,60,110,0.05)', text: '#0e2f56', muted: '#4f6d8f', accent: '#1f7ae0', accent2: '#ffb703', gold: '#ff5d8f', onAccent: '#fff' },
        { name: 'Night Party', bg: '#1b1035', bg2: '#0e0820', surface: 'rgba(255,255,255,0.06)', text: '#f7f1ff', muted: '#b9a9da', accent: '#ff4fa3', accent2: '#35e0c8', gold: '#ffd166', onAccent: '#1b1035' },
      ],
    },
    'golden-anniversary': {
      name: 'Golden Years', motif: 'leaves', opener: 'fade',
      fonts: { script: 'Allura', head: 'Playfair Display', body: 'Lora' },
      palettes: [
        { name: 'Ivory Gold', bg: '#fbf7ee', bg2: '#f1e6cc', surface: 'rgba(120,90,30,0.06)', text: '#3e3220', muted: '#7d6c4f', accent: '#b08d3c', accent2: '#8c5b3f', onAccent: '#fff' },
        { name: 'Black Tie', bg: '#141414', bg2: '#050505', surface: 'rgba(255,240,200,0.06)', text: '#f3ead3', muted: '#bdb196', accent: '#d4b35f', accent2: '#a7a7a7', onAccent: '#141414' },
        { name: 'Ruby', bg: '#4a0f1d', bg2: '#2b0710', surface: 'rgba(255,230,200,0.06)', text: '#f8e9d6', muted: '#d6b9a0', accent: '#e0b55e', accent2: '#e06a7f', onAccent: '#4a0f1d' },
      ],
    },
    'griha-pravesh': {
      name: 'Griha Pravesh Toran', motif: 'toran', opener: 'doors',
      fonts: { script: 'Kaushan Script', head: 'Playfair Display', body: 'Mukta' },
      palettes: [
        { name: 'Marigold', bg: '#fff7e6', bg2: '#ffe6bf', surface: 'rgba(150,80,0,0.06)', text: '#4b2a06', muted: '#86643a', accent: '#e07b00', accent2: '#2f7d3b', onAccent: '#fff' },
        { name: 'Peacock', bg: '#e8f5f3', bg2: '#cfe9e5', surface: 'rgba(0,80,90,0.06)', text: '#0b3b40', muted: '#46706f', accent: '#00796b', accent2: '#e07b00', onAccent: '#fff' },
      ],
    },
    'saffron-puja': {
      name: 'Saffron Puja', motif: 'mandala', opener: 'fade',
      fonts: { script: 'Yatra One', head: 'Tiro Devanagari Hindi', body: 'Mukta' },
      palettes: [
        { name: 'Saffron', bg: '#fff3e0', bg2: '#ffd9a8', surface: 'rgba(160,60,0,0.06)', text: '#5a1d00', muted: '#8a5a33', accent: '#c2410c', accent2: '#b7791f', onAccent: '#fff' },
        { name: 'Kumkum Red', bg: '#5c0b0b', bg2: '#370505', surface: 'rgba(255,220,160,0.07)', text: '#ffe9c7', muted: '#e5c193', accent: '#f2b33d', accent2: '#ff7b54', onAccent: '#3a0505' },
      ],
    },
    'corporate-slate': {
      name: 'Corporate Slate', motif: 'geometric', opener: 'fade',
      fonts: { script: 'Montserrat', head: 'Montserrat', body: 'Inter' },
      palettes: [
        { name: 'Navy & Teal', bg: '#f5f7fb', bg2: '#e6ebf4', surface: 'rgba(15,40,80,0.05)', text: '#0f2340', muted: '#5a6a85', accent: '#0e7c86', accent2: '#1d3a6b', onAccent: '#fff' },
        { name: 'Charcoal & Amber', bg: '#1d2127', bg2: '#111418', surface: 'rgba(255,255,255,0.05)', text: '#eef1f5', muted: '#a3acb9', accent: '#f0a500', accent2: '#5aa9e6', onAccent: '#111418' },
        { name: 'Clean White', bg: '#ffffff', bg2: '#f2f4f7', surface: 'rgba(0,0,0,0.04)', text: '#1b1f24', muted: '#5f6b7a', accent: '#2f5bea', accent2: '#13a389', onAccent: '#fff' },
      ],
    },
    'conference-night': {
      name: 'Conference Network', motif: 'network', opener: 'fade',
      fonts: { script: 'Space Grotesk', head: 'Space Grotesk', body: 'Inter' },
      palettes: [
        { name: 'Deep Space', bg: '#0b1530', bg2: '#050a19', surface: 'rgba(120,170,255,0.07)', text: '#eaf1ff', muted: '#9fb1d6', accent: '#4cc9f0', accent2: '#7b61ff', onAccent: '#071025' },
        { name: 'Daylight', bg: '#f4f8ff', bg2: '#e3edff', surface: 'rgba(30,60,140,0.05)', text: '#0d1f4a', muted: '#53628a', accent: '#3a5cff', accent2: '#00b3a4', onAccent: '#fff' },
      ],
    },
    'launch-burst': {
      name: 'Launch Burst', motif: 'burst', opener: 'pop',
      fonts: { script: 'Bebas Neue', head: 'Bebas Neue', body: 'Inter' },
      palettes: [
        { name: 'Electric', bg: '#0d0d14', bg2: '#1a0f2e', surface: 'rgba(255,255,255,0.06)', text: '#ffffff', muted: '#b4b0c8', accent: '#ff3d71', accent2: '#00e0ff', onAccent: '#0d0d14' },
        { name: 'Citrus', bg: '#fffbea', bg2: '#ffefc2', surface: 'rgba(0,0,0,0.04)', text: '#1f1a07', muted: '#6b6141', accent: '#ff6b00', accent2: '#00a676', onAccent: '#fff' },
      ],
    },
    'campus-stars': {
      name: 'Campus Stars', motif: 'stars', opener: 'fade',
      fonts: { script: 'Merriweather', head: 'Merriweather', body: 'Source Sans 3' },
      palettes: [
        { name: 'Royal Blue', bg: '#f2f6ff', bg2: '#dde7ff', surface: 'rgba(20,50,120,0.05)', text: '#0f2557', muted: '#52638e', accent: '#1f4bd8', accent2: '#f5b700', onAccent: '#fff' },
        { name: 'Maroon Crest', bg: '#fbf5f3', bg2: '#efe1dc', surface: 'rgba(100,20,30,0.05)', text: '#3f0d16', muted: '#7d5a5f', accent: '#8b1e2f', accent2: '#c9a227', onAccent: '#fff' },
      ],
    },
    'sunset-farewell': {
      name: 'Sunset Farewell', motif: 'sunset', opener: 'fade',
      fonts: { script: 'Satisfy', head: 'Playfair Display', body: 'Lato' },
      palettes: [
        { name: 'Golden Hour', bg: '#fff4ea', bg2: '#ffd9c2', surface: 'rgba(140,60,20,0.06)', text: '#4a2416', muted: '#8a6150', accent: '#e4572e', accent2: '#7b4b94', onAccent: '#fff' },
        { name: 'Dusk', bg: '#2d1b3d', bg2: '#170d22', surface: 'rgba(255,220,200,0.06)', text: '#fbe9e0', muted: '#cdb0bf', accent: '#ff9f68', accent2: '#ff6f91', onAccent: '#2d1b3d' },
      ],
    },
    'community-leaf': {
      name: 'Community Leaf', motif: 'leaves', opener: 'fade',
      fonts: { script: 'Kalam', head: 'Poppins', body: 'Nunito' },
      palettes: [
        { name: 'Fresh Green', bg: '#f1f8ef', bg2: '#dcefd6', surface: 'rgba(30,80,30,0.05)', text: '#1e3a1e', muted: '#557055', accent: '#2e7d32', accent2: '#f39c12', onAccent: '#fff' },
        { name: 'Earth', bg: '#f7f1e8', bg2: '#eadfcd', surface: 'rgba(90,60,30,0.06)', text: '#3c2a17', muted: '#7a6650', accent: '#8d5a2b', accent2: '#4e7d4b', onAccent: '#fff' },
      ],
    },
    'painted-art': {
      name: 'Your Painted Artwork', motif: 'artwork', opener: 'fade',
      fonts: { script: 'Great Vibes', head: 'Cormorant Garamond', body: 'Lato' },
      palettes: [
        { name: 'Ivory & Ink', bg: '#fbf8f1', bg2: '#f3ede1', surface: 'rgba(60,40,20,0.035)', text: '#26221f', muted: '#6d655c', accent: '#8c2f45', accent2: '#b08d57', onAccent: '#fff' },
        { name: 'Blush', bg: '#fdf6f3', bg2: '#f6e6e0', surface: 'rgba(120,40,60,0.04)', text: '#3d2229', muted: '#7d5f66', accent: '#a3485c', accent2: '#c9a26b', onAccent: '#fff' },
        { name: 'Royal Night', bg: '#1f1519', bg2: '#130c0f', surface: 'rgba(255,240,220,0.05)', text: '#f6ecdf', muted: '#c9b8a6', accent: '#e2b968', accent2: '#c26a7a', onAccent: '#1f1519' },
      ],
    },
    'minimal-ivory': {
      name: 'Minimal Ivory (blank)', motif: 'minimal', opener: 'fade',
      fonts: { script: 'Cormorant Garamond', head: 'Cormorant Garamond', body: 'Inter' },
      palettes: [
        { name: 'Ivory', bg: '#fbfaf7', bg2: '#f1eee6', surface: 'rgba(0,0,0,0.035)', text: '#222', muted: '#6b6b6b', accent: '#8a6d3b', accent2: '#555', onAccent: '#fff' },
        { name: 'Ink', bg: '#111', bg2: '#000', surface: 'rgba(255,255,255,0.05)', text: '#f2f2f2', muted: '#aaa', accent: '#e6c27a', accent2: '#888', onAccent: '#111' },
        { name: 'Sage', bg: '#eef2ec', bg2: '#dde5d9', surface: 'rgba(0,40,0,0.04)', text: '#24301f', muted: '#5f6d58', accent: '#5b7a4f', accent2: '#a1785c', onAccent: '#fff' },
      ],
    },
  };

  const FONT_CHOICES = {
    script: ['Great Vibes', 'Parisienne', 'Allura', 'Pacifico', 'Satisfy', 'Kaushan Script', 'Yatra One', 'Dancing Script', 'Kalam'],
    head: ['Cormorant Garamond', 'Playfair Display', 'Montserrat', 'Poppins', 'Merriweather', 'Baloo 2', 'Bebas Neue', 'Space Grotesk', 'Tiro Devanagari Hindi', 'Lora'],
    body: ['Lora', 'Lato', 'Inter', 'Nunito', 'Mukta', 'Source Sans 3', 'Cormorant Garamond', 'Poppins'],
  };
  // Indic fallbacks appended to every font stack so Hindi / Punjabi always render.
  const INDIC = "'Noto Sans Devanagari', 'Noto Sans Gurmukhi', 'Mukta', sans-serif";
  const fontStack = (f, kind) => `'${f}', ${kind === 'body' ? '' : "'Tiro Devanagari Hindi', "}${INDIC}`;
  const FONT_URL =
    'https://fonts.googleapis.com/css2?family=Great+Vibes&family=Parisienne&family=Allura&family=Pacifico&family=Satisfy&family=Kaushan+Script&family=Yatra+One&family=Dancing+Script:wght@500;700&family=Kalam:wght@400;700' +
    '&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Montserrat:wght@400;600;700&family=Poppins:wght@400;500;600&family=Merriweather:wght@400;700&family=Baloo+2:wght@500;700&family=Bebas+Neue&family=Space+Grotesk:wght@400;600&family=Tiro+Devanagari+Hindi&family=Lora:ital,wght@0,400;0,600;1,400' +
    '&family=Lato:wght@400;700&family=Inter:wght@400;500;600&family=Nunito:wght@400;700&family=Mukta:wght@400;600&family=Source+Sans+3:wght@400;600&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Gurmukhi:wght@400;600&display=swap';

  /* ---------------- Motif illustrations (inline SVG) ---------------- */
  const rose = (x, y, r, c1, c2) => {
    let s = `<g transform="translate(${x} ${y})"><circle r="${r}" fill="${c1}"/>`;
    for (let i = 0; i < 5; i++) {
      const a = i * 72, rr = r * 0.95;
      s += `<path d="M0 0 Q ${rr} ${-rr * 0.2} ${rr * 0.6} ${-rr * 0.85} Q ${rr * 0.1} ${-rr * 1.1} 0 0Z" fill="${c2}" opacity=".55" transform="rotate(${a})"/>`;
    }
    s += `<path d="M${-r * 0.45} 0 a${r * 0.45} ${r * 0.45} 0 1 1 ${r * 0.9} 0 a${r * 0.32} ${r * 0.32} 0 1 1 ${-r * 0.64} 0 a${r * 0.18} ${r * 0.18} 0 1 1 ${r * 0.36} 0" fill="none" stroke="${c2}" stroke-width="${r * 0.12}" opacity=".9"/></g>`;
    return s;
  };
  const leaf = (x, y, len, rot, c) =>
    `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0 Q ${len * 0.45} ${-len * 0.28} ${len} 0 Q ${len * 0.45} ${len * 0.28} 0 0Z" fill="${c}"/><path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0 L ${len * 0.92} 0" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`;

  const M = {};
  M.floral = (p) => {
    const g = p.gold || p.accent;
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${leaf(20, 90, 70, -40, '#5f6b3a')}${leaf(60, 30, 80, 10, '#4f5d2f')}${leaf(120, 18, 60, -10, g)}${leaf(18, 140, 55, -70, g)}
      ${leaf(95, 70, 60, 30, '#6b7840')}${leaf(150, 40, 50, 25, '#56633a')}
      ${rose(48, 48, 30, '#7d1d2f', '#e7b9b6')}${rose(100, 30, 20, '#e9c6c0', '#a0505e')}${rose(26, 105, 18, '#9b2c40', '#f1cfc8')}
      ${rose(84, 82, 13, '#5c1020', '#d9a0a5')}
      <circle cx="140" cy="70" r="3" fill="${g}"/><circle cx="70" cy="125" r="2.5" fill="${g}"/><circle cx="165" cy="22" r="2" fill="${g}"/>
    </svg>`;
    return { corner, hero: '', divider: dividerSVG(g) };
  };
  M.himalayan = (p) => {
    const g = p.gold || '#c49a45';
    const hero = `<svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs><linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.bg}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient></defs>
            <circle cx="300" cy="90" r="34" fill="${g}" opacity=".55"/>
      <path d="M60 60 q6 -5 12 0 q6 -5 12 0 M250 40 q5 -4 10 0 q5 -4 10 0 M110 85 q4 -3 8 0 q4 -3 8 0" stroke="${p.accent}" stroke-width="1.6" fill="none" opacity=".6"/>
      <path d="M-10 200 L60 110 L110 160 L170 80 L240 170 L300 100 L360 150 L410 120 L410 320 L-10 320Z" fill="#c9a6a8" opacity=".75"/>
      <path d="M170 80 L188 104 L178 100 L170 110 L160 98 L152 104Z M60 110 L74 128 L66 125 L58 132 L50 124Z M300 100 L314 118 L306 114 L298 122 L290 114Z" fill="#fff" opacity=".9"/>
      <path d="M-10 230 L50 170 L100 210 L160 150 L230 220 L290 160 L350 210 L410 180 L410 320 L-10 320Z" fill="${p.accent}" opacity=".55"/>
      <path d="M-10 260 Q60 220 130 250 T260 245 T410 240 L410 320 L-10 320Z" fill="#5d7a4a"/>
      <path d="M-10 285 Q90 255 200 280 T410 270 L410 320 L-10 320Z" fill="#46603a"/>
      ${[20, 42, 330, 352, 375].map((x, i) => `<g transform="translate(${x} ${262 + (i % 2) * 6})"><path d="M0 -38 L12 -14 L6 -14 L15 2 L-15 2 L-6 -14 L-12 -14Z" fill="#2f4a2c"/><rect x="-2" y="2" width="4" height="8" fill="#4a3020"/></g>`).join('')}
      <g transform="translate(200 250)">
        <rect x="-26" y="-6" width="52" height="30" fill="#efe3d3" stroke="${p.accent}" stroke-width="1.5"/>
        <rect x="-7" y="6" width="14" height="18" fill="${p.accent}"/>
        <path d="M-36 -6 L0 -26 L36 -6Z" fill="${p.accent}"/>
        <path d="M-28 -22 L0 -40 L28 -22Z" fill="${p.accent}" opacity=".9"/>
        <path d="M-18 -36 L0 -52 L18 -36Z" fill="${p.accent}" opacity=".85"/>
        <path d="M0 -52 L0 -62" stroke="${g}" stroke-width="2"/><circle cx="0" cy="-64" r="3" fill="${g}"/>
        <path d="M-36 -6 L36 -6" stroke="${g}" stroke-width="2"/>
      </g>
    </svg>`;
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${leaf(10, 30, 70, 20, '#5d7a4a')}${leaf(10, 30, 60, 55, '#46603a')}${leaf(10, 30, 50, -5, g)}
      <circle cx="40" cy="40" r="9" fill="#d68b9b"/><circle cx="40" cy="40" r="4" fill="${g}"/>
      <circle cx="75" cy="22" r="6" fill="${p.accent}"/><circle cx="22" cy="78" r="6" fill="${p.accent}"/>
    </svg>`;
    return { hero, corner, divider: dividerSVG(g) };
  };
  M.mandala = (p) => {
    const ring = (r, n, len, c, op) => Array.from({ length: n }, (_, i) => `<ellipse cx="0" cy="${-r}" rx="${len * 0.35}" ry="${len}" fill="${c}" opacity="${op}" transform="rotate(${(360 / n) * i})"/>`).join('');
    const mandala = `<g>${ring(60, 24, 16, p.accent, 0.35)}${ring(40, 16, 12, p.accent2, 0.45)}${ring(22, 12, 8, p.accent, 0.6)}<circle r="10" fill="${p.accent2}"/></g>`;
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g transform="translate(30 30)">${mandala}</g></svg>`;
    const hero = `<svg viewBox="-100 -100 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="spin-slow">${mandala}${ring(85, 32, 10, p.accent2, 0.25)}</svg>`;
    return { corner, hero, divider: dividerSVG(p.accent) };
  };
  M.rings = (p) => {
    const hero = `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="82" cy="70" r="34" fill="none" stroke="${p.accent2}" stroke-width="7"/>
      <circle cx="118" cy="70" r="34" fill="none" stroke="${p.accent}" stroke-width="7"/>
      <path d="M118 30 l6 -10 l6 10 l-6 6z" fill="${p.accent}"/>
      <path d="M40 22 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z M165 30 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="${p.accent2}"/>
    </svg>`;
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${leaf(10, 20, 70, 25, p.accent)}${leaf(10, 20, 55, 60, p.accent2)}${rose(32, 30, 14, p.accent, '#fff')}</svg>`;
    return { hero, corner, divider: dividerSVG(p.accent) };
  };
  M.balloons = (p) => {
    const cols = [p.accent, p.accent2, p.gold || '#ffbf3c', p.accent, p.accent2];
    const balloons = [[40, 70, 26], [90, 50, 30], [145, 75, 24], [190, 45, 28], [240, 80, 22]].map(([x, y, r], i) =>
      `<g><path d="M${x} ${y + r * 1.2} q -8 30 4 60 q 10 30 -2 60" stroke="${p.muted}" fill="none" stroke-width="1.2"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.2}" fill="${cols[i]}"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.45}" rx="${r * 0.2}" ry="${r * 0.32}" fill="#fff" opacity=".45"/><path d="M${x - 4} ${y + r * 1.2} h8 l-4 6z" fill="${cols[i]}"/></g>`).join('');
    const confetti = Array.from({ length: 26 }, (_, i) => {
      const x = (i * 53) % 280, y = (i * 37) % 200 + 10;
      return `<rect x="${x}" y="${y}" width="6" height="3" fill="${cols[i % 5]}" transform="rotate(${i * 33} ${x} ${y})" opacity=".85"/>`;
    }).join('');
    const hero = `<svg viewBox="0 0 280 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="float">${confetti}${balloons}</svg>`;
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${confetti}</svg>`;
    return { hero, corner, divider: dividerSVG(p.accent) };
  };
  M.leaves = (p) => {
    const branch = Array.from({ length: 7 }, (_, i) => leaf(10 + i * 18, 14 + i * 14, 40 - i * 2, 30 + (i % 2 ? 40 : -20), i % 2 ? p.accent : p.accent2)).join('');
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M0 0 Q 80 40 140 120" stroke="${p.accent2}" fill="none" stroke-width="2"/>${branch}</svg>`;
    return { corner, hero: '', divider: dividerSVG(p.accent) };
  };
  M.toran = (p) => {
    const marigold = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="#f59e0b"/><circle cx="${x}" cy="${y}" r="4" fill="#ea580c"/>`;
    let s = `<path d="M0 6 L400 6" stroke="${p.accent}" stroke-width="3"/>`;
    for (let i = 0; i < 20; i++) {
      const x = 10 + i * 20;
      s += i % 2 ? leaf(x, 8, 34, 90, p.accent2) : marigold(x, 14) + `<path d="M${x} 21 v14" stroke="#ea580c" stroke-width="1.5"/>` + marigold(x, 40);
    }
    const top = `<svg viewBox="0 0 400 60" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${s}</svg>`;
    const hero = `<svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M30 60 Q 60 130 90 60Z" fill="${p.accent}"/><rect x="38" y="48" width="44" height="14" rx="4" fill="${p.accent}"/>
      <path d="M30 70 Q60 80 90 70" stroke="${p.gold || '#f5c542'}" stroke-width="3" fill="none"/>
      ${leaf(60, 48, 34, -120, p.accent2)}${leaf(60, 48, 34, -60, p.accent2)}${leaf(60, 48, 30, -90, p.accent2)}
      <circle cx="60" cy="22" r="13" fill="#d97706"/><circle cx="60" cy="22" r="9" fill="#f59e0b"/>
    </svg>`;
    return { top, hero, corner: '', divider: dividerSVG(p.accent) };
  };
  M.geometric = (p) => {
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0 0 H180 L0 180Z" fill="${p.accent}" opacity=".12"/><path d="M0 0 H120 L0 120Z" fill="${p.accent2}" opacity=".18"/>
      <path d="M0 150 L150 0" stroke="${p.accent}" stroke-width="2"/><path d="M0 200 L200 0" stroke="${p.accent2}" stroke-width="1" opacity=".5"/>
      <circle cx="160" cy="40" r="4" fill="${p.accent}"/></svg>`;
    return { corner, hero: '', divider: `<svg viewBox="0 0 120 8" aria-hidden="true"><rect width="40" height="4" y="2" fill="${p.accent}"/><rect x="44" width="16" height="4" y="2" fill="${p.accent2}"/></svg>` };
  };
  M.network = (p) => {
    const pts = [[20, 40], [70, 20], [120, 60], [60, 90], [160, 30], [190, 90], [110, 130], [30, 150], [170, 160]];
    const lines = [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [4, 5], [2, 5], [2, 6], [6, 7], [3, 7], [5, 8], [6, 8]];
    const hero = `<svg viewBox="0 0 210 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${lines.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}" stroke="${p.accent}" stroke-opacity=".45"/>`).join('')}${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 3.5 : 6}" fill="${i % 2 ? p.accent2 : p.accent}" class="pulse" style="animation-delay:${i * 0.3}s"/>`).join('')}</svg>`;
    return { hero, corner: hero, divider: M.geometric(p).divider };
  };
  M.burst = (p) => {
    const rays = Array.from({ length: 24 }, (_, i) => `<path d="M0 0 L${Math.cos((i * 15 * Math.PI) / 180) * 140} ${Math.sin((i * 15 * Math.PI) / 180) * 140}" stroke="${i % 2 ? p.accent : p.accent2}" stroke-width="${i % 3 ? 1 : 3}" opacity=".5"/>`).join('');
    const hero = `<svg viewBox="-140 -140 280 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="spin-slow">${rays}<circle r="40" fill="${p.accent}" opacity=".25"/><circle r="22" fill="${p.accent2}" opacity=".4"/></svg>`;
    return { hero, corner: '', divider: M.geometric(p).divider };
  };
  const star = (x, y, r, c) => {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, a = (Math.PI / 5) * i - Math.PI / 2;
      d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ' ' + (y + rr * Math.sin(a)).toFixed(1);
    }
    return `<path d="${d}Z" fill="${c}"/>`;
  };
  M.stars = (p) => {
    const hero = `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M100 30 L170 55 L100 80 L30 55Z" fill="${p.accent}"/><path d="M60 66 V95 Q100 115 140 95 V66 L100 80Z" fill="${p.accent}" opacity=".85"/>
      <path d="M165 57 V95" stroke="${p.accent2}" stroke-width="3"/><circle cx="165" cy="98" r="5" fill="${p.accent2}"/>
      ${star(30, 20, 9, p.accent2)}${star(180, 20, 7, p.accent2)}${star(20, 110, 6, p.accent2)}${star(185, 125, 8, p.accent2)}</svg>`;
    const corner = `<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${star(30, 30, 14, p.accent2)}${star(80, 20, 7, p.accent)}${star(20, 80, 8, p.accent)}${star(70, 70, 5, p.accent2)}</svg>`;
    return { hero, corner, divider: dividerSVG(p.accent2) };
  };
  M.sunset = (p) => {
    const hero = `<svg viewBox="0 0 300 160" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="150" cy="120" r="60" fill="${p.accent}" opacity=".8"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="80" y="${100 + i * 9}" width="140" height="3" fill="${p.bg}" opacity=".7"/>`).join('')}
      <path d="M0 140 Q 80 110 150 135 T 300 130 V160 H0Z" fill="${p.accent2}" opacity=".7"/>
      <path d="M60 50 q6 -5 12 0 q6 -5 12 0 M200 35 q5 -4 10 0 q5 -4 10 0 M230 60 q4 -3 8 0 q4 -3 8 0" stroke="${p.text}" stroke-width="1.5" fill="none" opacity=".6"/></svg>`;
    return { hero, corner: '', divider: dividerSVG(p.accent) };
  };
  M.minimal = (p) => ({ corner: '', hero: '', divider: dividerSVG(p.accent) });
  // Host-uploaded artwork does the decorating; keep our own ornaments quiet.
  M.artwork = (p) => ({ corner: '', hero: '', divider: `<svg viewBox="0 0 120 10" aria-hidden="true"><path d="M0 5 H50 M70 5 H120" stroke="${p.accent2}" stroke-width=".8"/><path d="M60 1 L64 5 L60 9 L56 5Z" fill="${p.accent}"/></svg>` });

  function dividerSVG(c) {
    return `<svg viewBox="0 0 200 20" aria-hidden="true"><path d="M0 10 H80 M120 10 H200" stroke="${c}" stroke-width="1"/><path d="M100 2 L108 10 L100 18 L92 10Z" fill="none" stroke="${c}" stroke-width="1.3"/><circle cx="100" cy="10" r="2.5" fill="${c}"/><circle cx="86" cy="10" r="1.6" fill="${c}"/><circle cx="114" cy="10" r="1.6" fill="${c}"/></svg>`;
  }

  /* ---------- Placeholder sample art (used by sample invitations) ---------- */
  const sampleArt = (kind, a = '#7a1f2e', b = '#d4a557', label = '') => {
    const scenes = {
      couple: `<circle cx="150" cy="120" r="60" fill="${b}" opacity=".35"/><circle cx="125" cy="110" r="22" fill="${a}"/><path d="M90 200 q35 -70 70 0" fill="${a}"/><circle cx="175" cy="108" r="22" fill="${b}"/><path d="M140 200 q35 -75 70 0" fill="${b}"/>`,
      family: `<circle cx="90" cy="110" r="18" fill="${a}"/><path d="M60 200 q30 -60 60 0" fill="${a}"/><circle cx="150" cy="100" r="22" fill="${b}"/><path d="M115 200 q35 -70 70 0" fill="${b}"/><circle cx="210" cy="125" r="14" fill="${a}"/><path d="M188 200 q22 -45 44 0" fill="${a}"/>`,
      food: `<ellipse cx="150" cy="150" rx="110" ry="40" fill="#5d7a4a"/><ellipse cx="150" cy="146" rx="96" ry="32" fill="#7a9a5a"/>${[[100, 140, '#e0a32e'], [140, 130, '#b5452b'], [185, 140, '#f3e2b3'], [125, 158, '#7a3b1f'], [170, 160, '#e9c46a']].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y}" rx="20" ry="9" fill="${c}"/>`).join('')}`,
      mountain: `<path d="M0 200 L80 90 L130 150 L190 70 L300 200Z" fill="${a}" opacity=".8"/><path d="M190 70 L210 98 L198 94 L190 104 L180 92Z M80 90 L95 110 L80 104 L68 112Z" fill="#fff"/><circle cx="250" cy="60" r="22" fill="${b}"/>`,
      cake: `<rect x="95" y="120" width="110" height="60" rx="8" fill="${a}"/><rect x="110" y="90" width="80" height="34" rx="6" fill="${b}"/>${[125, 150, 175].map((x) => `<rect x="${x - 2}" y="70" width="4" height="20" fill="#fff"/><path d="M${x} 58 q5 8 0 12 q-5 -4 0 -12" fill="#ffbf3c"/>`).join('')}`,
      stage: `<rect x="40" y="140" width="220" height="40" fill="${a}"/><rect x="120" y="70" width="60" height="70" rx="4" fill="${b}"/><path d="M60 40 L100 140 M240 40 L200 140" stroke="${b}" stroke-width="3" opacity=".5"/>`,
      venue: `<rect x="70" y="90" width="160" height="90" fill="${a}"/><path d="M60 92 L150 40 L240 92Z" fill="${b}"/>${[95, 135, 175].map((x) => `<rect x="${x}" y="110" width="28" height="70" fill="${b}" opacity=".6"/>`).join('')}`,
      logo: `<circle cx="150" cy="110" r="60" fill="${a}"/><path d="M120 110 l20 20 l40 -45" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round"/>`,
    };
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff8ef"/><stop offset="1" stop-color="#f1dccb"/></linearGradient></defs><rect width="300" height="220" fill="url(#g)"/>${scenes[kind] || ''}${label ? `<text x="150" y="212" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#555">${label}</text>` : ''}</svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  /* ---------------- Message assistant (template based) ----------------
   Works offline. It never replaces the host's text automatically – the editor
   shows a preview and the host chooses Insert / Replace / Cancel. */
  const STYLES = ['traditional', 'royal', 'modern', 'formal', 'friendly', 'religious', 'corporate'];
  const MSG = {
    en: {
      traditional: (o) => `<p>With the blessings of our elders and the grace of the Almighty,</p><p><b>${o.host}</b> cordially invite you and your family to grace the auspicious occasion of our ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''}.</p><p>Your presence and blessings will make this day complete.</p>`,
      royal: (o) => `<p>Under the gracious blessings of our ancestors,</p><p>the families request the honour of your esteemed presence at the grand ${o.occasion}${o.title ? ` of <b>${o.title}</b>` : ''}.</p><p>Kindly join us to celebrate this regal occasion with joy and splendour.</p>`,
      modern: (o) => `<p>We're celebrating, and it wouldn't be the same without you! 🎉</p><p>Join <b>${o.host}</b> for our ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''}. Expect good food, great company and memories in the making.</p>`,
      formal: (o) => `<p><b>${o.host}</b> requests the pleasure of your company at the ${o.occasion}${o.title ? `, <b>${o.title}</b>` : ''}.</p><p>We would be honoured by your attendance. Kindly confirm your presence using the RSVP below.</p>`,
      friendly: (o) => `<p>Hey there! 👋</p><p>We're having a ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} and we'd love to see you there. Bring your smiles (and your family)!</p><p>– ${o.host}</p>`,
      religious: (o) => `<p>॥ Shubh Aarambh ॥</p><p>By the divine grace of God, <b>${o.host}</b> humbly invite you to join the sacred ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''}, and to receive the blessings and prasad.</p>`,
      corporate: (o) => `<p>Dear Colleague,</p><p><b>${o.host}</b> is pleased to invite you to our ${o.occasion}${o.title ? `, <b>${o.title}</b>` : ''}.</p><p>We look forward to your participation and valuable insights. Please register your attendance below.</p>`,
    },
    hi: {
      traditional: (o) => `<p>बड़ों के आशीर्वाद एवं ईश्वर की असीम कृपा से,</p><p><b>${o.host}</b> आपको सपरिवार हमारे ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} के शुभ अवसर पर सादर आमंत्रित करते हैं।</p><p>आपकी उपस्थिति एवं आशीर्वाद से यह दिन पूर्ण होगा।</p>`,
      royal: (o) => `<p>पूर्वजों के मंगल आशीर्वाद से,</p><p>हम आपको ${o.occasion}${o.title ? ` <b>${o.title}</b>` : ''} के भव्य आयोजन में अपनी गरिमामयी उपस्थिति हेतु सादर आमंत्रित करते हैं।</p>`,
      modern: (o) => `<p>हम जश्न मना रहे हैं और आपके बिना यह अधूरा है! 🎉</p><p><b>${o.host}</b> के साथ ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} में ज़रूर शामिल हों।</p>`,
      formal: (o) => `<p><b>${o.host}</b> आपको ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} में सादर आमंत्रित करते हैं।</p><p>कृपया नीचे दिए गए फ़ॉर्म से अपनी उपस्थिति की पुष्टि करें।</p>`,
      friendly: (o) => `<p>नमस्ते! 👋</p><p>हमारे ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} में आप ज़रूर आइए, आपके आने से रौनक बढ़ जाएगी!</p><p>– ${o.host}</p>`,
      religious: (o) => `<p>॥ श्री गणेशाय नमः ॥</p><p>प्रभु की असीम कृपा से <b>${o.host}</b> आपको ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} में पधारकर आशीर्वाद एवं प्रसाद ग्रहण करने हेतु सादर आमंत्रित करते हैं।</p>`,
      corporate: (o) => `<p>आदरणीय सहकर्मी,</p><p><b>${o.host}</b> आपको ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} में आमंत्रित करते हुए प्रसन्नता का अनुभव करता है।</p><p>कृपया नीचे अपनी उपस्थिति दर्ज करें।</p>`,
    },
    pa: {
      traditional: (o) => `<p>ਵੱਡਿਆਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਅਤੇ ਵਾਹਿਗੁਰੂ ਦੀ ਕਿਰਪਾ ਨਾਲ,</p><p><b>${o.host}</b> ਤੁਹਾਨੂੰ ਪਰਿਵਾਰ ਸਮੇਤ ਸਾਡੇ ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} ਦੇ ਸ਼ੁਭ ਮੌਕੇ \'ਤੇ ਨਿੱਘਾ ਸੱਦਾ ਦਿੰਦੇ ਹਨ।</p><p>ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਨਾਲ ਇਹ ਦਿਨ ਪੂਰਾ ਹੋਵੇਗਾ।</p>`,
      royal: (o) => `<p>ਪੁਰਖਿਆਂ ਦੇ ਅਸ਼ੀਰਵਾਦ ਨਾਲ,</p><p>ਅਸੀਂ ਤੁਹਾਨੂੰ ${o.occasion}${o.title ? ` <b>${o.title}</b>` : ''} ਦੇ ਸ਼ਾਨਦਾਰ ਸਮਾਰੋਹ ਵਿੱਚ ਪਧਾਰਨ ਦਾ ਸਤਿਕਾਰ ਸਹਿਤ ਸੱਦਾ ਦਿੰਦੇ ਹਾਂ।</p>`,
      modern: (o) => `<p>ਅਸੀਂ ਜਸ਼ਨ ਮਨਾ ਰਹੇ ਹਾਂ ਅਤੇ ਤੁਹਾਡੇ ਬਿਨਾਂ ਇਹ ਅਧੂਰਾ ਹੈ! 🎉</p><p><b>${o.host}</b> ਨਾਲ ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} ਵਿੱਚ ਜ਼ਰੂਰ ਸ਼ਾਮਲ ਹੋਵੋ।</p>`,
      formal: (o) => `<p><b>${o.host}</b> ਤੁਹਾਨੂੰ ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} ਵਿੱਚ ਸਤਿਕਾਰ ਸਹਿਤ ਸੱਦਾ ਦਿੰਦੇ ਹਨ।</p><p>ਕਿਰਪਾ ਕਰਕੇ ਹੇਠਾਂ ਆਪਣੀ ਹਾਜ਼ਰੀ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।</p>`,
      friendly: (o) => `<p>ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 👋</p><p>ਸਾਡੇ ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} ਵਿੱਚ ਜ਼ਰੂਰ ਆਇਓ, ਤੁਹਾਡੇ ਨਾਲ ਹੀ ਰੌਣਕ ਹੈ!</p><p>– ${o.host}</p>`,
      religious: (o) => `<p>ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ</p><p>ਪ੍ਰਭੂ ਦੀ ਕਿਰਪਾ ਨਾਲ <b>${o.host}</b> ਤੁਹਾਨੂੰ ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} ਵਿੱਚ ਪਧਾਰ ਕੇ ਅਸ਼ੀਰਵਾਦ ਅਤੇ ਪ੍ਰਸ਼ਾਦ ਪ੍ਰਾਪਤ ਕਰਨ ਲਈ ਸੱਦਾ ਦਿੰਦੇ ਹਨ।</p>`,
      corporate: (o) => `<p>ਸਤਿਕਾਰਯੋਗ ਸਾਥੀ,</p><p><b>${o.host}</b> ਤੁਹਾਨੂੰ ${o.occasion}${o.title ? ` – <b>${o.title}</b>` : ''} ਵਿੱਚ ਸੱਦਾ ਦਿੰਦੇ ਹੋਏ ਖ਼ੁਸ਼ੀ ਮਹਿਸੂਸ ਕਰਦਾ ਹੈ।</p><p>ਕਿਰਪਾ ਕਰਕੇ ਹੇਠਾਂ ਆਪਣੀ ਹਾਜ਼ਰੀ ਦਰਜ ਕਰੋ।</p>`,
    },
  };
  const generateMessage = ({ category, style, lang, host, title }) => {
    const cat = CATEGORIES.find((c) => c.id === category) || CATEGORIES[CATEGORIES.length - 1];
    const esc = window.IX ? IX.esc : (s) => s;
    const fn = (MSG[lang] || MSG.en)[style] || MSG.en.formal;
    return fn({ host: esc(host || (lang === 'hi' ? 'हम' : lang === 'pa' ? 'ਅਸੀਂ' : 'We')), title: esc(title || ''), occasion: cat.occasion[lang] || cat.occasion.en });
  };

  const SECTIONS = [
    { id: 'opening', name: 'Opening screen' },
    { id: 'welcome', name: 'Welcome message' },
    { id: 'hosts', name: 'Host & family introduction' },
    { id: 'message', name: 'Main invitation message' },
    { id: 'countdown', name: 'Date & countdown timer' },
    { id: 'schedule', name: 'Event schedule' },
    { id: 'venue', name: 'Venue & directions' },
    { id: 'highlights', name: 'Highlights (menu, agenda, speakers…)' },
    { id: 'gallery', name: 'Photo gallery' },
    { id: 'media', name: 'Audio / video message' },
    { id: 'rsvp', name: 'RSVP confirmation' },
    { id: 'instructions', name: 'Special instructions' },
    { id: 'thankyou', name: 'Thank-you closing' },
  ];

  window.IXT = { CATEGORIES, THEMES, FONT_CHOICES, FONT_URL, STYLES, SECTIONS, fontStack, motif: (id, p) => (M[id] || M.minimal)(p), generateMessage, sampleArt };
})();
