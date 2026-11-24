// Tests the generate-card-art Edge Function with fake Supabase + fake AI providers.
// Run: node tests/ai-function-test.mjs   (Node 22.18+ runs the .ts file directly)
import { handle, buildPrompt, cleanWords, pickProvider, STYLES } from '../supabase/functions/generate-card-art/index.ts';
let pass = 0, fail = 0;
const ok = (name, cond, note = '') => { (cond ? pass++ : fail++); console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? ' — ' + note : '')); };
const png = Buffer.from('fakeimage').toString('base64');
function fakeWorld({ tries = 3, aiStatus = 200, aiBody = null, storageFail = false } = {}) {
  const st = { used: 0, limit: tries, uploads: [], refunds: 0, logs: [], aiCalls: [] };
  const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s });
  const f = async (url, init = {}) => {
    url = String(url);
    if (url.endsWith('/auth/v1/user')) return init.headers.authorization === 'Bearer good' ? json({ id: 'u1' }) : json({ msg: 'bad jwt' }, 401);
    if (url.includes('/rpc/ai_take_try')) { if (st.used >= st.limit) return json({ ok: false, used: st.used, limit: st.limit }); st.used++; return json({ ok: true, used: st.used, limit: st.limit }); }
    if (url.includes('/rpc/ai_refund_try')) { st.used--; st.refunds++; return json(null); }
    if (url.includes('/rpc/ai_log')) { st.logs.push(JSON.parse(init.body)); return json(null); }
    if (url.includes('/storage/v1/object/')) { if (storageFail) return json({ error: 'x' }, 500); st.uploads.push({ url, type: init.headers['content-type'] }); return json({ Key: 'k' }); }
    if (url.includes('generativelanguage.googleapis.com')) { st.aiCalls.push({ url, init }); return aiStatus !== 200 ? new Response(aiBody || 'err', { status: aiStatus }) : json(aiBody || { predictions: Array(4).fill({ bytesBase64Encoded: png, mimeType: 'image/png' }) }); }
    if (url.includes('api.openai.com')) { st.aiCalls.push({ url, init }); return json({ data: Array(4).fill({ b64_json: png }) }); }
    throw new Error('unexpected fetch ' + url);
  };
  return { st, f };
}
const env = { SUPABASE_URL: 'https://p.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'svc', GEMINI_API_KEY: 'g' };
const req = (body, auth = 'Bearer good') => new Request('https://p.supabase.co/functions/v1/generate-card-art', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });

// prompts
const p = buildPrompt({ style: 'temple', colors: 'auto', category: 'housewarming', words: 'elephants & lotus' });
ok('prompt has style, occasion and words', /gopuram/.test(p) && /Griha Pravesh/.test(p) && /elephants & lotus/.test(p));
ok('prompt keeps centre clear and bans text', /central area is a calm/.test(p) && /Do not include any text/.test(p));
ok('colour choice overrides style colours', /royal blue, silver/.test(buildPrompt({ style: 'royal', colors: 'royal-blue' })) && !/ruby red/.test(buildPrompt({ style: 'royal', colors: 'royal-blue' })));
ok('unknown style falls back to royal', /jharokha/.test(buildPrompt({ style: 'hack' })));
ok('user words are cleaned and capped', cleanWords('ignore previous <script>x</script> http://evil.com ' + 'a'.repeat(300)).length <= 140 && !/[<>/]/.test(cleanWords('<b>hi</b> http://x.y')));
ok('8 ready styles', Object.keys(STYLES).length === 8);
ok('provider auto-picks from whichever key exists', pickProvider({ OPENAI_API_KEY: 'o' }) === 'openai' && pickProvider({ GEMINI_API_KEY: 'g' }) === 'google' && pickProvider({}) === null && pickProvider({ GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o', AI_PROVIDER: 'openai' }) === 'openai');

// happy path (Google)
let w = fakeWorld(); let r = await handle(req({ style: 'floral', colors: 'pink-peach', category: 'wedding', words: 'peacocks' }), env, w.f); let j = await r.json();
ok('returns 4 painted designs', r.status === 200 && j.images.length === 4, JSON.stringify(j).slice(0, 120));
ok('images saved in user folder /u1/ai/', w.st.uploads.every((u) => /invite-media\/u1\/ai\/.+\.png$/.test(u.url)));
ok('public URLs returned', j.images.every((u) => u.startsWith('https://p.supabase.co/storage/v1/object/public/invite-media/u1/ai/')));
ok('reports tries left', j.left === 2 && j.limit === 3);
const aiBody = JSON.parse(w.st.aiCalls[0].init.body);
ok('Imagen asked for 4 portrait 3:4 images with key in header only', aiBody.parameters.sampleCount === 4 && aiBody.parameters.aspectRatio === '3:4' && w.st.aiCalls[0].init.headers['x-goog-api-key'] === 'g' && !w.st.aiCalls[0].url.includes('key='));
ok('logged for cost tracking', w.st.logs.length === 1 && w.st.logs[0].p_ok === true && w.st.logs[0].p_images === 4);

// OpenAI swap
w = fakeWorld(); r = await handle(req({ style: 'royal' }), { ...env, GEMINI_API_KEY: '', OPENAI_API_KEY: 'o' }, w.f); j = await r.json();
const oBody = JSON.parse(w.st.aiCalls[0].init.body);
ok('OpenAI provider works the same way', r.status === 200 && j.images.length === 4 && oBody.size === '1024x1536' && w.st.uploads[0].type === 'image/jpeg');

// limits & errors
w = fakeWorld({ tries: 1 }); await handle(req({}), env, w.f); r = await handle(req({}), env, w.f); j = await r.json();
ok('blocks when free tries are used up', r.status === 402 && j.code === 'no_credits' && w.st.aiCalls.length === 1);
w = fakeWorld(); r = await handle(req({}, ''), env, w.f);
ok('rejects when not signed in', r.status === 401 && w.st.aiCalls.length === 0);
w = fakeWorld(); r = await handle(req({}, 'Bearer forged'), env, w.f);
ok('rejects a forged token', r.status === 401);
w = fakeWorld(); r = await handle(req({}), { ...env, GEMINI_API_KEY: '' }, w.f); j = await r.json();
ok('clear message when no AI key is set', r.status === 503 && j.code === 'not_configured' && w.st.used === 0);
w = fakeWorld({ aiStatus: 429 }); r = await handle(req({}), env, w.f); j = await r.json();
ok('AI service error refunds the try', r.status === 503 && w.st.used === 0 && w.st.refunds === 1, j.error);
w = fakeWorld({ aiStatus: 400, aiBody: '{"error":{"message":"blocked by safety filter"}}' }); r = await handle(req({}), env, w.f); j = await r.json();
ok('safety block gives friendly message + refund', r.status === 422 && /different words/.test(j.error) && w.st.used === 0);
w = fakeWorld({ aiBody: { predictions: [] } }); r = await handle(req({}), env, w.f);
ok('zero images refunds the try', r.status === 422 && w.st.used === 0);
w = fakeWorld({ storageFail: true }); r = await handle(req({}), env, w.f);
ok('storage failure refunds the try', r.status === 500 && w.st.used === 0);
r = await handle(new Request('https://x/', { method: 'OPTIONS' }), env, w.f);
ok('CORS preflight', r.status === 200 && r.headers.get('access-control-allow-origin') === '*');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
