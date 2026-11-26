// Tests the write-invitation-copy Edge Function with fake Supabase + fake AI providers (no network).
// Run: node tests/copy-function-test.mjs   (Node 22.18+ runs the .ts file directly)
import { handle, buildPrompt, cleanRequest, checkAnswer, parseJson, providerOrder, schemaFor, STYLES, OCCASIONS } from '../supabase/functions/write-invitation-copy/index.ts';
let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : '')); };

const VERSION = (n, o = {}) => Object.assign({ approach: 'opens with the couple', headline: 'Shubh Vivah ' + 'I'.repeat(n), subtitle: 'invite you to share the day they marry', welcome: 'We would love you with us as Aarav & Diya begin their life together.', message: ['Aarav & Diya have chosen each other for life.', 'Join us at Leela Palace, Jaipur on 12 December at 7 pm.'], thankyou: 'Thank you for your love and good wishes.' }, o);
const GOOD = { versions: [VERSION(1), VERSION(2), VERSION(3)] };

// a fake world: Supabase auth + count + log, and three AI providers whose answers we choose
function fakeWorld({ used = 0, countFails = false, google = { body: GOOD }, openai = { body: GOOD }, anthropic = { body: GOOD } } = {}) {
  const st = { logs: [], calls: [], bodies: [] };
  const json = (b, s = 200, h = {}) => new Response(JSON.stringify(b), { status: s, headers: h });
  const answer = (name, spec, wrap) => {
    st.calls.push(name);
    if (spec.throws) throw new Error('network down');
    if (spec.status && spec.status !== 200) return new Response('provider error', { status: spec.status });
    const text = spec.raw ?? JSON.stringify(spec.body);
    return json(wrap(text));
  };
  const f = async (url, init = {}) => {
    url = String(url);
    if (init.body && /googleapis|openai|anthropic/.test(url)) st.bodies.push(String(init.body));
    if (url.endsWith('/auth/v1/user')) return init.headers.authorization === 'Bearer good' ? json({ id: 'u1' }) : json({ msg: 'bad jwt' }, 401);
    if (url.includes('/rest/v1/ai_generations')) return countFails ? json({ message: 'relation does not exist' }, 404) : json([], 200, { 'content-range': `0-0/${used}` });
    if (url.includes('/rpc/ai_log')) { st.logs.push(JSON.parse(init.body)); return json(null); }
    if (url.includes('generativelanguage.googleapis.com')) return answer('google', google, (t) => ({ candidates: [{ content: { parts: [{ text: t }] } }] }));
    if (url.includes('api.openai.com')) return answer('openai', openai, (t) => ({ choices: [{ message: { content: t } }] }));
    if (url.includes('api.anthropic.com')) return answer('anthropic', anthropic, (t) => ({ content: [{ type: 'text', text: t }] }));
    throw new Error('unexpected fetch ' + url);
  };
  return { st, f };
}
const ENV = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' };
const FACTS = { names: 'Aarav & Diya', title: 'Aarav & Diya', host: 'The Sharma Family', relation: 'friends', tradition: '', note: '', events: [{ name: 'Wedding', date: '2026-12-12', time: '19:00', venue: 'Leela Palace', city: 'Jaipur' }] };
const BODY = (o = {}) => Object.assign({ category: 'wedding', lang: 'en', style: 'elegant', length: 'standard', count: 3, facts: FACTS }, o);
const req = (body, auth = 'Bearer good', method = 'POST') => new Request('https://p.supabase.co/functions/v1/write-invitation-copy', { method, headers: { authorization: auth, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });

/* request cleaning + prompt */
const dirty = cleanRequest({ ...BODY(), facts: { ...FACTS, phone: '+91 98765 43210', email: 'x@y.com', address: '12 MG Road', guests: ['Ravi'], names: 'Aarav <script>alert(1)</script> & Diya https://evil.example' }, style: 'hack', category: 'nope', lang: 'fr', count: 99, avoid: Array(80).fill('old line') });
ok('unknown style, occasion, language and count are reset to safe values', dirty.style === 'elegant' && dirty.category === 'custom' && dirty.lang === 'en' && dirty.count === 5);
ok('only whitelisted facts survive (no phone, email, address or guest list)', !('phone' in dirty.facts) && !('email' in dirty.facts) && !('address' in dirty.facts) && !('guests' in dirty.facts));
ok('names are cleaned of tags and links', !/[<>]|https?:/.test(dirty.facts.names), dirty.facts.names);
ok('avoid list is capped at 40 lines', dirty.avoid.length === 40);
const p = buildPrompt(cleanRequest(BODY({ lang: 'hi', style: 'royal', avoid: ['We cordially invite you'] })));
ok('prompt names the occasion, style, language and facts', /wedding/i.test(p.system + p.user) && /Aarav & Diya/.test(p.user) && /Hindi/i.test(p.system + p.user) && /royal/i.test(p.system + p.user));
ok('prompt forbids inventing details and religion when none chosen', /invent/i.test(p.system) && /do not use deity names/i.test(p.user));
ok('prompt passes the lines to avoid', /We cordially invite you/.test(p.user));
ok('13 styles and 14 occasions known to the server, matching the app', Object.keys(STYLES).length === 13 && Object.keys(OCCASIONS).length === 14);
ok('schema: full versions, or lines for one section', schemaFor('').required[0] === 'versions' && schemaFor('welcome').required[0] === 'lines' && schemaFor('message').properties.lines.items.type === 'array');
ok('provider order: env setting, only those with keys', providerOrder({ GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' }).join() === 'google,openai' && providerOrder({ OPENAI_API_KEY: 'o', ANTHROPIC_API_KEY: 'a', AI_TEXT_PROVIDERS: 'anthropic,openai' }).join() === 'anthropic,openai' && providerOrder({}).length === 0);
ok('JSON is read even inside a code fence', parseJson('```json\n{"a":1}\n```').a === 1 && parseJson('Sure! {"a":2} hope that helps').a === 2 && parseJson('nope') === null);

/* answer checks */
const R = cleanRequest(BODY());
ok('good answer kept', checkAnswer(GOOD, R).versions.length === 3);
ok('placeholder / link / braces rejected', checkAnswer({ versions: [VERSION(1, { welcome: 'Dear {guest}, welcome' }), VERSION(2, { thankyou: 'See www.example.com' })] }, R).versions.length === 0);
ok('invented numbers rejected (time / year not in the facts)', checkAnswer({ versions: [VERSION(1, { message: ['Join us at 4 pm.'] }), VERSION(2, { message: ['Married since 1998.'] })] }, R).versions.length === 0);
ok('wrong script rejected (English for a Hindi request)', checkAnswer(GOOD, cleanRequest(BODY({ lang: 'hi' }))).versions.length === 0);
ok('Hindi answer in Devanagari accepted', checkAnswer({ versions: [VERSION(1, { headline: 'शुभ विवाह', subtitle: 'आपको सादर आमंत्रित करते हैं', welcome: 'Aarav & Diya के विवाह में आपका स्वागत है।', message: ['हम 12 दिसंबर को Leela Palace, Jaipur में मिलेंगे।'], thankyou: 'आपके स्नेह के लिए धन्यवाद।' })] }, cleanRequest(BODY({ lang: 'hi' }))).versions.length === 1);
ok('empty or overlong parts rejected', checkAnswer({ versions: [VERSION(1, { welcome: '' }), VERSION(2, { headline: 'x'.repeat(120) })] }, R).versions.length === 0);

/* handler */
let w = fakeWorld(); let r = await handle(req(BODY()), ENV, w.f); let j = await r.json();
ok('primary provider writes 3 versions', r.status === 200 && j.versions.length === 3 && j.provider === 'google' && w.st.calls.join() === 'google', JSON.stringify(j).slice(0, 160));
ok('reply says how many writes are left', j.used === 1 && j.limit === 30 && j.left === 29);
ok('usage logged without personal details', w.st.logs.length === 1 && w.st.logs[0].p_ok === true && w.st.logs[0].p_style === 'copy:elegant' && !JSON.stringify(w.st.logs).includes('Aarav') && !JSON.stringify(w.st.logs).includes('Leela'));
ok('provider gets the facts it needs and nothing more', w.st.bodies.length === 1 && w.st.bodies[0].includes('Aarav & Diya') && !/98765|MG Road|x@y\.com/.test(w.st.bodies[0]));

w = fakeWorld(); r = await handle(req({ ...BODY(), facts: { ...FACTS, phone: '+91 98765 43210', address: '12 MG Road', email: 'x@y.com' } }), ENV, w.f);
ok('extra personal fields sent by the browser never reach the AI', r.status === 200 && !/98765|MG Road|x@y\.com/.test(w.st.bodies.join('')));

w = fakeWorld({ google: { status: 500 } }); r = await handle(req(BODY()), ENV, w.f); j = await r.json();
ok('primary fails → secondary answers', r.status === 200 && j.provider === 'openai' && w.st.calls.join() === 'google,openai');
ok('failed attempt logged as failed', w.st.logs.length === 2 && w.st.logs[0].p_ok === false && w.st.logs[1].p_ok === true);

w = fakeWorld({ google: { throws: true } }); r = await handle(req(BODY()), ENV, w.f); j = await r.json();
ok('network error on primary → secondary answers', r.status === 200 && j.provider === 'openai');

w = fakeWorld({ google: { raw: 'Here are some lovely invitations!' } }); r = await handle(req(BODY()), ENV, w.f); j = await r.json();
ok('unreadable JSON → next provider', r.status === 200 && j.provider === 'openai');

w = fakeWorld({ google: { body: { versions: [VERSION(1, { message: ['Join us at 4 pm on 3 March.'] }), VERSION(2, { message: ['Since 1998.'] })] } } }); r = await handle(req(BODY()), ENV, w.f); j = await r.json();
ok('answer with invented details → next provider', r.status === 200 && j.provider === 'openai');

w = fakeWorld({ google: { status: 500 }, openai: { status: 429 } }); r = await handle(req(BODY()), ENV, w.f); j = await r.json();
ok('all providers fail → 503 ai_unavailable (browser then uses the built-in writer)', r.status === 503 && j.code === 'ai_unavailable' && w.st.calls.join() === 'google,openai');

w = fakeWorld({ google: { status: 500 }, openai: { status: 500 }, anthropic: { body: GOOD } }); r = await handle(req(BODY()), { ...ENV, ANTHROPIC_API_KEY: 'a' }, w.f); j = await r.json();
ok('third provider used when two fail', r.status === 200 && j.provider === 'anthropic' && w.st.calls.join() === 'google,openai,anthropic');

w = fakeWorld({ used: 30 }); r = await handle(req(BODY()), ENV, w.f); j = await r.json();
ok('daily limit → 429 limit, no AI call', r.status === 429 && j.code === 'limit' && j.left === 0 && w.st.calls.length === 0);
w = fakeWorld({ used: 4 }); r = await handle(req(BODY()), { ...ENV, AI_TEXT_DAILY_LIMIT: '5' }, w.f); j = await r.json();
ok('daily limit is configurable', r.status === 200 && j.left === 0 && j.limit === 5);

w = fakeWorld({ countFails: true }); r = await handle(req(BODY()), ENV, w.f); j = await r.json();
ok('missing tables → 503 setup, no AI call', r.status === 503 && j.code === 'setup' && w.st.calls.length === 0);

w = fakeWorld(); r = await handle(req(BODY(), ''), ENV, w.f); j = await r.json();
ok('no sign-in → 401 auth', r.status === 401 && j.code === 'auth' && w.st.calls.length === 0);
r = await handle(req(BODY(), 'Bearer bad'), ENV, w.f); j = await r.json();
ok('bad sign-in → 401 auth', r.status === 401 && j.code === 'auth');

w = fakeWorld(); r = await handle(req(BODY()), { SUPABASE_URL: ENV.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'svc' }, w.f); j = await r.json();
ok('no AI key → 503 not_configured', r.status === 503 && j.code === 'not_configured' && w.st.calls.length === 0);

r = await handle(req(null, 'Bearer good', 'OPTIONS'), { ...ENV, ALLOWED_ORIGIN: 'https://invitex.example' }, w.f);
ok('CORS preflight answers with the allowed origin', r.status === 200 && r.headers.get('access-control-allow-origin') === 'https://invitex.example' && /authorization/.test(r.headers.get('access-control-allow-headers')));
r = await handle(req(null, 'Bearer good', 'GET'), ENV, w.f);
ok('GET refused', r.status === 405);

w = fakeWorld({ google: { body: { lines: ['A warm welcome to everyone joining the wedding.', 'We are so glad you can be with us.'] } } });
r = await handle(req(BODY({ section: 'welcome', current: { familyName: 'Shubh Vivah', message: 'Join us.' } })), ENV, w.f); j = await r.json();
ok('one-line mode returns alternative lines', r.status === 200 && j.lines.length === 2 && !j.versions);
ok('one-line mode sends the other lines as context', /Shubh Vivah/.test(w.st.bodies[0]));
w = fakeWorld({ google: { body: { lines: ['Visit https://x.y', 'Dear [name]'] } }, openai: { body: { lines: ['Welcome, and thank you for coming.'] } } });
r = await handle(req(BODY({ section: 'welcome' })), ENV, w.f); j = await r.json();
ok('bad one-line answers → next provider', r.status === 200 && j.provider === 'openai');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
