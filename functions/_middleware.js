/* InviteX link previews (Cloudflare Pages Function).
 *
 * When an invitation link (invite.html?i=<link name>) is pasted into WhatsApp, Facebook,
 * Telegram, X, Slack or LinkedIn, their preview robot reads the page's <head>. The page itself
 * is the same static file for every invitation, so without this every link showed
 * "You're Invited". For those robots only, this fills in the invitation's own title,
 * date, venue and card picture. Guests in a browser get the page untouched, as before.
 *
 * - Reads the invitation through the same public function guests use (get_public_invitation),
 *   with the publishable key only. It never sends a guest's personal token, so a preview
 *   never counts as that guest opening their invitation.
 * - Password-protected, unpublished, expired or not-yet-shared invitations show a general
 *   preview with no details.
 * - Supabase address and key: the Cloudflare variables SUPABASE_URL and SUPABASE_ANON_KEY when
 *   set, otherwise read from js/config.js, so nothing needs setting up.
 * Runs only for /invite and /invite.html (see _routes.json). Add ?og=1 to a link to see the
 * preview tags in a browser (View source). */

const BOT = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Pinterest|redditbot|Applebot|Googlebot|bingbot|Embedly|Iframely|vkShare|Viber|Snapchat|Line\/|Signal/i;
const DEFAULT_IMAGE = 'img/og-invite.jpg';
const SITE = 'InviteX';

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const httpsUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '');

/* ---------- what the preview says ---------- */
const txt = (inv, key) => {
  const t = inv.text || {}, langs = [inv.defaultLang, 'en', ...Object.keys(t)].filter(Boolean);
  for (const l of langs) if (t[l] && String(t[l][key] || '').trim()) return String(t[l][key]).trim();
  return '';
};
const firstEvent = (inv) => {
  const evs = (inv.events || []).filter((e) => e && e.date);
  return evs.find((e) => e.id === inv.mainEventId) || evs.sort((a, b) => String(a.date + (a.start || '')).localeCompare(String(b.date + (b.start || ''))))[0] || null;
};
const whenLine = (ev) => {
  if (!ev || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) return '';
  const [y, m, d] = ev.date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12));
  let s = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(day);
  if (/^\d{1,2}:\d{2}$/.test(ev.start || '')) {
    const [h, mi] = ev.start.split(':').map(Number);
    s += ', ' + ((h % 12) || 12) + (mi ? ':' + String(mi).padStart(2, '0') : '') + (h < 12 ? ' am' : ' pm');
  }
  return s;
};
const pictureOf = (inv) => {
  const m = inv.design && inv.design.market;
  const media = inv.media || {};
  const calligOnly = inv.calligraphy && inv.calligraphy.active !== false;   // drawn in the browser, no picture to share
  return httpsUrl(m && m.image) || httpsUrl(media.cover) || (calligOnly ? '' : httpsUrl(media.background)) || '';
};

// result: what get_public_invitation returned (or null). pageUrl: the link that was shared.
export function buildMeta(result, pageUrl) {
  const u = new URL(pageUrl);
  const share = new URL(u.origin + u.pathname);
  share.searchParams.set('i', (u.searchParams.get('i') || '').toLowerCase());
  const base = { url: share.href, image: u.origin + '/' + DEFAULT_IMAGE, imageAlt: 'A digital invitation from InviteX', site: SITE };
  const st = result && result.status;
  if (st === 'ok' && result.invitation) {
    const inv = result.invitation, ev = firstEvent(inv);
    const title = clip(txt(inv, 'title'), 90) || "You're invited";
    const sub = clip(txt(inv, 'subtitle') || txt(inv, 'familyName'), 80);
    const place = ev ? clip([ev.venue, ev.city].filter(Boolean).join(', '), 90) : '';
    const desc = [sub, whenLine(ev), place].filter(Boolean).join(' · ') || 'Open your invitation and reply in one tap.';
    const pic = pictureOf(inv);
    return { ...base, title, description: clip(desc + (desc.endsWith('.') ? '' : '.') + ' Tap to open and RSVP.', 200),
      image: pic || base.image, imageAlt: pic ? 'Invitation card: ' + title : base.imageAlt, hasOwnImage: !!pic };
  }
  if (st === 'password_required' || st === 'wrong_password') return { ...base, title: "You're invited", description: 'A private invitation. Open it with the password the host gave you.' };
  if (st === 'expired') return { ...base, title: clip(result.title, 90) || 'Invitation', description: 'This invitation has ended.' };
  if (st === 'not_open') return { ...base, title: clip(result.title, 90) || "You're invited", description: 'Open your invitation and reply in one tap.' };
  return { ...base, title: "You're invited", description: 'Open your digital invitation and RSVP.' };
}

