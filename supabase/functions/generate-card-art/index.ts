// InviteX – "Design with AI" server step (Supabase Edge Function).
//
// The browser sends: a ready style (royal, floral, temple…), a colour choice,
// the event type and a few optional words. This function:
//   1. checks the user is signed in,
//   2. takes one AI try from the user's allowance (public.ai_credits),
//   3. builds a carefully tuned prompt and asks the image AI for 4 paintings,
//   4. saves them in the user's own folder in the invite-media bucket,
//   5. returns their public URLs (and refunds the try if anything failed).
//
// The AI key lives only here, as a Supabase secret. It is never sent to the browser.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets). Set ONE of:
//   GEMINI_API_KEY   Google AI Studio key → Imagen (default, cheaper, ~₹3.5 per image)
//   OPENAI_API_KEY   OpenAI key → gpt-image (~₹5 per image)
// Optional:
//   AI_PROVIDER      'google' or 'openai' (only needed when both keys are set)
//   AI_IMAGE_MODEL   override the model name
//   AI_IMAGES_PER_TRY  1–4, default 4
//   ALLOWED_ORIGIN   e.g. https://rajivg2426-prog.github.io (default: any origin)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// The file has no imports so it can be pasted straight into the dashboard editor.

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

const BUCKET = 'invite-media';

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

export const STYLES: Record<string, { art: string; colors: string }> = {
  royal: {
    art: 'Rajasthani royal palace art: an ornate carved jharokha arch framing the card, white marble and pink sandstone with gold leaf inlay, hanging brass lanterns, strings of marigold and jasmine garlands, a pair of elegant peacocks at the base, intricate Rajput miniature-painting detail',
    colors: 'deep maroon, ruby red and antique gold',
  },
  floral: {
    art: 'delicate hand-painted watercolour on textured cotton paper: loose blooming peonies, garden roses, jasmine and marigolds with soft leaves cascading from the top corners and gathering at the bottom, gentle paint bleeds, a few fine gold ink line accents',
    colors: 'blush pink, peach, sage green and soft gold',
  },
  temple: {
    art: 'South Indian temple art in the Tanjore painting tradition: a carved stone gopuram silhouette at the top, glowing brass diyas, a mango-leaf and marigold toran, banana leaves at the sides, lotus flowers and a kolam pattern along the bottom, raised gold relief details',
    colors: 'temple gold, vermilion red, turmeric yellow and leaf green',
  },
  minimal: {
    art: 'minimal luxury wedding stationery: thick ivory handmade paper with a soft deckled texture, a fine thin gold-foil double border, a small delicate gold mandala ornament at the top and bottom centre, generous clean empty space, subtle embossed paisley in the corners',
    colors: 'ivory, champagne and soft metallic gold',
  },
  mehndi: {
    art: 'festive mehndi celebration art: intricate henna-style paisley, mandala and vine line patterns framing the edges, scattered marigold petals, small mirror-work and tassel details, hanging bells and colourful paper umbrellas at the top',
    colors: 'marigold orange, henna green, fuchsia pink and gold',
  },
  pichwai: {
    art: 'traditional Pichwai painting from Nathdwara: a lotus pond with pink lotuses and lily pads along the bottom, a pair of gentle white cows, kadamba trees and hanging lotus garlands at the top, fine brushwork, flat gold background details',
    colors: 'deep teal, lotus pink, cream and gold',
  },
  birthday: {
    art: "joyful children's storybook watercolour illustration: bunches of balloons, paper bunting and confetti along the top, a few cute friendly animals, gift boxes and a small cake along the bottom corners, stars and sparkles",
    colors: 'bright cheerful pastels: sky blue, sunshine yellow, mint and candy pink',
  },
  corporate: {
    art: 'modern premium event artwork: flowing layered abstract waves and soft geometric shapes sweeping across the top and bottom, subtle light rays and depth, fine thin gold lines, elegant and professional',
    colors: 'deep navy blue, slate and gold',
  },
};

