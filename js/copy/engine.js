/* InviteX Copy engine (window.IXCopy).
 *
 * Writes complete invitation wording – top line, line under the names, welcome,
 * main message and thank-you – for every event type, 12 writing styles, 3 lengths
 * and English / Hindi / Punjabi.
 *
 * It is used in two ways:
 *  1. As the built-in writer. It composes each version from hand-written, natively
 *     worded phrase banks (js/copy/bank-*.js). Every phrase is tagged with the event
 *     groups it suits, its tone and the main idea it carries ("blessings", "home"…),
 *     so a version never says the same thing twice and never borrows wedding
 *     language for a business meeting. Different invitations get different text
 *     because the choice is seeded by the invitation.
 *  2. As the checker for AI-written versions (validateAi): shape, length, script,
 *     placeholders, invented numbers, overused phrases and near-duplicates.
 *
 * Nothing here talks to the network. The AI call lives in js/store.js and
 * supabase/functions/write-invitation-copy. */
(function (root) {
  'use strict';
  const BANKS = (root.IXCopyBanks = root.IXCopyBanks || {});

  /* ------------------------------------------------------------------ */
  /* Styles, lengths, event groups                                       */
  /* ------------------------------------------------------------------ */
  const STYLES = [
    { id: 'elegant', tones: ['refined', 'warm'], label: { en: 'Elegant', hi: 'सुरुचिपूर्ण', pa: 'ਸੁਹਣਾ ਤੇ ਸਲੀਕੇਦਾਰ' }, hint: 'Graceful and polished' },
    { id: 'heartfelt', tones: ['warm'], label: { en: 'Heartfelt', hi: 'भावपूर्ण', pa: 'ਦਿਲੋਂ' }, hint: 'Emotional and sincere' },
    { id: 'royal', tones: ['refined'], label: { en: 'Royal', hi: 'शाही', pa: 'ਸ਼ਾਹੀ' }, hint: 'Grand and luxurious' },
    { id: 'traditional', tones: ['devout', 'warm'], label: { en: 'Traditional', hi: 'पारंपरिक', pa: 'ਰਵਾਇਤੀ' }, hint: 'Cultural and respectful' },
    { id: 'spiritual', tones: ['devout'], label: { en: 'Spiritual', hi: 'आध्यात्मिक', pa: 'ਅਧਿਆਤਮਿਕ' }, hint: 'Devotional and serene' },
    { id: 'modern', tones: ['bright', 'refined'], label: { en: 'Modern', hi: 'आधुनिक', pa: 'ਆਧੁਨਿਕ' }, hint: 'Clean and minimal' },
    { id: 'joyful', tones: ['bright', 'warm'], label: { en: 'Joyful', hi: 'उल्लासपूर्ण', pa: 'ਖ਼ੁਸ਼ੀਆਂ ਭਰਿਆ' }, hint: 'Celebratory and lively' },
    { id: 'friendly', tones: ['warm', 'bright'], label: { en: 'Friendly', hi: 'अपनापन', pa: 'ਅਪਣੱਤ ਭਰਿਆ' }, hint: 'Personal and relaxed' },
    { id: 'playful', tones: ['bright'], label: { en: 'Playful', hi: 'चुलबुला', pa: 'ਹਲਕਾ-ਫੁਲਕਾ' }, hint: 'Humorous and fun' },
    { id: 'formal', tones: ['refined'], label: { en: 'Formal', hi: 'औपचारिक', pa: 'ਰਸਮੀ' }, hint: 'Professional and clear' },
    { id: 'premium', tones: ['refined'], label: { en: 'Exclusive', hi: 'विशिष्ट', pa: 'ਵਿਸ਼ੇਸ਼' }, hint: 'Premium and select' },
    { id: 'family', tones: ['warm'], label: { en: 'Family & warm', hi: 'पारिवारिक', pa: 'ਪਰਿਵਾਰਕ' }, hint: 'Close-knit and loving' },
    { id: 'poetic', tones: ['warm', 'refined'], label: { en: 'Poetic', hi: 'काव्यात्मक', pa: 'ਕਾਵਿਕ' }, hint: 'Lyrical and full of imagery' },
  ];
  const STYLE = Object.fromEntries(STYLES.map((s) => [s.id, s]));
  const LENGTHS = [
    { id: 'short', label: 'Short', hint: 'For WhatsApp' },
    { id: 'standard', label: 'Standard', hint: 'For the card' },
    { id: 'detailed', label: 'Detailed', hint: 'Complete invitation' },
  ];
  // event type → group (decides vocabulary families)
  const GROUP = {
    wedding: 'love', engagement: 'love', anniversary: 'love',
    housewarming: 'home', religious: 'sacred',
    festival: 'gather', community: 'gather',
    birthday: 'party', school: 'party', farewell: 'party', custom: 'party',
    corporate: 'work', conference: 'work', launch: 'work',
  };
  const CATEGORIES = Object.keys(GROUP);
  // styles that do not suit a group are not offered for it
  const HIDE = { work: ['traditional', 'spiritual', 'family', 'poetic'], sacred: ['playful'] };
  // first = default; the rest are shown first in the list
  const RECOMMENDED = {
    wedding: ['traditional', 'heartfelt', 'royal', 'elegant'], engagement: ['heartfelt', 'elegant', 'joyful', 'royal'],
    anniversary: ['heartfelt', 'elegant', 'family', 'joyful'], housewarming: ['family', 'traditional', 'spiritual', 'friendly'],
    religious: ['spiritual', 'traditional', 'family'], festival: ['family', 'joyful', 'traditional'], community: ['friendly', 'joyful', 'formal'],
    birthday: ['joyful', 'friendly', 'playful', 'heartfelt'], school: ['joyful', 'formal', 'friendly'], farewell: ['heartfelt', 'elegant', 'friendly', 'playful'],
    custom: ['elegant', 'joyful', 'friendly'], corporate: ['formal', 'modern', 'premium'], conference: ['formal', 'modern', 'premium'], launch: ['modern', 'premium', 'joyful'],
  };
  // message styles from the earlier editor (inv.tone) → studio style
  const FROM_TONE = { traditional: 'traditional', warm: 'heartfelt', formal: 'formal', royal: 'royal', fun: 'joyful', simple: 'modern', devotional: 'spiritual', friendly: 'friendly' };
  // tones that may stand in for each other when a style's own tone has nothing left
  const NEAR = { warm: ['refined', 'devout'], refined: ['warm'], devout: ['warm'], bright: ['warm'] };
  const FIELDS = ['familyName', 'subtitle', 'welcome', 'message', 'thankyou'];
  const TRADITIONS = ['', 'hindu', 'sikh', 'jain', 'muslim', 'christian'];
  const RELATIONS = ['', 'family', 'friends', 'colleagues', 'community', 'mixed'];

  const groupOf = (cat) => GROUP[cat] || 'party';
  function stylesFor(cat) {
    const g = groupOf(cat), hide = HIDE[g] || [], rec = RECOMMENDED[cat] || [];
    const list = STYLES.filter((s) => !hide.includes(s.id));
    return [...rec.map((id) => STYLE[id]).filter((s) => s && !hide.includes(s.id)), ...list.filter((s) => !rec.includes(s.id))]
      .map((s) => ({ ...s, recommended: rec.includes(s.id) }));
  }
  const defaultStyle = (cat) => (RECOMMENDED[cat] || ['elegant'])[0];
  function styleFromTone(tone, cat) {
    const s = FROM_TONE[tone] || defaultStyle(cat);
    return stylesFor(cat).some((x) => x.id === s) ? s : defaultStyle(cat);
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const clean = (s, max = 120) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>{}\[\]]/g, ' ').replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  function hash(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = hash(String(seed)) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const htmlToText = (h) => String(h || '').replace(/<\/(p|div|h\d|li)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

  // words for similarity checks: lower-case, letters of any script, no punctuation
  const words = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const STOP = new Set('a an the and or of to in on at for with our your you we us is are be will this that it as by from their his her its my me i all very so has have was were who which'.split(' ')
    .concat('का के की को में से पर और है हैं हम आप आपको आपका आपकी अपने उनके यह इस एक भी तो ही ने'.split(' '))
    .concat('ਦਾ ਦੇ ਦੀ ਨੂੰ ਵਿੱਚ ਤੋਂ ਤੇ ਅਤੇ ਹੈ ਹਨ ਅਸੀਂ ਤੁਸੀਂ ਤੁਹਾਨੂੰ ਤੁਹਾਡਾ ਤੁਹਾਡੀ ਤੁਹਾਡੇ ਆਪਣੇ ਉਹਨਾਂ ਇਹ ਇਸ ਇੱਕ ਵੀ ਹੀ ਨੇ'.split(' ')));
  function shingles(s, n) { const w = words(s); const out = new Set(); for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' ')); return out; }
  /** 0..1 – how alike two texts are (word 3-grams, Jaccard) */
  function similarity(a, b) {
    const A = shingles(a, 3), B = shingles(b, 3);
    if (!A.size || !B.size) return 0;
    let inter = 0; A.forEach((x) => B.has(x) && inter++);
    return inter / (A.size + B.size - inter);
  }
  /** Phrases (3+ words, not only filler) that appear in more than one field. */
  function repeatsAcross(fields, opts = {}) {
    // names, titles and the occasion may appear in several lines: cut them out first,
    // so no run of words spans across them
    const ignore = (opts.ignore || []).map((x) => words(x).join(' ')).filter(Boolean).sort((a, b) => b.length - a.length);
    const seen = new Map(); const hits = new Map();
    Object.entries(fields).forEach(([k, v]) => {
      const text = k === 'message' ? htmlToText(v) : String(v || '');
      let parts = [words(text).join(' ')];
      ignore.forEach((x) => { parts = parts.flatMap((p) => (' ' + p + ' ').split(' ' + x + ' ')); });
      parts.map((p) => p.trim().split(' ').filter(Boolean)).forEach((w) => {
        // 3-word runs with two content words, and 4-word runs ("blessings of our elders")
        for (const n of [3, 4]) for (let i = 0; i + n <= w.length; i++) {
          const g = w.slice(i, i + n);
          if (g.filter((x) => !STOP.has(x)).length < 2) continue;
          const key = g.join(' ');
          if (!seen.has(key)) seen.set(key, k);
          else if (seen.get(key) !== k) hits.set(key, [seen.get(key), k]);
        }
      });
    });
    return [...hits.entries()].map(([phrase, f]) => ({ phrase, fields: f }));
  }
  const normSentence = (s) => words(s).join(' ');

  /* Words that make invitations sound generic when used more than once on a card.
   * Each may appear at most once per version (in any form); the built-in writer avoids
   * a second use, and the AI is told the same. */
  const CAPPED = {
    en: [['special', /\bspecial(ly)?\b/gi], ['beautiful', /\bbeautiful(ly)?\b/gi], ['joy', /\bjoy(s|ful|fully|ous)?\b/gi], ['presence', /\bpresence\b/gi], ['celebration', /\bcelebrat(e|es|ed|ing|ion|ions)\b/gi]],
    hi: [['ख़ास', /ख़ास|खास|विशेष/g], ['सुंदर', /सुंदर|सुन्दर/g], ['ख़ुशी', /ख़ुशी|खुशी|ख़ुशियों|खुशियों|हर्ष/g], ['उपस्थिति', /उपस्थिति/g], ['उत्सव', /उत्सव/g]],
    pa: [['ਖ਼ਾਸ', /ਖ਼ਾਸ|ਖਾਸ|ਵਿਸ਼ੇਸ਼/g], ['ਸੁੰਦਰ', /ਸੁੰਦਰ|ਸੋਹਣ/g], ['ਖ਼ੁਸ਼ੀ', /ਖ਼ੁਸ਼ੀ|ਖੁਸ਼ੀ|ਖ਼ੁਸ਼ੀਆਂ|ਖੁਸ਼ੀਆਂ/g], ['ਹਾਜ਼ਰੀ', /ਹਾਜ਼ਰੀ/g], ['ਜਸ਼ਨ', /ਜਸ਼ਨ/g]],
  };
  /** Capped words in a text: { word: count } */
  function capCount(text, lang) {
    const out = {};
    (CAPPED[lang] || CAPPED.en).forEach(([w, re]) => { const n = (String(text || '').match(re) || []).length; if (n) out[w] = n; });
    return out;
  }
  /** Capped words used more than once across all lines of a version (names, title and occasion words not counted). */
  function capRepeats(fields, lang, ignore = []) {
    let all = FIELDS.map((k) => (k === 'message' ? htmlToText(fields[k]) : fields[k] || '')).join('\n');
    ignore.filter(Boolean).forEach((x) => { all = all.split(x).join(' '); });
    const c = capCount(all, lang);
    return Object.keys(c).filter((w) => c[w] > 1).map((w) => ({ word: w, count: c[w] }));
  }

  /* ------------------------------------------------------------------ */
  /* Facts: only what the host actually entered                          */
  /* ------------------------------------------------------------------ */
  /** Build the writing facts from an invitation + studio inputs. Nothing is invented. */
  function factsFrom(inv, lang, extra = {}) {
    const txt = (k) => { const t = inv.text || {}; return (t[lang] && t[lang][k]) || (t[inv.defaultLang] && t[inv.defaultLang][k]) || (t.en && t.en[k]) || ''; };
    const g = groupOf(inv.category);
    const title = clean(txt('title'), 90);
    // the names on a wedding / engagement / anniversary card are the couple
    const titleIsNames = g === 'love' && title && !/\d|!|\?/.test(title);
    const events = (inv.events || []).filter((e) => e && (e.name || e.date)).slice(0, 8).map((e) => ({
      name: clean(e.name, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') ? e.date : '',
      time: e.date && /^\d{2}:\d{2}$/.test(e.start || '') ? e.start : '', venue: clean(e.venue, 70), city: clean(e.city, 40),
    }));
    const main = events.find((e) => e && inv.mainEventId && (inv.events || []).some((x) => x.id === inv.mainEventId && clean(x.name, 60) === e.name)) || events[0] || null;
    return {
      category: inv.category || 'custom', group: g,
      names: clean(extra.names != null ? extra.names : titleIsNames ? title : '', 90),
      title: g === 'love' ? '' : title,
      host: clean(extra.host != null ? extra.host : txt('hostName'), 80),
      relation: RELATIONS.includes(extra.relation) ? extra.relation : '',
      tradition: TRADITIONS.includes(extra.tradition) ? extra.tradition : '',
      note: clean(extra.note, 220),
      key: clean(extra.key, 160),
      events, main,
      hasInstructions: !!String(txt('instructions') || '').trim(),
    };
  }
  /** The facts as one string – used to check that AI text does not invent numbers. */
  function factsText(f) {
    return [f.names, f.title, f.host, f.note, f.key, ...(f.events || []).flatMap((e) => [e.name, e.date, e.time, e.venue, e.city, e.date && +e.date.slice(8, 10), e.date && +e.date.slice(5, 7), e.time && +e.time.slice(0, 2), e.time && (+e.time.slice(0, 2) % 12 || 12)])].join(' ');
  }

  /* ------------------------------------------------------------------ */
  /* Phrase picking                                                      */
  /* ------------------------------------------------------------------ */
  // An entry is "text" or ["text", "tags"]. Tags: @group (where it may be used; style
  // phrases default to every non-business group), ~tone, #idea, !tradition.
  function parse(entry, id) {
    const [text, tags = ''] = Array.isArray(entry) ? entry : [entry, ''];
    const t = tags.split(/\s+/).filter(Boolean);
    return {
      id, text,
      groups: t.filter((x) => x[0] === '@').map((x) => x.slice(1)),
      tones: t.filter((x) => x[0] === '~').map((x) => x.slice(1)),
      ideas: t.filter((x) => x[0] === '#').map((x) => x.slice(1)),
      trad: t.filter((x) => x[0] === '!').map((x) => x.slice(1)),
      tokens: (text.match(/\{(\w+)\}/g) || []).map((x) => x.slice(1, -1)),
    };
  }
  const cache = new Map();
  function pool(lang, path) {
    const key = lang + ':' + path;
    if (cache.has(key)) return cache.get(key);
    const B = BANKS[lang];
    const raw = path.split('.').reduce((a, k) => (a ? a[k] : undefined), B) || [];
    const out = raw.map((e, i) => parse(e, key + ':' + i));
    cache.set(key, out);
    return out;
  }
  function groupOk(e, g, defaultSocial) {
    if (!e.groups.length) return defaultSocial ? g !== 'work' : true;
    return e.groups.some((x) => x === g || x === 'all' || (x === 'social' && g !== 'work'));
  }

  function tokenValue(ctx, tok) {
    const f = ctx.facts, B = ctx.B;
    switch (tok) {
      case 'names': return f.names;
      case 'title': return f.title;
      case 'host': return f.host;
      case 'occ': return (B.occ || {})[f.category] || '';
      case 'god': return f.tradition ? (B.tradition[f.tradition] || {}).god || '' : '';
      case 'city': return f.main ? f.main.city : '';
      case 'event': return f.main ? f.main.name : '';
      default: return '';
    }
  }
  // fill {tokens}; values are escaped in html mode and names are set in bold
  function render(ctx, e, html) {
    return e.text.replace(/\{(\w+)\}/g, (_, tok) => {
      const v = tokenValue(ctx, tok);
      if (!html) return v;
      return ['names', 'host', 'title'].includes(tok) ? `<b>${esc(v)}</b>` : esc(v);
    }).replace(/\s+([,.!?।])/g, '$1');
  }

  /** Pick one phrase from a pool honouring every rule. Returns rendered text or ''. */
  // Pick with fallbacks: the style's own pool, then the same pool without the one-idea rule,
  // then the pools of related styles (sharing a tone) – so a line is never left empty.
  function pick(ctx, path, opt = {}) {
    // short lines: first look for wording that does not echo the other lines anywhere in the chain
    // and for headline-type lines, prefer wording no other version has used, even from a related style
    const echo = ctx.sofar && Object.keys(ctx.sofar).length;
    const passes = [];
    const soft = ctx.rejected.size > 0;
    if (opt.relax) {
      if (echo) passes.push({ strict: true, onlyFresh: true });
      passes.push({ onlyFresh: true });
      // after many rounds: wording turned down earlier beats giving two versions the same line
      if (soft) passes.push({ onlyFresh: true, softReject: true });
    }
    if (echo) passes.push({ strict: true });
    passes.push({});
    if (soft) passes.push({ softReject: true });
    for (const p of passes) {
      const got = pickChain(ctx, path, Object.assign({}, opt, p, p.onlyFresh ? { relax: false } : {}));
      if (got) return got;
    }
    return '';
  }
  function pickChain(ctx, path, opt) {
    const first = pickOne(ctx, path, opt);
    if (first || opt.noFallback) return first;
    const loose = pickOne(Object.assign({}, ctx, { v: { ids: ctx.v.ids, ideas: new Set(), used: ctx.v.used } }), path, Object.assign({}, opt, { relax: false }));
    if (loose) return loose;
    const m = /^style\.(\w+)\.(\w+)$/.exec(path);
    if (!m) return '';
    const mine = (STYLE[m[1]] || {}).tones || [];
    const related = STYLES.filter((s) => s.id !== m[1] && s.tones.some((t) => mine.includes(t)))
      .sort((a, b) => (b.tones[0] === mine[0]) - (a.tones[0] === mine[0]));
    for (const s of related) {
      const got = pickOne(ctx, `style.${s.id}.${m[2]}`, Object.assign({}, opt, { relax: false }));
      if (got) return got;
    }
    return '';
  }
  // party words never appear at a puja or prayer meeting, whatever the style
  const NOT_SACRED = { en: /\b(party|dance|dancing|cake|balloons?|gossip|snack)\b/i, hi: /पार्टी|डांस|नाच|केक|गुब्बारे|गपशप|मस्ती/, pa: /ਪਾਰਟੀ|ਡਾਂਸ|ਨੱਚ|ਕੇਕ|ਗੁਬਾਰੇ|ਗੱਪਾਂ|ਮਸਤੀ|ਭੰਗੜ/ };
  function pickOne(ctx, path, opt = {}) {
    const g = ctx.facts.group;
    const tones = opt.tones || ctx.tones;
    let list = pool(ctx.lang, path).filter((e) =>
      groupOk(e, g, opt.social !== false)
      && !(g === 'sacred' && NOT_SACRED[ctx.lang].test(e.text))
      && (!e.trad.length || e.trad.includes(ctx.facts.tradition))
      && e.tokens.every((t) => tokenValue(ctx, t))
      && !ctx.v.ids.has(e.id)
      && !e.ideas.some((k) => ctx.v.ideas.has(k))
      && !ctx.hard.has(normSentence(render(ctx, e, false)))
      && (opt.softReject || !ctx.rejected.has(normSentence(render(ctx, e, false))))
      && (!opt.max || render(ctx, e, false).length <= opt.max));
    // a short line already used by another version: rather drop the one-idea-per-version rule than repeat it
    if (opt.relax && !list.some((e) => !ctx.batch.has(e.id))) {
      const ideasOff = pickOne(Object.assign({}, ctx, { v: { ids: ctx.v.ids, ideas: new Set(), used: ctx.v.used } }), path, Object.assign({}, opt, { relax: false, onlyFresh: true }));
      if (ideasOff) return ideasOff;
    }
    if (opt.onlyFresh) list = list.filter((e) => !ctx.batch.has(e.id));
    if (!list.length) return '';
    // tone: prefer the style's first tone, then its second, then any neutral phrase
    if (list.some((e) => e.tones.length)) {
      // the style's own tones first (all of them, so versions can differ), then neighbouring tones, never a clash
      const own = list.filter((e) => !e.tones.length || e.tones.some((t) => tones.includes(t)));
      const near = new Set(tones.flatMap((t) => NEAR[t] || []));
      const next = list.filter((e) => e.tones.some((t) => near.has(t)));
      list = own.length ? own : next;
      if (!list.length) return '';
    }
    // generic words (special, joy, presence…) at most once per version – a preference, below freshness
    const capBefore = new Set(ctx.v.cap || []);
    if (ctx.sofar) Object.entries(ctx.sofar).forEach(([k, v]) => { if (!k.startsWith('__')) Object.keys(capCount(k === 'message' ? htmlToText(v) : v, ctx.lang)).forEach((w) => capBefore.add(w)); });
    const capOk = (e) => { const c = capCount(e.text.replace(/\{\w+\}/g, ' '), ctx.lang); return Object.keys(c).every((w) => !capBefore.has(w) && c[w] < 2); };
    // a short line should not echo a phrase the other lines already use
    if (ctx.sofar && Object.keys(ctx.sofar).length) {
      const ign = ignoreFor(ctx.facts, ctx.lang);
      const clean = list.filter((e) => !repeatsAcross({ ...ctx.sofar, __new: render(ctx, e, false) }, { ignore: ign }).some((r) => r.fields.includes('__new')));
      if (clean.length) list = clean;
      else if (opt.strict) return '';
    }
    // freshness: phrases not used by other versions (or rejected earlier) first
    // then wording the host has not turned down before; after many rounds a pool can run dry,
    // and then repeating an older line beats giving every version the same one
    const rej = (e) => ctx.rejected.has(normSentence(render(ctx, e, false)));
    const t0 = (e) => !rej(e) && !ctx.batch.has(e.id) && !ctx.avoid.has(e.id);
    // short lines: never let the word rule cost freshness (pools are small); long text: prefer it among fresh wording
    const tiers = [(e) => t0(e) && capOk(e)].concat([t0, (e) => !rej(e) && !ctx.batch.has(e.id), (e) => !ctx.batch.has(e.id) && !ctx.avoid.has(e.id), (e) => !ctx.batch.has(e.id), (e) => !rej(e)]);
    let best = list;
    for (const t of tiers) { const x = list.filter(t); if (x.length) { best = x; break; } }
    const choice = shuffle(best, ctx.rng)[0];
    Object.keys(capCount(choice.text.replace(/\{\w+\}/g, ' '), ctx.lang)).forEach((w) => (ctx.v.cap || (ctx.v.cap = new Set())).add(w));
    ctx.v.ids.add(choice.id); ctx.batch.add(choice.id);
    choice.ideas.forEach((k) => ctx.v.ideas.add(k));
    ctx.v.used.push(choice.id);
    return render(ctx, choice, !!opt.html);
  }

  /* ------------------------------------------------------------------ */
  /* Composing one version                                               */
  /* ------------------------------------------------------------------ */
  // Each version follows a different line of thought, so versions differ in structure, not just words.
  const APPROACHES = ['heart', 'invite', 'story', 'gratitude', 'moment'];
  const PLAN = {
    // slots per paragraph; '?' = optional (dropped for standard length)
    heart: [['open?', 'heart'], ['invite', 'details'], ['relation?', 'note?'], ['close']],
    invite: [['invite', 'heart'], ['details', 'relation?'], ['note?', 'close']],
    story: [['relation?', 'heart'], ['open?', 'invite'], ['details', 'note?'], ['close']],
    gratitude: [['relation?', 'open'], ['heart', 'invite'], ['details', 'note?'], ['close']],
    moment: [['details', 'invite'], ['heart', 'relation?'], ['note?', 'close']],
  };

  function makeCtx(o) {
    const lang = BANKS[o.lang] ? o.lang : 'en';
    const style = STYLE[o.style] || STYLE[defaultStyle(o.facts.category)];
    return {
      lang, B: BANKS[lang], facts: o.facts, styleId: style.id, tones: style.tones,
      length: ['short', 'standard', 'detailed'].includes(o.length) ? o.length : 'standard',
      rng: rng(o.seed), batch: o.batch || new Set(), avoid: new Set(o.avoidIds || []),
      rejected: new Set((o.rejected || []).map(normSentence)),
      hard: new Set((o.hard || []).map(normSentence)),
      v: { ids: new Set(), ideas: new Set(), used: [] },
    };
  }
  const SP = (path, ctx) => `style.${ctx.styleId}.${path}`;

  function sentence(ctx, slot) {
    const short = ctx.length === 'short';
    const max = short ? 130 : 0;
    switch (slot) {
      case 'open': return pick(ctx, SP('open', ctx), { html: true, max });
      case 'heart': return pick(ctx, `cat.${ctx.facts.category}.heart`, { html: true, social: false, max });
      case 'invite': return pick(ctx, SP('invite', ctx), { html: true, max });
      case 'close': return pick(ctx, SP('close', ctx), { html: true, max });
      case 'relation': return ctx.facts.relation ? pick(ctx, `relation.${ctx.facts.relation}`, { html: true, social: false }) : '';
      case 'note': return ''; // the host's own words are placed by personalLine()
      case 'details': {
        if (!ctx.B.details) return '';
        // each version words the date and place differently where it can
        const free = [0, 1, 2].filter((n) => !ctx.batch.has('details#' + n));
        const n = free.length ? free[Math.floor(ctx.rng() * free.length)] : Math.floor(ctx.rng() * 3);
        ctx.batch.add('details#' + n); ctx.v.used.push('details#' + n);
        return esc(ctx.B.details(ctx.facts, ctx.length === 'detailed' ? 'full' : 'brief', n));
      }
      default: return '';
    }
  }

  const endStop = (t, lang) => String(t).replace(/([^.!?।…”"'])\s*$/, '$1' + (lang === 'en' ? '.' : '।'));
  /** The host's own memory and key message, word for word (standard and detailed). */
  function personalLine(ctx) {
    if (ctx.length === 'short') return '';
    const f = ctx.facts;
    return [f.note, f.key].filter(Boolean).map((t) => endStop(esc(t), ctx.lang)).join(' ');
  }
  function composeMessage(ctx, approach) {
    const plan = PLAN[approach] || PLAN.heart;
    if (ctx.length === 'short') {
      // WhatsApp: one short paragraph, 2–3 sentences
      const order = approach === 'moment' ? ['details', 'invite'] : approach === 'heart' || approach === 'story' ? ['heart', 'invite', 'details'] : ['invite', 'details'];
      const s = order.map((x) => sentence(ctx, x)).filter(Boolean);
      if (ctx.facts.key && ctx.facts.key.length <= 140) s.push(endStop(esc(ctx.facts.key), ctx.lang));
      return s.length ? `<p>${s.join(' ')}</p>` : '';
    }
    const own = personalLine(ctx);
    const paras = plan.map((p) => p.map((slot) => {
      const opt = slot.endsWith('?');
      const name = slot.replace('?', '');
      if (opt && ctx.length !== 'detailed' && name !== 'open') return '';
      if (opt && name === 'open' && ctx.length !== 'detailed' && ctx.rng() < 0.5) return '';
      return sentence(ctx, name);
    }).filter(Boolean).join(' ')).filter(Boolean);
    if (own) paras.splice(Math.max(1, paras.length - 1), 0, own);
    if (ctx.length === 'detailed' && ctx.facts.hasInstructions) {
      const tip = pick(ctx, 'practical', { html: true, social: false });
      if (tip) paras.splice(paras.length - 1, 0, tip);
    }
    return paras.map((p) => `<p>${p}</p>`).join('');
  }

  function composeField(ctx, field, approach) {
    const f = ctx.facts, short = ctx.length === 'short';
    switch (field) {
      case 'familyName': {
        const tr = f.tradition && ctx.B.tradition[f.tradition];
        const invoked = [...ctx.batch].filter((x) => x === 'invoke' || x.startsWith('invoke#')).length;
        if (tr && tr.invoke && ['traditional', 'spiritual'].includes(ctx.styleId) && ['love', 'home', 'sacred', 'gather'].includes(f.group) && invoked < 2 && ctx.rng() < 0.6) {
          ctx.batch.add('invoke#' + invoked); ctx.v.used.push('invoke#' + invoked); ctx.v.ideas.add('divine'); return tr.invoke;
        }
        return pick(ctx, SP('top', ctx), { max: 60, relax: true });
      }
      case 'subtitle': return pick(ctx, SP('sub', ctx), { max: 110, relax: true });
      case 'welcome': return pick(ctx, `cat.${f.category}.welcome`, { social: false, max: short ? 120 : 260, relax: true });
      case 'thankyou': {
        const fromCat = ctx.rng() < 0.5;
        return (fromCat ? pick(ctx, `cat.${f.category}.thanks`, { social: false, max: short ? 110 : 0, relax: true }) : '')
          || pick(ctx, SP('thanks', ctx), { max: short ? 110 : 0, relax: true })
          || pick(ctx, `cat.${f.category}.thanks`, { social: false });
      }
      case 'message': return composeMessage(ctx, approach);
      default: return '';
    }
  }

  function plainOf(fields) { return FIELDS.map((k) => (k === 'message' ? htmlToText(fields[k]) : fields[k] || '')).join('\n'); }
  function masked(text, facts) {
    let t = text;
    [facts.names, facts.title, facts.host, facts.note, facts.key, facts.main && facts.main.city, facts.main && facts.main.name].filter(Boolean).forEach((v) => { t = t.split(v).join(' '); });
    return t;
  }

  function composeVersion(o, approach, batch, attempt) {
    const ctx = makeCtx({ ...o, seed: `${o.seed}|${approach}|${attempt}`, batch });
    const fields = {}, usedBy = {};
    // order matters: the welcome is written first, the message then avoids its phrases, and the short lines avoid both
    ['welcome', 'message', 'familyName', 'subtitle', 'thankyou'].forEach((k) => {
      const n = ctx.v.used.length;
      ctx.sofar = fields;
      fields[k] = composeField(ctx, k, approach);
      usedBy[k] = ctx.v.used.slice(n);
    });
    return { fields, used: ctx.v.used, usedBy, ctx };
  }

  /**
   * Generate 3–5 complete, distinct versions.
   * o = { facts, lang, style, length, count, seed, avoidIds, rejected }
   */
  function generate(o) {
    const count = Math.max(1, Math.min(5, o.count || 4));
    const facts = o.facts;
    const batch = new Set();
    const versions = [];
    const order = shuffle(APPROACHES, rng(o.seed + '|order'));
    for (let i = 0; i < count; i++) {
      const approach = order[i % order.length];
      let best = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const snapshot = new Set(batch);
        const v = composeVersion(o, approach, batch, attempt);
        const text = masked(plainOf(v.fields), facts);
        const sim = Math.max(0, ...versions.map((x) => similarity(text, masked(plainOf(x.fields), facts))));
        const reps = repeatsAcross(v.fields, { ignore: ignoreFor(facts, o.lang) }).length;
        const caps = capRepeats(v.fields, o.lang, ignoreFor(facts, o.lang)).length;
        const dup = ['familyName', 'subtitle', 'welcome', 'thankyou'].filter((k) => v.fields[k] && versions.some((x) => x.fields[k] === v.fields[k])).length;
        const score = sim + reps * 0.5 + caps * 0.4 + dup;
        if (!best || score < best.score) best = { ...v, score, sim, reps };
        if (sim < 0.2 && !reps && !dup && !caps) break;
        // undo this attempt's claims on the shared pool before retrying
        batch.clear(); snapshot.forEach((x) => batch.add(x));
      }
      best.used.forEach((x) => batch.add(x));
      versions.push({ id: 'v' + (i + 1), source: 'builtin', approach, style: STYLE[o.style] ? o.style : defaultStyle(facts.category), length: o.length || 'standard', lang: o.lang, fields: best.fields, used: best.used, usedBy: best.usedBy });
    }
    return { source: 'builtin', versions };
  }

  /** New wording for one line of a version, avoiding what the version already says and what was rejected. */
  function regenerateSection(o) {
    const { version, section } = o;
    const others = { ...version.fields }; delete others[section];
    let best = '', bestUsed = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const curText = section === 'message' ? htmlToText(version.fields[section]) : version.fields[section];
      const ctx = makeCtx({ ...o, seed: `${o.seed}|${section}|${attempt}`, avoidIds: [...(o.avoidIds || []), ...(version.used || [])], hard: section === 'message' ? [] : [curText] });
      // ideas already present in the other lines stay off-limits
      Object.entries(version.usedBy || {}).forEach(([k, ids]) => { if (k !== section) ids.forEach((id) => { const e = findEntry(id); if (e) e.ideas.forEach((x) => ctx.v.ideas.add(x)); }); });
      const n = ctx.v.used.length;
      ctx.sofar = others;
      const text = composeField(ctx, section, o.approach || version.approach || 'heart');
      const cur = section === 'message' ? htmlToText(version.fields[section]) : version.fields[section];
      if (!text) continue;
      const plain = section === 'message' ? htmlToText(text) : text;
      if (normSentence(plain) === normSentence(cur)) continue;
      const reps = repeatsAcross({ ...others, [section]: text }, { ignore: ignoreFor(o.facts, o.lang) }).concat(capRepeats({ ...others, [section]: text }, o.lang, ignoreFor(o.facts, o.lang)));
      best = text;
      bestUsed = ctx.v.used.slice(n);
      if (!reps.length) return { text, used: bestUsed };
    }
    return best ? { text: best, used: bestUsed } : null;
  }
  /* ------------------------------------------------------------------ */
  /* One-tap changes to a single line                                     */
  /* ------------------------------------------------------------------ */
  const TWEAKS = {
    shorter: { label: 'Shorter' }, longer: { label: 'Longer' }, emotional: { label: 'More emotional', style: 'heartfelt' },
    formal: { label: 'More formal', style: 'formal' }, personal: { label: 'More personal' }, proofread: { label: 'Proofread' },
  };
  const plainLen = (section, t) => (section === 'message' ? htmlToText(t) : String(t || '')).replace(/\s+/g, ' ').trim().length;
  /**
   * Rewrite one line of a version in a direction. o = regenerateSection's options + { mode }.
   * Returns { text, used, note? } or { text: '', note } when nothing better is possible.
   * Only the host's facts are used; nothing is invented.
   */
  function tweakSection(o) {
    const { version, section, mode } = o;
    const cur = version.fields[section] || '';
    if (mode === 'proofread') {
      const r = proofread(cur, o.lang, section === 'message');
      return r.changes ? { text: r.text, used: [], note: `Fixed ${r.changes} small ${r.changes === 1 ? 'thing' : 'things'} (spacing, punctuation or capitals).` } : { text: '', note: 'This line already reads cleanly. Nothing to fix.' };
    }
    const f = o.facts;
    if (mode === 'personal' && !(f.names || f.host || f.note || f.key || f.relation)) return { text: '', note: 'Add a few personal touches (names, a memory or one key message) first, then try again.' };
    const t = TWEAKS[mode] || {};
    const style = t.style && stylesFor(f.category).some((x) => x.id === t.style) ? t.style : o.style;
    if (t.style && style === o.style && o.style === t.style) { /* already in that style: still give fresh wording */ }
    let length = o.length;
    if (section === 'message' && mode === 'shorter') length = o.length === 'detailed' ? 'standard' : 'short';
    if (section === 'message' && (mode === 'longer' || mode === 'personal')) length = o.length === 'short' ? 'standard' : 'detailed';
    const curLen = plainLen(section, cur);
    const personalScore = (txt) => { const p = section === 'message' ? htmlToText(txt) : txt; return [f.names, f.host, f.note, f.key].filter((x) => x && p.includes(x)).length; };
    const cands = [];
    const draw = (len, tag) => {
      for (let i = 0; i < 6; i++) {
        const r = regenerateSection({ ...o, style, length: len, seed: `${o.seed}|${mode}|${tag}${i}`, avoidIds: [...(o.avoidIds || []), ...cands.flatMap((c) => c.used)] });
        if (!r) continue;
        if (cands.some((c) => normSentence(plainOf2(section, c.text)) === normSentence(plainOf2(section, r.text)))) continue;
        cands.push(r);
      }
    };
    draw(length, '');
    // "Shorter" should really be shorter: if nothing at this length is, try the short length too
    if (mode === 'shorter' && section === 'message' && length !== 'short' && !cands.some((c) => plainLen(section, c.text) < curLen - 3)) draw('short', 's');
    let pickd = null;
    if (mode === 'shorter') pickd = cands.filter((c) => plainLen(section, c.text) < curLen - 3).sort((a, b) => plainLen(section, a.text) - plainLen(section, b.text))[0];
    else if (mode === 'longer') pickd = cands.filter((c) => plainLen(section, c.text) > curLen + 3).sort((a, b) => plainLen(section, b.text) - plainLen(section, a.text))[0];
    else if (mode === 'personal') pickd = cands.filter((c) => personalScore(c.text) > personalScore(cur)).sort((a, b) => personalScore(b.text) - personalScore(a.text))[0];
    else {
      // the wording whose phrases carry the wanted tone (warm for emotional, refined for formal)
      const want = (STYLE[t.style] || {}).tones || [];
      const toneScore = (c) => (c.used || []).map(findEntry).filter(Boolean).reduce((n, e) => n + (e.tones.some((x) => x === want[0]) ? 2 : e.tones.some((x) => want.includes(x)) ? 1 : e.tones.length ? -1 : 0), 0);
      pickd = cands.slice().sort((a, b) => toneScore(b) - toneScore(a))[0];
    }
    if (!pickd) {
      const why = { shorter: 'This line is already as short as this style allows.', longer: 'There is no longer wording for this line in this style. Try the Detailed length, or add your own words.', personal: 'No more personal wording is available for this line. Your names, memory and key message are used in the main message.' };
      return { text: '', note: why[mode] || 'No fresh wording is left for this line in this style.' };
    }
    return pickd;
  }
  const plainOf2 = (section, t) => (section === 'message' ? htmlToText(t) : String(t || ''));

  /** Small, safe corrections only: spacing, punctuation, capitals, doubled words, quotes. Never changes words. */
  function proofread(text, lang, html) {
    let n = 0;
    const fix = (t) => {
      const rules = [
        [/[ \t ]{2,}/g, ' '],
        [/\s+([,.;:!?।])/g, '$1'],
        [/([,;:])(?=[^\s\d"”’)\]])/g, '$1 '],
        [/([.!?])(?=[A-Za-zऀ-੿])/g, '$1 '],
        [/।(?=\S)/g, '। '],
        [/([.!?,।]){2,}/g, (m) => (m.startsWith('.') && m === '...' ? m : m[0])],
        [/\b(\p{L}+)\s+\1\b/giu, '$1'],
      ];
      if (lang === 'en') rules.push([/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()], [/\bi\b(?=[\s,'’])/g, 'I'], [/(\w)'(\w)/g, '$1’$2'], [/(^|\s)"(\S)/g, '$1“$2'], [/(\S)"(?=\s|$|[.,!?])/g, '$1”']);
      if (lang !== 'en') rules.push([/(\S)\s*\.(\s|$)/g, (m, a, b) => (/[ऀ-੿]/.test(a) ? a + '।' + b : m)]);
      let out = t;
      rules.forEach(([re, to]) => { const nx = out.replace(re, to); if (nx !== out) { n += (out.match(re) || []).length; out = nx; } });
      return out.trim();
    };
    if (!html) return { text: fix(String(text || '')), changes: n };
    // keep the markup: fix the text of each paragraph only
    const out = String(text || '').replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/g, (m, a, body, c) => {
      const parts = body.split(/(<[^>]+>)/);
      return a + parts.map((p) => (p.startsWith('<') ? p : fix(p.replace(/^\s+|\s+$/g, (x) => (x ? ' ' : '')))).replace(/^ /, '')).join('') + c;
    });
    return { text: out, changes: n };
  }
  function findEntry(id) {
    const m = /^(\w+):(.+):(\d+)$/.exec(id || ''); if (!m) return null;
    return pool(m[1], m[2])[+m[3]] || null;
  }

  /** Words that may repeat across lines: the names, title, host, occasion, event names and places. */
  function ignoreFor(f, lang) {
    const B = BANKS[lang] || BANKS.en;
    return [f.names, f.title, f.host, (B.occ || {})[f.category], ...(f.events || []).flatMap((e) => [e.name, e.venue, e.city, [e.venue, e.city].filter(Boolean).join(', ')])].filter(Boolean);
  }
  /** Wording for a brand-new invitation or a new language: one standard version, seeded by the invitation. */
  function defaultWording(inv, lang, style, extra = {}) {
    const facts = factsFrom(inv, lang, extra);
    const st = STYLE[style] ? style : defaultStyle(inv.category);
    const r = generate({ facts, lang, style: st, length: 'standard', count: 1, seed: (inv.id || 'x') + '|' + (extra.round || 0) });
    return r.versions[0].fields;
  }

  /* ------------------------------------------------------------------ */
  /* Overused phrases (never written by the built-in writer, sent to the AI as "avoid") */
  /* ------------------------------------------------------------------ */
  const OVERUSED = {
    en: ['request the pleasure of your company', 'your presence is the best gift', 'it would not be a party without you', "it wouldn't be a party without you", 'two hearts, two families', 'the people who mean the most', 'make this day complete', 'with joy in our hearts', 'cordially invite you', 'we look forward to seeing you', 'save the date', 'join us as we celebrate', 'your presence and blessings', 'mean the world to us', 'a day to remember', 'tie the knot', 'without further ado'],
    hi: ['आपकी उपस्थिति प्रार्थनीय है', 'आपके बिना पार्टी अधूरी है', 'दो दिल, दो परिवार', 'सादर आमंत्रित करते हैं', 'आपकी उपस्थिति ही सबसे अच्छा उपहार है', 'यह दिन पूर्ण होगा', 'हृदय में अपार हर्ष'],
    pa: ['ਤੁਹਾਡੇ ਬਿਨਾਂ ਪਾਰਟੀ ਅਧੂਰੀ ਹੈ', 'ਦੋ ਦਿਲ, ਦੋ ਪਰਿਵਾਰ', 'ਤੁਹਾਡੀ ਹਾਜ਼ਰੀ ਹੀ ਸਭ ਤੋਂ ਵਧੀਆ ਤੋਹਫ਼ਾ ਹੈ', 'ਇਹ ਦਿਨ ਪੂਰਾ ਹੋਵੇਗਾ', 'ਨਿੱਘਾ ਸੱਦਾ ਦਿੰਦੇ ਹਨ'],
  };

  /* ------------------------------------------------------------------ */
  /* Checking AI-written versions                                        */
  /* ------------------------------------------------------------------ */
  const LIMITS = { familyName: 90, subtitle: 160, welcome: 360, thankyou: 260, paragraph: 700 };
  const SCRIPT = { hi: /[ऀ-ॿ]/g, pa: /[਀-੿]/g };
  function scriptShare(text, lang) {
    const letters = (text.match(/\p{L}/gu) || []).length;
    if (!letters) return 1;
    if (lang === 'en') return ((text.match(/[A-Za-z]/g) || []).length) / letters;
    return ((text.match(SCRIPT[lang]) || []).length) / letters;
  }
  /**
   * raw = [{ headline, subtitle, welcome, message:[paragraphs], thankyou, approach? }]
   * Returns { versions: [{fields}], dropped: [{index, reason}] }.
   */
  function checkVersion(r, facts, lang, opts = {}) {
    const known = factsText(facts);
    const knownNums = new Set((known.match(/\d+/g) || []).map((n) => String(+n)));
    const overused = (OVERUSED[lang] || []).concat(lang === 'en' ? [] : OVERUSED.en);
    if (!r || typeof r !== 'object') return { reason: 'not an object' };
    const paras = (Array.isArray(r.message) ? r.message : typeof r.message === 'string' ? r.message.split(/\n{2,}/) : []).map((p) => String(p || '').trim()).filter(Boolean);
    const f = { familyName: String(r.headline || r.familyName || '').trim(), subtitle: String(r.subtitle || '').trim(), welcome: String(r.welcome || '').trim(), thankyou: String(r.thankyou || r.closing || '').trim() };
    if (!f.familyName || !f.subtitle || !f.welcome || !f.thankyou || !paras.length) return { reason: 'missing a line' };
    if (paras.length > 6) return { reason: 'message too long' };
    for (const k of ['familyName', 'subtitle', 'welcome', 'thankyou']) if (f[k].length > LIMITS[k]) return { reason: k + ' too long' };
    if (paras.some((p) => p.length > LIMITS.paragraph)) return { reason: 'paragraph too long' };
    const all = [f.familyName, f.subtitle, f.welcome, ...paras, f.thankyou].join('\n');
    if (/[{}\[\]<>]|\b(lorem|ipsum|insert|placeholder|TBD|XX+)\b|https?:|www\./i.test(all)) return { reason: 'placeholder, markup or link' };
    if (/\b(as an ai|i cannot|i'm sorry)\b/i.test(all)) return { reason: 'not invitation text' };
    // the right language and script (names in Latin letters are fine inside Hindi/Punjabi)
    const noNames = masked(all, facts);
    if (scriptShare(noNames, lang) < (lang === 'en' ? 0.9 : 0.6)) return { reason: 'wrong language or script' };
    // numbers must come from the host's details (no invented dates, ages or years)
    const nums = (noNames.match(/[0-9\u0966-\u096F\u0A66-\u0A6F]+/g) || []).map((n) => String(+n.replace(/[\u0966-\u096F]/g, (d) => d.charCodeAt(0) - 0x966).replace(/[\u0A66-\u0A6F]/g, (d) => d.charCodeAt(0) - 0xA66)));
    const invented = nums.filter((n) => !knownNums.has(n));
    if (invented.length) return { reason: 'number not in the details: ' + invented[0] };
    const lower = all.toLowerCase();
    const hit = overused.find((p) => lower.includes(p.toLowerCase()));
    if (hit && opts.strictOverused) return { reason: 'overused phrase: ' + hit };
    return { approach: String(r.approach || '').slice(0, 40), fields: { ...f, message: paras.map((p) => `<p>${boldFacts(esc(p), facts)}</p>`).join('') }, overused: hit || '' };
  }
  /** One version in the AI's shape, made from wording already on screen (used to check a single new line). */
  function toAiShape(fields) {
    return { headline: fields.familyName, subtitle: fields.subtitle, welcome: fields.welcome, thankyou: fields.thankyou, message: htmlToText(fields.message).split(/\n+/).map((x) => x.trim()).filter(Boolean) };
  }
  /** Check one AI-written line in the context of the rest of a version. Returns the line (html for the message) or ''. */
  function checkLine(text, section, version, facts, lang) {
    const shape = toAiShape(version.fields);
    const key = section === 'familyName' ? 'headline' : section;
    shape[key] = section === 'message' ? (Array.isArray(text) ? text : String(text || '').split(/\n{2,}/)) : text;
    const r = checkVersion(shape, facts, lang);
    return r.fields ? r.fields[section] : '';
  }
  /**
   * raw = [{ headline, subtitle, welcome, message:[paragraphs], thankyou, approach? }]
   * Returns { versions: [{fields}], dropped: [{index, reason}] }.
   */
  function validateAi(raw, facts, lang, opts = {}) {
    const out = [], dropped = [];
    (Array.isArray(raw) ? raw : []).forEach((r, i) => {
      const v = checkVersion(r, facts, lang, opts);
      if (v.reason) dropped.push({ index: i, reason: v.reason }); else out.push(v);
    });
    // drop near-duplicates
    const kept = [];
    out.forEach((v, i) => {
      const t = masked(plainOf(v.fields), facts);
      if (kept.some((k) => similarity(t, masked(plainOf(k.fields), facts)) > 0.35)) dropped.push({ index: i, reason: 'too similar to another version' });
      else kept.push(v);
    });
    return { versions: kept, dropped };
  }
  function boldFacts(html, facts) {
    [facts.names, facts.host, facts.title].filter((x) => x && x.length > 2).forEach((v) => {
      const e = esc(v);
      html = html.split(e).join(`<b>${e}</b>`);
    });
    return html.replace(/<b><b>(.*?)<\/b><\/b>/g, '<b>$1</b>');
  }

  root.IXCopy = {
    STYLES, STYLE, LENGTHS, GROUP, CATEGORIES, FIELDS, TRADITIONS, RELATIONS, OVERUSED,
    groupOf, stylesFor, defaultStyle, styleFromTone, factsFrom, factsText,
    generate, regenerateSection, tweakSection, TWEAKS, proofread, defaultWording, validateAi, checkLine,
    similarity, repeatsAcross, capRepeats, capCount, CAPPED, ignoreFor, htmlToText, rng, hash,
  };
})(typeof window !== 'undefined' ? window : globalThis);
