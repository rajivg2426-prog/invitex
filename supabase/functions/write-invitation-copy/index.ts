// InviteX – AI invitation writer (Supabase Edge Function "write-invitation-copy").
//
// The writing studio (js/copy/studio.js) sends the occasion, language, style,
// length and the few facts the writing needs. This function:
//   1. checks the user is signed in,
//   2. checks the user's daily allowance (counted in public.ai_generations, created by supabase/ai-designs.sql),
//   3. builds a carefully tuned prompt for that occasion, style and language,
//   4. asks the primary AI for structured JSON; if it fails or the answer is bad, it asks the next one,
//   5. checks every version (shape, length, script, placeholders, invented numbers) and returns the good ones.
// If every provider fails it answers 503 and the browser uses InviteX's built-in writer instead,
// so creating and publishing an invitation never depends on AI.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets). At least ONE key:
//   GEMINI_API_KEY      Google AI Studio key (the same key as "Design with AI")
//   OPENAI_API_KEY      OpenAI key (optional second provider)
//   ANTHROPIC_API_KEY   Anthropic key (optional second provider)
// Optional:
//   AI_TEXT_PROVIDERS        order to try, e.g. "google,openai" (default: every provider that has a key, Google first)
//   AI_TEXT_MODEL_GOOGLE     default gemini-2.5-flash
//   AI_TEXT_MODEL_OPENAI     default gpt-4.1-mini
//   AI_TEXT_MODEL_ANTHROPIC  default claude-haiku-4-5
//   AI_TEXT_DAILY_LIMIT      AI writes per user per day, default 30
//   ALLOWED_ORIGIN           e.g. https://rajivg2426-prog.github.io
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// No imports, so it can be pasted straight into the dashboard editor.

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

/* ------------------------------------------------------------------ */
/* Writing briefs                                                      */
/* ------------------------------------------------------------------ */

export const OCCASIONS: Record<string, { name: string; brief: string }> = {
  wedding: { name: 'wedding', brief: 'Vocabulary of love, togetherness, two families uniting, family blessings and new beginnings. Warm, ceremonial, joyful. Never businesslike.' },
  engagement: { name: 'engagement / ring ceremony and reception', brief: 'A promise and a first formal step; two families agreeing on a match; rings, smiles, the excitement of what is to come.' },
  anniversary: { name: 'wedding anniversary', brief: 'Shared memories, companionship, steadfastness, gratitude for years together. Do not state a number of years unless it is in the facts.' },
  birthday: { name: 'birthday celebration', brief: 'Celebration of the person, their personality, joy, memorable moments, the year ahead. Playful for children, graceful for milestone birthdays. Never mention an age unless given.' },
  housewarming: { name: 'housewarming (Griha Pravesh)', brief: 'A new home, new beginnings, warmth, family, blessings for the house. Religious rituals only if a tradition is given.' },
  religious: { name: 'religious function / puja / path', brief: 'Devotion, faith, reverence, prayer, gratitude; calm and respectful. Use the specific religious vocabulary ONLY of the tradition given; with no tradition, stay non-denominational (prayer, faith, blessings). No jokes, no party language.' },
  festival: { name: 'festival and family gathering', brief: 'Festive spirit, the family coming home, food shared together, light, tradition, togetherness.' },
  community: { name: 'community gathering', brief: 'Neighbours and members coming together, belonging, a shared cause, inclusive and welcoming.' },
  corporate: { name: 'corporate meeting', brief: 'Purpose, priorities, clarity, collaboration, decisions, professionalism. Concise. No family, blessings, love or party language.' },
  conference: { name: 'business conference', brief: 'Insight, learning, speakers, networking, industry, ideas. Professional and energising. No family or religious language.' },
  launch: { name: 'product launch', brief: 'Innovation, a first look, the journey of building it, customers and partners, excitement. Professional. No family or religious language.' },
  school: { name: 'school or college event', brief: 'Students, achievement, learning, teachers and parents, pride, performances. Wholesome and encouraging.' },
  farewell: { name: 'retirement or farewell', brief: 'Gratitude for years of service, memories, respect, warm goodbyes and a new chapter. Never mournful.' },
  custom: { name: 'special occasion', brief: 'A personal celebration; warm and adaptable. Use the host\'s note to understand what it is, without inventing details.' },
};