export const COLORS: Record<string, string> = {
  auto: '',
  'maroon-gold': 'deep maroon, crimson and rich gold',
  'pink-peach': 'blush pink, peach and rose gold',
  'emerald-gold': 'emerald green, ivory and gold',
  'royal-blue': 'royal blue, silver and white',
  'ivory-gold': 'ivory, cream and soft gold',
  'saffron-yellow': 'saffron, marigold yellow and red',
  'purple-lavender': 'royal purple, lavender and silver',
  'teal-coral': 'teal, coral and gold',
};

export const OCCASIONS: Record<string, string> = {
  wedding: 'an Indian wedding', engagement: 'an Indian engagement ceremony', birthday: 'a birthday party',
  anniversary: 'a wedding anniversary', housewarming: 'a Griha Pravesh housewarming', religious: 'a Hindu puja',
  festival: 'a family festival celebration', corporate: 'a corporate meeting', conference: 'a business conference',
  launch: 'a product launch', school: 'a school annual function', farewell: 'a retirement farewell',
  community: 'a community gathering', custom: 'a celebration',
};

// Keep only plain words from the user's own text (no prompt tricks, no links), max 140 chars.
export function cleanWords(s: unknown): string {
  return String(s ?? '')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[^\p{L}\p{N}\s,.&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

export function buildPrompt(opts: { style?: string; colors?: string; category?: string; words?: string }): string {
  const st = STYLES[opts.style || ''] || STYLES.royal;
  const colors = COLORS[opts.colors || ''] || st.colors;
  const occasion = OCCASIONS[opts.category || ''] || OCCASIONS.custom;
  const words = cleanWords(opts.words);
  return [
    `A breathtaking hand-painted background artwork for ${occasion} invitation card, tall portrait format.`,
    `Style: ${st.art}.`,
    `Colour palette: ${colors}.`,
    words ? `Include these ideas: ${words}.` : '',
    'Composition: the richest ornament sits along the borders, corners, top and bottom; the large central area is a calm, softly textured open space with very little detail, so names and dates can be printed over it later. Balanced and symmetrical.',
    'Fine-art quality, painterly brush texture, intricate detail, warm soft lighting, looks like a premium printed invitation.',
    'Do not include any text, letters, words, numbers, calligraphy, signatures, watermarks or logos anywhere in the image.',
  ].filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Image providers (easy to swap: add another function with the same shape) */
/* ------------------------------------------------------------------ */

type Img = { bytes: Uint8Array; mime: string };

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function providerError(r: Response, name: string): Promise<Error> {
  const body = await r.text().catch(() => '');
  console.error(`${name} error`, r.status, body.slice(0, 500));
  if (r.status === 400 && /safety|blocked|policy|moderation/i.test(body)) return new UserError('The AI could not paint that idea. Please try different words.', 422);
  if (r.status === 401 || r.status === 403) return new UserError('The AI key is not valid. Please check the key in the Supabase secrets.', 502);
  if (r.status === 429) return new UserError('The AI service is busy or the account has run out of credit. Please try again in a minute.', 503);
  return new UserError('The AI service had a problem. Please try again.', 502);
}

async function googleImagen(prompt: string, n: number, env: Env, f: Fetch): Promise<Img[]> {
  const model = env.AI_IMAGE_MODEL || 'imagen-4.0-generate-001';
  const r = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY || '' },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: n, aspectRatio: '3:4', personGeneration: 'dont_allow' } }),
  });
  if (!r.ok) throw await providerError(r, 'imagen');
  const j = await r.json();
  return (j.predictions || []).filter((p: any) => p.bytesBase64Encoded).map((p: any) => ({ bytes: b64ToBytes(p.bytesBase64Encoded), mime: p.mimeType || 'image/png' }));
}

async function openAiImage(prompt: string, n: number, env: Env, f: Fetch): Promise<Img[]> {
  const r = await f('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY || ''}` },
    body: JSON.stringify({ model: env.AI_IMAGE_MODEL || 'gpt-image-1', prompt, n, size: '1024x1536', quality: 'medium', output_format: 'jpeg', output_compression: 85 }),
  });
  if (!r.ok) throw await providerError(r, 'openai');
  const j = await r.json();
  return (j.data || []).filter((d: any) => d.b64_json).map((d: any) => ({ bytes: b64ToBytes(d.b64_json), mime: 'image/jpeg' }));
}