/* ---------- writing the tags into the page ---------- */
export function injectMeta(html, m) {
  const tags = [
    ['property', 'og:type', 'website'], ['property', 'og:site_name', m.site], ['property', 'og:url', m.url],
    ['property', 'og:title', m.title], ['property', 'og:description', m.description],
    ['property', 'og:image', m.image], ['property', 'og:image:alt', m.imageAlt],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', m.title],
    ['name', 'twitter:description', m.description], ['name', 'twitter:image', m.image],
  ];
  if (!m.hasOwnImage) tags.push(['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630']);
  let out = html
    .replace(/<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*/gi, '')        // the page's general tags
    .replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(m.description)}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(m.title)}</title>`);
  const block = tags.map(([k, n, v]) => `<meta ${k}="${n}" content="${esc(v)}">`).join('\n  ');
  out = out.replace(/<\/head>/i, `  ${block}\n</head>`);
  return out;
}

/* ---------- Supabase ---------- */
async function supabaseConfig(env, request, assets) {
  if (env && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) return { url: env.SUPABASE_URL, key: env.SUPABASE_ANON_KEY };
  try {
    const r = await assets(new URL('/js/config.js', request.url).href);
    const js = await r.text();
    const url = (/SUPABASE_URL\s*:\s*['"]([^'"]*)['"]/.exec(js) || [])[1];
    const key = (/SUPABASE_ANON_KEY\s*:\s*['"]([^'"]*)['"]/.exec(js) || [])[1];
    return url && key ? { url, key } : null;
  } catch (e) { return null; }
}
async function lookup(slug, cfg, f) {
  const r = await f(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/get_public_invitation', {
    method: 'POST', headers: { apikey: cfg.key, 'content-type': 'application/json' }, body: JSON.stringify({ p_slug: slug }),
  });
  if (!r.ok) throw new Error('supabase ' + r.status);
  return r.json();
}

/* ---------- the request ---------- */
export async function handle({ request, env, next }, f = fetch) {
  const res = await next();
  const url = new URL(request.url);
  if (request.method !== 'GET' || !/^\/invite(\.html)?$/.test(url.pathname)) return res;
  if (!BOT.test(request.headers.get('user-agent') || '') && url.searchParams.get('og') !== '1') return res;
  if (res.status !== 200 || !/text\/html/i.test(res.headers.get('content-type') || '')) return res;   // e.g. the redirect from .html
  const page = await res.text();
  const headers = new Headers(res.headers);
  headers.delete('content-length'); headers.delete('etag');
  try {
    return new Response(injectMeta(page, buildMeta(await find(url, request, env, f), request.url)), { status: 200, headers: withCache(headers) });
  } catch (e) {
    return new Response(page, { status: 200, headers });   // never break the invitation over a preview
  }
}
const withCache = (h) => { h.set('cache-control', 'public, max-age=300'); h.set('vary', 'User-Agent'); return h; };
async function find(url, request, env, f) {
  const slug = (url.searchParams.get('i') || '').toLowerCase();
  let result = null;
  if (/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug)) {
    const assets = env && env.ASSETS ? (u) => env.ASSETS.fetch(u) : (u) => f(u);
    const cfg = await supabaseConfig(env, request, assets);
    if (cfg) { try { result = await lookup(slug, cfg, f); } catch (e) { result = null; } }
  }
  return result;
}

export const onRequest = (context) => handle(context);