export const STYLES: Record<string, string> = {
  elegant: 'Elegant and sophisticated: graceful, polished, understated; fine phrasing, no exclamation marks.',
  heartfelt: 'Emotional and heartfelt: sincere and personal, speaks from the heart, gently moving, never sugary.',
  royal: 'Royal and luxurious: grand, ceremonious, rich imagery of splendour and honour.',
  traditional: 'Traditional and cultural: respectful, customary courtesy forms, elders and family, cultural warmth.',
  spiritual: 'Spiritual and devotional: serene, prayerful, grateful; faith-centred within the given tradition only.',
  modern: 'Modern and minimal: short, clean sentences; confident; no ornament, no clichés.',
  joyful: 'Joyful and celebratory: lively, upbeat, exclamation allowed sparingly, music and festivity.',
  friendly: 'Friendly and personal: relaxed, conversational, like a message from a close friend.',
  playful: 'Humorous and playful: light wit, gentle jokes, never rude, never at anyone\'s expense; still clearly an invitation.',
  formal: 'Formal and professional: clear, courteous, precise; no slang, no emotion overload.',
  premium: 'Exclusive and premium: intimate, select, understated luxury; the guest is one of a chosen few.',
  family: 'Family-oriented and warm: the whole family welcoming the guest\'s whole family; elders and children; homely warmth.',
};

export const LENGTHS: Record<string, string> = {
  short: 'SHORT (for WhatsApp): message = 1 paragraph of 2–3 sentences. Welcome = 1 short sentence. Every line brief.',
  standard: 'STANDARD (for the card): message = 2 short paragraphs (about 50–90 words in total).',
  detailed: 'DETAILED (complete invitation): message = 3–4 paragraphs (about 110–180 words); include the schedule of all events in a natural sentence and the host\'s note if given.',
};

const LANG: Record<string, string> = {
  en: 'Write in natural Indian English.',
  hi: 'Write in natural, native-quality Hindi in Devanagari script, as a skilled Hindi invitation writer would — NOT a translation of English. Use the honorific आप, natural courtesy forms (सादर, सस्नेह, पधारें) only where they fit the style, and correct gender/number agreement. Names and venues may stay as given.',
  pa: 'Write in natural, native-quality Punjabi in Gurmukhi script, as a skilled Punjabi invitation writer would — NOT a translation of English or Hindi. Use respectful ਤੁਸੀਂ/ਤੁਹਾਨੂੰ forms, Punjabi idiom (ਜੀ ਆਇਆਂ ਨੂੰ, ਪਧਾਰੋ) where it fits, and correct agreement. Names and venues may stay as given.',
};

export const OVERUSED = [
  'request the pleasure of your company', 'your presence is the best gift', "it wouldn't be a party without you", 'two hearts, two families',
  'the people who mean the most', 'make this day complete', 'with joy in our hearts', 'cordially invite', 'we look forward to seeing you',
  'save the date', 'join us as we celebrate', 'mean the world to us', 'a day to remember', 'tie the knot',
  'आपकी उपस्थिति प्रार्थनीय है', 'दो दिल, दो परिवार', 'आपके बिना पार्टी अधूरी है', 'ਤੁਹਾਡੇ ਬਿਨਾਂ ਪਾਰਟੀ ਅਧੂਰੀ ਹੈ', 'ਦੋ ਦਿਲ, ਦੋ ਪਰਿਵਾਰ',
];

// One-tap changes to a single line (the browser falls back to its built-in writer
// when an older version of this function does not echo "tweak" back).
export const TWEAKS: Record<string, string> = {
  shorter: 'Make it clearly shorter (fewer words), keeping its meaning.',
  longer: 'Make it a little fuller (one more thought or detail from the facts), never padding.',
  emotional: 'Make it warmer and more heartfelt, without clichés or exaggeration.',
  formal: 'Make it more formal and dignified, as a printed card would be.',
  personal: 'Make it more personal using ONLY the names, hosts, memory or key message in the facts.',
};

// Words that sound generic when repeated. Each at most once per version.
export const CAPPED: Record<string, string> = {
  en: 'special, beautiful, joy (joyful, joyous), presence, celebration (celebrate)',
  hi: 'ख़ास/विशेष, सुंदर, ख़ुशी/हर्ष, उपस्थिति, उत्सव/समारोह',
  pa: 'ਖ਼ਾਸ/ਵਿਸ਼ੇਸ਼, ਸੁੰਦਰ, ਖ਼ੁਸ਼ੀ, ਹਾਜ਼ਰੀ, ਜਸ਼ਨ/ਸਮਾਰੋਹ',
};