export function pickProvider(env: Env): 'google' | 'openai' | null {
  const p = (env.AI_PROVIDER || '').toLowerCase();
  if (p === 'openai' && env.OPENAI_API_KEY) return 'openai';
  if (p === 'google' && env.GEMINI_API_KEY) return 'google';
  if (env.GEMINI_API_KEY) return 'google';
  if (env.OPENAI_API_KEY) return 'openai';
  return null;
}

/* ------------------------------------------------------------------ */
/* Request handler                                                     */
/* ------------------------------------------------------------------ */

class UserError extends Error {
  status: number;
  code: string;
  constructor(msg: string, status = 400, code = 'error') { super(msg); this.status = status; this.code = code; }
}

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
  const rpc = async (name: string, args: unknown) => {
    const r = await f(`${SB}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...admin, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error(`rpc ${name} ${r.status} ${await r.text()}`);
    return r.json();
  };

  // 1. who is asking?
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Please sign in to use AI designs.', code: 'auth' });
  const ur = await f(`${SB}/auth/v1/user`, { headers: { apikey: KEY, authorization: `Bearer ${token}` } });
  const user = ur.ok ? await ur.json() : null;
  if (!user?.id) return reply(401, { error: 'Please sign in again to use AI designs.', code: 'auth' });

  const provider = pickProvider(env);
  if (!provider) return reply(503, { error: 'The AI designer is not switched on yet (no AI key has been added).', code: 'not_configured' });

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body → defaults */ }
  const style = STYLES[body.style] ? body.style : 'royal';
  const prompt = buildPrompt({ style, colors: body.colors, category: body.category, words: body.words });
  const n = Math.max(1, Math.min(4, parseInt(env.AI_IMAGES_PER_TRY || '4', 10) || 4));

  // 2. take one try (atomic; refuses when the allowance is used up)
  const take = await rpc('ai_take_try', { p_user: user.id });
  if (!take?.ok) return reply(402, { error: 'You have used all your free AI tries.', code: 'no_credits', used: take?.used, limit: take?.limit });

  try {
    // 3. paint
    const imgs = provider === 'openai' ? await openAiImage(prompt, n, env, f) : await googleImagen(prompt, n, env, f);
    if (!imgs.length) throw new UserError('The AI could not paint that idea. Please try different words.', 422);

    // 4. store in the user's own folder
    const batch = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + crypto.randomUUID().slice(0, 6);
    const urls: string[] = [];
    for (let i = 0; i < imgs.length; i++) {
      const ext = imgs[i].mime === 'image/jpeg' ? 'jpg' : imgs[i].mime === 'image/webp' ? 'webp' : 'png';
      const path = `${user.id}/ai/${batch}-${i + 1}.${ext}`;
      const up = await f(`${SB}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST', headers: { ...admin, 'content-type': imgs[i].mime, 'cache-control': '31536000', 'x-upsert': 'false' }, body: imgs[i].bytes,
      });
      if (!up.ok) throw new Error(`storage ${up.status} ${await up.text()}`);
      urls.push(`${SB}/storage/v1/object/public/${BUCKET}/${path}`);
    }
    await rpc('ai_log', { p_user: user.id, p_style: style, p_provider: provider, p_images: urls.length, p_ok: true, p_prompt: prompt }).catch((e) => console.error(e));
    return reply(200, { images: urls, used: take.used, limit: take.limit, left: Math.max(0, take.limit - take.used) });
  } catch (e) {
    // 5. something failed: give the try back
    await rpc('ai_refund_try', { p_user: user.id }).catch((x) => console.error('refund failed', x));
    await rpc('ai_log', { p_user: user.id, p_style: style, p_provider: provider, p_images: 0, p_ok: false, p_prompt: prompt }).catch(() => {});
    if (e instanceof UserError) return reply(e.status, { error: e.message, code: e.code });
    console.error(e);
    return reply(500, { error: 'Something went wrong while painting. Your try was not used. Please try again.' });
  }
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handle(req, D.env.toObject()));
