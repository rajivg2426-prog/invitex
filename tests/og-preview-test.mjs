// Link previews (functions/_middleware.js, Cloudflare Pages Function) with a fake Supabase.
//   node tests/og-preview-test.mjs
import fs from 'node:fs';
import { handle, buildMeta } from '../functions/_middleware.js';

let pass = 0, fail = 0;
const ok = (name, c, note = '') => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : '')); };
const PAGE = fs.readFileSync(new URL('../invite.html', import.meta.url), 'utf8');
const CONFIG = fs.readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const WA = 'WhatsApp/2.24.1.3 A';
const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';

const inv = {
  defaultLang: 'en', text: { en: { title: 'Anita & Rohan', subtitle: 'Wedding Invitation' } },
  events: [{ id: 'e1', date: '2026-12-28', start: '19:00', venue: 'Rambagh Palace', city: 'Jaipur' }], mainEventId: 'e1',
  media: { cover: 'https://x.supabase.co/storage/v1/object/public/invite-media/u/i/cover.webp', background: '' },
  design: { market: { image: 'https://x.supabase.co/storage/v1/object/public/designer-art/d/x/front.png' } },
};
const DB = {
  'anita-rohan': { status: 'ok', invitation: inv },
  'plain': { status: 'ok', invitation: { text: { en: { title: 'Riya turns 5' } }, events: [{ date: '2027-01-09', start: '16:30', venue: 'Home' }], media: {}, design: {} } },
  'secret': { status: 'password_required' },
  'evil': { status: 'ok', invitation: { text: { en: { title: '<script>alert(1)</script>"x' } }, events: [], media: { cover: 'javascript:alert(1)' }, design: {} } },
  'unpaid': { status: 'not_open', title: 'Owner wedding' },
};
const calls = [];
const fake = async (url, init = {}) => {
  url = String(url);
  if (url.endsWith('/js/config.js')) return new Response(CONFIG, { headers: { 'content-type': 'text/javascript' } });
  if (url.includes('/rest/v1/rpc/get_public_invitation')) {
    const b = JSON.parse(init.body); calls.push({ url, headers: init.headers, body: b });
    if (b.p_slug === 'down') return new Response('{}', { status: 503 });
    return new Response(JSON.stringify(DB[b.p_slug] || { status: 'not_found' }), { headers: { 'content-type': 'application/json' } });
  }
  throw new Error('unexpected ' + url);
};
const run = async (path, ua, { status = 200, type = 'text/html; charset=utf-8', env = {} } = {}) => {
  const request = new Request('https://invitex.pages.dev' + path, { headers: { 'user-agent': ua } });
  const next = async () => new Response(status === 200 ? PAGE : '', { status, headers: { 'content-type': type, ...(status === 308 ? { location: '/invite?i=x' } : {}) } });
  const r = await handle({ request, env, next }, fake);
  return { r, html: await r.text() };
};
const tag = (html, prop) => { const m = new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`).exec(html); return m ? m[1] : null; };

let { r, html } = await run('/invite.html?i=Anita-Rohan&g=tok123', WA);
ok('WhatsApp: title is the couple\'s names', tag(html, 'og:title') === 'Anita &amp; Rohan', tag(html, 'og:title'));
ok('WhatsApp: description has occasion, date, time and venue', tag(html, 'og:description') === 'Wedding Invitation · Monday, 28 December 2026, 7 pm · Rambagh Palace, Jaipur. Tap to open and RSVP.', tag(html, 'og:description'));
ok('WhatsApp: picture is the designer card artwork', tag(html, 'og:image') === inv.design.market.image);
ok('og:url keeps the link name but drops the guest\'s personal token', tag(html, 'og:url') === 'https://invitex.pages.dev/invite.html?i=anita-rohan');
ok('the guest token is never sent to the database (a preview is not an open)', calls.length === 1 && !JSON.stringify(calls[0].body).includes('tok123') && Object.keys(calls[0].body).join() === 'p_slug');
ok('Supabase address and publishable key read from js/config.js', /^https:\/\/\w+\.supabase\.co\/rest\/v1\/rpc\/get_public_invitation$/.test(calls[0].url) && /^sb_publishable_/.test(calls[0].headers.apikey));
ok('page <title> replaced, general og tags removed (one og:title)', /<title>Anita &amp; Rohan<\/title>/.test(html) && html.match(/og:title/g).length === 1);
ok('rest of the page untouched', html.includes('<div id="app"') && html.includes('js/invite.js'));
ok('short cache for robots', r.headers.get('cache-control') === 'public, max-age=300');

({ html } = await run('/invite?i=anita-rohan', CHROME));
ok('a guest in a browser gets the page exactly as before', html === PAGE && calls.length === 1);
({ html } = await run('/invite?i=anita-rohan&og=1', CHROME));
ok('?og=1 shows the preview tags in a browser for checking', tag(html, 'og:title') === 'Anita &amp; Rohan');

({ html } = await run('/invite?i=plain', 'facebookexternalhit/1.1'));
ok('no picture of their own: default InviteX picture, full https link', tag(html, 'og:image') === 'https://invitex.pages.dev/img/og-invite.jpg' && tag(html, 'og:image:width') === '1200');
ok('date and time from the event', /Saturday, 9 January 2027, 4:30 pm · Home/.test(tag(html, 'og:description')), tag(html, 'og:description'));
({ html } = await run('/invite?i=secret', 'TelegramBot (like TwitterBot)'));
ok('password-protected: no details shown', tag(html, 'og:title') === 'You&#39;re invited' && /private invitation/.test(tag(html, 'og:description')));
({ html } = await run('/invite?i=unpaid', WA));
ok('not shared yet: title only, no details', tag(html, 'og:title') === 'Owner wedding' && !/Owner wedding ·/.test(tag(html, 'og:description')));
({ html } = await run('/invite?i=nobody-here', WA));
ok('unknown link: general preview', tag(html, 'og:title') === 'You&#39;re invited');
({ html } = await run('/invite?i=evil', WA));
ok('words from the invitation are escaped', !/<script>alert/.test(html) && tag(html, 'og:title') === '&lt;script&gt;alert(1)&lt;/script&gt;&quot;x');
ok('only https pictures are used', tag(html, 'og:image') === 'https://invitex.pages.dev/img/og-invite.jpg');
({ html } = await run('/invite?i=down', WA));
ok('database down: general preview, page still served', tag(html, 'og:title') === 'You&#39;re invited' && html.includes('js/invite.js'));
({ r } = await run('/invite.html?i=anita-rohan', WA, { status: 308, type: 'text/plain' }));
ok('Cloudflare\'s .html redirect passes through untouched', r.status === 308);
const n0 = calls.length;
({ html } = await run('/index.html?i=anita-rohan', WA));
ok('other pages are not touched', html === PAGE && calls.length === n0);
({ html } = await run('/invite?i=anita-rohan', WA, { env: { SUPABASE_URL: 'https://env.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_env' } }));
ok('Cloudflare variables win over js/config.js', calls.at(-1).url.startsWith('https://env.supabase.co/') && calls.at(-1).headers.apikey === 'sb_publishable_env');
ok('buildMeta never throws on junk', !!buildMeta({ status: 'ok', invitation: { events: [{ date: 'nope' }] } }, 'https://a.b/invite?i=x').title);
ok('default picture is small enough for WhatsApp (under 300 KB)', fs.statSync(new URL('../img/og-invite.jpg', import.meta.url)).size < 300 * 1024);
const routes = JSON.parse(fs.readFileSync(new URL('../_routes.json', import.meta.url), 'utf8'));
ok('_routes.json limits the function to invitation pages', routes.version === 1 && routes.include.join() === '/invite,/invite.html');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