const SECTION_NAME: Record<string, string> = { familyName: 'headline', subtitle: 'subtitle', welcome: 'welcome', message: 'message', thankyou: 'thankyou' };

// Keep only plain text from the user (no links, no markup, no prompt tricks), limited length.
export function clean(s: unknown, max = 120): string {
  return String(s ?? '').replace(/https?:\/\/\S+/gi, ' ').replace(/[<>{}\[\]`\\]/g, ' ').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export type Facts = { names: string; title: string; host: string; relation: string; tradition: string; note: string; key: string; events: { name: string; date: string; time: string; venue: string; city: string }[] };

/** Only the fields writing needs; anything else the browser sends is dropped. */
export function cleanRequest(b: any) {
  const f = b?.facts || {};
  const facts: Facts = {
    names: clean(f.names, 90), title: clean(f.title, 90), host: clean(f.host, 80),
    relation: ['family', 'friends', 'colleagues', 'community', 'mixed'].includes(f.relation) ? f.relation : '',
    tradition: ['hindu', 'sikh', 'jain', 'muslim', 'christian'].includes(f.tradition) ? f.tradition : '',
    note: clean(f.note, 220),
    key: clean(f.key, 160),
    events: (Array.isArray(f.events) ? f.events : []).slice(0, 8).map((e: any) => ({
      name: clean(e?.name, 60), date: /^\d{4}-\d{2}-\d{2}$/.test(e?.date || '') ? e.date : '', time: /^\d{2}:\d{2}$/.test(e?.time || '') ? e.time : '',
      venue: clean(e?.venue, 70), city: clean(e?.city, 40),
    })).filter((e: any) => e.name || e.date),
  };
  const section = Object.keys(SECTION_NAME).includes(b?.section) ? b.section : '';
  const current: Record<string, string> = {};
  if (section && b?.current && typeof b.current === 'object') for (const k of Object.keys(SECTION_NAME)) if (k !== section && b.current[k]) current[k] = clean(b.current[k], 900);
  const tweak = section && TWEAKS[b?.tweak] ? String(b.tweak) : '';
  return {
    tweak, currentText: tweak ? clean(b?.currentText, 900) : '',
    category: OCCASIONS[b?.category] ? b.category : 'custom',
    lang: ['en', 'hi', 'pa'].includes(b?.lang) ? b.lang : 'en',
    style: STYLES[b?.style] ? b.style : 'elegant',
    length: LENGTHS[b?.length] ? b.length : 'standard',
    count: Math.max(1, Math.min(5, parseInt(b?.count, 10) || 4)),
    avoid: (Array.isArray(b?.avoid) ? b.avoid : []).slice(-40).map((x: unknown) => clean(x, 200)).filter(Boolean),
    section, current, facts,
  };
}

export function buildPrompt(r: ReturnType<typeof cleanRequest>): { system: string; user: string } {
  const occ = OCCASIONS[r.category];
  const factsLines = [
    r.facts.names && `People being celebrated: ${r.facts.names}`,
    r.facts.title && `Event title: ${r.facts.title}`,
    r.facts.host && `Hosts (who invite): ${r.facts.host}`,
    r.facts.relation && `Guests are mostly: ${r.facts.relation}`,
    r.facts.tradition ? `Religious/cultural tradition: ${r.facts.tradition}` : 'Religious/cultural tradition: none given — do not use deity names, scripture or religion-specific rituals',
    r.facts.note && `A memory or personal detail from the host (use its meaning, do not add to it): ${r.facts.note}`,
    r.facts.key && `The one thing the host wants every guest to know (include its meaning once, in the message): ${r.facts.key}`,
    ...r.facts.events.map((e, i) => `Event ${i + 1}: ${[e.name, e.date && 'date ' + e.date, e.time && 'time ' + e.time, e.venue, e.city].filter(Boolean).join(', ')}`),
  ].filter(Boolean).join('\n');
  const system = [
    'You are a professional Indian invitation copywriter. You write original, natural, emotionally appropriate invitation wording for a digital invitation card.',
    'The card has five text slots, each with a different job, and they must complement each other rather than repeat one thought:',
    '- headline: a very short line ABOVE the names (2–7 words), e.g. an invocation, a blessing or a mood line.',
    '- subtitle: the line directly UNDER the names/title (max ~14 words). For wedding/engagement/anniversary it continues from the couple\'s names as the subject (e.g. "…invite you to celebrate their wedding").',
    '- welcome: 1–2 sentences greeting the guest.',
    '- message: the main invitation text, as an array of paragraphs.',
    '- thankyou: a closing line of thanks at the end of the card.',
    'Hard rules:',
    '1. Use ONLY the facts given. Never invent names, relationships, ages, numbers of years, dates, places, food, dress codes, rituals or personal history. If something is missing, write naturally without it. Do not write placeholders like [Name].',
    '2. Do not write any number that is not in the facts.',
    '3. Match the occasion: ' + occ.brief,
    '4. Each version must take a genuinely different approach (different opening, sentence structure, emotional angle) — not synonyms swapped in the same paragraph.',
    '5. No phrase of 3+ words may appear in two slots of the same version.',
    '6. Avoid these overused phrases: ' + OVERUSED.map((x) => `"${x}"`).join(', ') + '.',
    '7. ' + LANG[r.lang],
    '8. Plain text only: no markdown, no emojis, no hashtags, no links.',
    '9. Use each of these words at most once in a whole version, and only where it is the best word: ' + (CAPPED[r.lang] || CAPPED.en) + '. Each slot must add something new, not restate another slot.',
    'Reply with JSON only.',
  ].join('\n');
  const avoid = r.avoid.length ? `\nThe host rejected or has already seen these sentences. Do not reuse them or close paraphrases:\n${r.avoid.map((x) => '- ' + x).join('\n')}` : '';
  let task: string;
  if (r.section) {
    const cur = Object.entries(r.current).map(([k, v]) => `${SECTION_NAME[k]}: ${v}`).join('\n');
    task = r.tweak
      ? `Rewrite this ${SECTION_NAME[r.section]}: "${r.currentText}". ${TWEAKS[r.tweak]} Give ${r.count} alternatives. They must fit with the other slots below and must not repeat their ideas or phrases.\nOther slots of this version:\n${cur}\nReturn {"lines": [${r.section === 'message' ? 'array of paragraphs per alternative' : 'strings'}]}.`
      : `Write ${r.count} alternative ${SECTION_NAME[r.section]} texts for this version. They must fit with the other slots below and must not repeat their ideas or phrases.\nOther slots of this version:\n${cur}\nReturn {"lines": [${r.section === 'message' ? 'array of paragraphs per alternative' : 'strings'}]}.`;
  } else {
    task = `Write ${r.count} distinct versions. For each, also give "approach": a 2–4 word English label of its angle (e.g. "Opens with memory").`;
  }
  const user = `Occasion: ${occ.name}\nWriting style: ${STYLES[r.style]}\nLength: ${LENGTHS[r.length]}\nFacts:\n${factsLines || '(none given)'}${avoid}\n\n${task}`;
  return { system, user };
}

/* ------------------------------------------------------------------ */
/* JSON shape                                                          */
/* ------------------------------------------------------------------ */

const VERSION_SCHEMA = {
  type: 'object',
  properties: {
    approach: { type: 'string' }, headline: { type: 'string' }, subtitle: { type: 'string' }, welcome: { type: 'string' },
    message: { type: 'array', items: { type: 'string' } }, thankyou: { type: 'string' },
  },
  required: ['approach', 'headline', 'subtitle', 'welcome', 'message', 'thankyou'],
  additionalProperties: false,
};
export function schemaFor(section: string) {
  if (section === 'message') return { type: 'object', properties: { lines: { type: 'array', items: { type: 'array', items: { type: 'string' } } } }, required: ['lines'], additionalProperties: false };
  if (section) return { type: 'object', properties: { lines: { type: 'array', items: { type: 'string' } } }, required: ['lines'], additionalProperties: false };
  return { type: 'object', properties: { versions: { type: 'array', items: VERSION_SCHEMA } }, required: ['versions'], additionalProperties: false };
}
// Gemini's schema dialect has no additionalProperties
const geminiSchema = (s: any): any => {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (!s || typeof s !== 'object') return s;
  const o: any = {};
  for (const [k, v] of Object.entries(s)) if (k !== 'additionalProperties') o[k] = geminiSchema(v);
  return o;
};

export function parseJson(text: string): any {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch { /* try the first {...} block */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* fall through */ } }
  return null;
}

const SCRIPT: Record<string, RegExp> = { en: /[A-Za-z]/g, hi: /[ऀ-ॿ]/g, pa: /[਀-੿]/g };
function scriptOk(text: string, lang: string, facts: Facts): boolean {
  let t = text;
  [facts.names, facts.title, facts.host, ...facts.events.flatMap((e) => [e.name, e.venue, e.city])].filter(Boolean).forEach((v) => { t = t.split(v).join(' '); });
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (!letters) return true;
  return (t.match(SCRIPT[lang]) || []).length / letters >= (lang === 'en' ? 0.9 : 0.6);
}
function numbersOk(text: string, facts: Facts): boolean {
  const known = new Set((JSON.stringify(facts).match(/\d+/g) || []).map((n) => String(+n)));
  facts.events.forEach((e) => { if (e.time) { const h = +e.time.slice(0, 2); known.add(String(h % 12 || 12)); } });
  const nums = (text.match(/[0-9०-९੦-੯]+/g) || []).map((n) => String(+n.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x966)).replace(/[੦-੯]/g, (d) => String(d.charCodeAt(0) - 0xA66))));
  return nums.every((n) => known.has(n));
}
const BAD = /[{}\[\]<>]|\b(lorem|ipsum|placeholder|TBD)\b|https?:|www\./i;

/** Server-side check of the AI answer. Returns the good versions (or lines). */
export function checkAnswer(j: any, r: ReturnType<typeof cleanRequest>): { versions?: any[]; lines?: any[] } {
  const okText = (t: string) => !!t && !BAD.test(t) && scriptOk(t, r.lang, r.facts) && numbersOk(t, r.facts);
  if (r.section) {
    const lines = (Array.isArray(j?.lines) ? j.lines : []).filter((x: any) => {
      const t = Array.isArray(x) ? x.join('\n') : String(x || '');
      return okText(t) && t.length < (r.section === 'message' ? 2500 : 400);
    });
    return { lines };
  }
  const versions = (Array.isArray(j?.versions) ? j.versions : []).filter((v: any) => {
    if (!v || typeof v !== 'object') return false;
    const msg = Array.isArray(v.message) ? v.message.map(String) : [];
    const parts = [v.headline, v.subtitle, v.welcome, v.thankyou].map((x) => String(x || '').trim());
    if (parts.some((p) => !p) || !msg.length || msg.length > 6) return false;
    if (parts[0].length > 90 || parts[1].length > 160 || parts[2].length > 360 || parts[3].length > 260 || msg.some((p: string) => p.length > 700)) return false;
    return okText([...parts, ...msg].join('\n'));
  }).slice(0, r.count);
  return { versions };
}

/* ------------------------------------------------------------------ */
/* Providers (same shape, easy to add another)                         */
/* ------------------------------------------------------------------ */

class ProviderError extends Error { status: number; constructor(m: string, s = 0) { super(m); this.status = s; } }
async function withTimeout(f: Fetch, url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { return await f(url, { ...init, signal: ctl.signal }); } catch (e) { throw new ProviderError((e as Error).name === 'AbortError' ? 'timeout' : 'network'); } finally { clearTimeout(t); }
}
type Call = (p: { system: string; user: string }, schema: any, env: Env, f: Fetch) => Promise<{ text: string; model: string }>;

const google: Call = async (p, schema, env, f) => {
  const model = env.AI_TEXT_MODEL_GOOGLE || 'gemini-2.5-flash';
  const r = await withTimeout(f, `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY || '' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: p.system }] }, contents: [{ role: 'user', parts: [{ text: p.user }] }],
      generationConfig: { temperature: 1, responseMimeType: 'application/json', responseSchema: geminiSchema(schema) } }),
  }, 45000);
  if (!r.ok) throw new ProviderError(`google ${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}`, r.status);
  const j = await r.json();
  return { text: (j.candidates?.[0]?.content?.parts || []).map((x: any) => x.text || '').join(''), model };
};
const openai: Call = async (p, schema, env, f) => {
  const model = env.AI_TEXT_MODEL_OPENAI || 'gpt-4.1-mini';
  const r = await withTimeout(f, 'https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY || ''}` },
    body: JSON.stringify({ model, temperature: 1, messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
      response_format: { type: 'json_schema', json_schema: { name: 'invitation_copy', strict: true, schema } } }),
  }, 45000);
  if (!r.ok) throw new ProviderError(`openai ${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}`, r.status);
  const j = await r.json();
  return { text: j.choices?.[0]?.message?.content || '', model };
};
const anthropic: Call = async (p, schema, env, f) => {
  const model = env.AI_TEXT_MODEL_ANTHROPIC || 'claude-haiku-4-5';
  const r = await withTimeout(f, 'https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 4000, temperature: 1, system: p.system + '\nThe JSON must match this schema: ' + JSON.stringify(schema),
      messages: [{ role: 'user', content: p.user }] }),
  }, 45000);
  if (!r.ok) throw new ProviderError(`anthropic ${r.status} ${(await r.text().catch(() => '')).slice(0, 300)}`, r.status);
  const j = await r.json();
  return { text: (j.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join(''), model };
};
export const PROVIDERS: Record<string, { key: string; call: Call }> = {
  google: { key: 'GEMINI_API_KEY', call: google },
  openai: { key: 'OPENAI_API_KEY', call: openai },
  anthropic: { key: 'ANTHROPIC_API_KEY', call: anthropic },
};
/** Providers to try, in order: AI_TEXT_PROVIDERS if set, otherwise every provider with a key (Google first). */
export function providerOrder(env: Env): string[] {
  const wanted = (env.AI_TEXT_PROVIDERS || 'google,openai,anthropic').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...new Set(wanted)].filter((p) => PROVIDERS[p] && env[PROVIDERS[p].key]);
}

/* ------------------------------------------------------------------ */
/* Request handler                                                     */
/* ------------------------------------------------------------------ */

export async function handle(req: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  const cors = {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const SB = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const admin = { apikey: KEY, authorization: `Bearer ${KEY}` };

  // 1. who is asking?
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Please sign in to use the AI writer.', code: 'auth' });
  const ur = await f(`${SB}/auth/v1/user`, { headers: { apikey: KEY, authorization: `Bearer ${token}` } });
  const user = ur.ok ? await ur.json() : null;
  if (!user?.id) return reply(401, { error: 'Please sign in again to use the AI writer.', code: 'auth' });

  const order = providerOrder(env);
  if (!order.length) return reply(503, { error: 'The AI writer is not switched on yet (no AI key has been added).', code: 'not_configured' });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body → defaults */ }
  const r = cleanRequest(body);

  // 2. daily allowance (successful writes in the last 24 hours)
  const limit = Math.max(0, parseInt(env.AI_TEXT_DAILY_LIMIT || '30', 10) || 30);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const cr = await f(`${SB}/rest/v1/ai_generations?select=id&user_id=eq.${user.id}&ok=is.true&style=like.copy:*&created_at=gte.${encodeURIComponent(since)}`, { headers: { ...admin, prefer: 'count=exact', range: '0-0' } });
  if (!cr.ok) { console.error('count failed', cr.status, await cr.text().catch(() => '')); return reply(503, { error: 'The AI writer is not set up yet (run supabase/ai-designs.sql).', code: 'setup' }); }
  const used = parseInt((cr.headers.get('content-range') || '').split('/')[1] || '0', 10) || 0;
  if (used >= limit) return reply(429, { error: 'You have used today\'s AI writes.', code: 'limit', left: 0, limit });

  // 3–5. write, checking each provider's answer and falling back to the next
  const prompt = buildPrompt(r);
  const schema = schemaFor(r.section);
  const log = (provider: string, ok: boolean) => f(`${SB}/rest/v1/rpc/ai_log`, {
    method: 'POST', headers: { ...admin, 'content-type': 'application/json' },
    // no personal details in the log: only what kind of writing was asked for
    body: JSON.stringify({ p_user: user.id, p_style: `copy:${r.style}`, p_provider: provider, p_images: 0, p_ok: ok, p_prompt: `${r.category}/${r.lang}/${r.length}${r.section ? '/' + r.section : ''}` }),
  }).catch(() => {});
  const failures: string[] = [];
  for (const name of order) {
    try {
      const out = await PROVIDERS[name].call(prompt, schema, env, f);
      const checked = checkAnswer(parseJson(out.text), r);
      const enough = r.section ? (checked.lines || []).length >= 1 : (checked.versions || []).length >= Math.min(2, r.count);
      if (!enough) { failures.push(`${name}: answer failed checks`); await log(`${name}:${out.model}`, false); continue; }
      await log(`${name}:${out.model}`, true);
      return reply(200, { ...checked, ...(r.tweak ? { tweak: r.tweak } : {}), provider: name, model: out.model, used: used + 1, limit, left: Math.max(0, limit - used - 1) });
    } catch (e) {
      failures.push(`${name}: ${(e as Error).message}`);
      console.error('provider failed', name, (e as Error).message);
      await log(name, false);
    }
  }
  console.error('all providers failed', failures);
  return reply(503, { error: 'The AI writer is unavailable right now.', code: 'ai_unavailable' });
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handle(req, D.env.toObject()));
