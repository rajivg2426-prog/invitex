// Tests the InviteX writing engine (js/copy/*.js) with fixed seeds – no network, no AI.
// Run: node tests/copy-engine-test.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = globalThis;
for (const f of ['engine', 'bank-en', 'bank-hi', 'bank-pa']) (0, eval)(fs.readFileSync(path.join(ROOT, 'js/copy', f + '.js'), 'utf8'));
const C = globalThis.IXCopy, B = globalThis.IXCopyBanks;

let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, note = '') => { if (cond) pass++; else { fail++; fails.push(name + (note ? ' — ' + note : '')); console.log('FAIL ' + name + (note ? ' — ' + note : '')); } };
const group = (name, fn) => { const f0 = fail; fn(); console.log((fail === f0 ? 'PASS ' : 'FAIL ') + name); };

const LANGS = ['en', 'hi', 'pa'], LENS = ['short', 'standard', 'detailed'];
const plain = (v) => C.FIELDS.map((k) => (k === 'message' ? C.htmlToText(v.fields[k]) : v.fields[k])).join('\n');
const SCRIPT = { hi: /[ऀ-ॿ]/g, pa: /[਀-੿]/g };
const share = (t, l) => { const L = (t.match(/\p{L}/gu) || []).length; return L ? (t.match(SCRIPT[l]) || []).length / L : 1; };
function inv(category, o = {}) {
  return {
    id: o.id || 'inv_test_' + category, category, defaultLang: 'en', languages: ['en', 'hi', 'pa'],
    text: { en: { title: o.title ?? (C.groupOf(category) === 'love' ? 'Aarav & Diya' : category === 'birthday' ? 'Riya turns 5!' : 'Annual Day 2026'), hostName: o.host ?? 'The Sharma Family', instructions: o.instructions ?? '' } },
    events: o.events ?? [{ id: 'e1', name: 'Main Event', date: '2026-12-12', start: '19:00', venue: 'Leela Palace', city: 'Jaipur' }],
  };
}
const facts = (cat, lang, o = {}, extra = {}) => C.factsFrom(inv(cat, o), lang, extra);

/* 1. every category × every offered style × every language × every length */
const WORK_BAN = { en: /\b(wedding|bride|groom|marriage|blessings?|puja|prayers?|divine|elders|dance floor|almighty)\b/i, hi: /विवाह|आशीर्वाद|पूजा|प्रार्थना|शादी/, pa: /ਵਿਆਹ|ਅਸ਼ੀਰਵਾਦ|ਅਰਦਾਸ|ਅਸੀਸ/ };
const SACRED_BAN = { en: /\b(party|dance|cake|balloons?|gossip|dancing)\b/i, hi: /पार्टी|डांस|केक|गुब्बारे|गपशप/, pa: /ਪਾਰਟੀ|ਡਾਂਸ|ਕੇਕ|ਗੁਬਾਰੇ|ਗੱਪਾਂ/ };
const RELIGION = /Ganesh|गणेश|ਗਣੇਸ਼|Waheguru|वाहेगुरु|ਵਾਹਿਗੁਰੂ|Allah|अल्लाह|ਅੱਲ੍ਹਾ|Granth|ग्रंथ|ਗ੍ਰੰਥ|ੴ|ॐ|ਓਮ|Om Shanti|Namah|nikah|निकाह|ਨਿਕਾਹ|laavan|लावाँ|ਲਾਵਾਂ|Arihant|अरिहंत|aarti|आरती|ਆਰਤੀ|Ardas|अरदास|Sukhmani|सुखमनी|ਸੁਖਮਨੀ|langar|लंगर|ਲੰਗਰ|kul ?devta|कुलदेवता|ਕੁਲ ਦੇਵਤਾ|sacred fire|अग्नि|ਅਗਨੀ|Satnam|सतनाम|ਸਤਿਨਾਮੁ/i;
let combos = 0, versionsChecked = 0, repeatCount = 0, maxSim = 0;
group('every category × style × language × length writes complete, clean, on-topic wording', () => {
  for (const cat of C.CATEGORIES) for (const st of C.stylesFor(cat)) for (const lang of LANGS) for (const len of LENS) {
    combos++;
    const f = facts(cat, lang, {}, { relation: 'friends' });
    const r = C.generate({ facts: f, lang, style: st.id, length: len, count: 3, seed: `t|${cat}|${st.id}|${lang}|${len}` });
    const tag = `${cat}/${st.id}/${lang}/${len}`;
    ok(tag + ' gives 3 versions', r.versions.length === 3);
    r.versions.forEach((v, i) => {
      versionsChecked++;
      ok(`${tag} v${i} every line filled`, C.FIELDS.every((k) => String(v.fields[k] || '').trim()), JSON.stringify(v.fields));
      const t = plain(v);
      ok(`${tag} v${i} no leftovers`, !/\{\w+\}|undefined|null|NaN| ,|\.\.|  /.test(t.replace(/\n+/g, ' ')), t);
      if (lang !== 'en') ok(`${tag} v${i} written in its own script`, share(t.replace(/Aarav & Diya|The Sharma Family|Leela Palace|Jaipur|Main Event|Annual Day 2026/g, ''), lang) > 0.85, String(share(t, lang)));
      if (C.groupOf(cat) === 'work') ok(`${tag} v${i} no wedding/religious words at a business event`, !WORK_BAN[lang].test(t), t);
      if (cat === 'religious') ok(`${tag} v${i} no party words at a puja`, !SACRED_BAN[lang].test(t), t);
      ok(`${tag} v${i} no religion that was not chosen`, !RELIGION.test(t), t);
      const reps = C.repeatsAcross(v.fields, { ignore: C.ignoreFor(f, lang) });
      if (reps.length) repeatCount++;
    });
    for (let a = 0; a < r.versions.length; a++) for (let b = a + 1; b < r.versions.length; b++) maxSim = Math.max(maxSim, C.similarity(plain(r.versions[a]), plain(r.versions[b])));
  }
});
ok(`no line repeats another line's phrase (${repeatCount} of ${versionsChecked} versions)`, repeatCount / versionsChecked < 0.01, `${repeatCount}`);
console.log(`     ${combos} combinations, ${versionsChecked} versions checked; most similar pair of versions: ${maxSim.toFixed(2)}`);
ok('versions in one request are genuinely different (similarity < 0.5)', maxSim < 0.5, maxSim.toFixed(2));

/* 2. personal details */
group('names, hosts and events are used exactly as typed', () => {
  for (const lang of LANGS) {
    const f = facts('wedding', lang, { host: 'Mehta & Kapoor families' });
    const r = C.generate({ facts: f, lang, style: 'heartfelt', length: 'standard', count: 4, seed: 'names|' + lang });
    ok(lang + ': couple names appear', r.versions.some((v) => plain(v).includes('Aarav & Diya')));
    ok(lang + ': hosts appear', r.versions.some((v) => plain(v).includes('Mehta & Kapoor families')));
    ok(lang + ': names are set in bold in the message', r.versions.some((v) => /<b>Aarav &amp; Diya<\/b>|<b>Mehta &amp; Kapoor families<\/b>/.test(v.fields.message)));
  }
  const f = facts('birthday', 'en', {}, { names: 'Riya' });
  const r = C.generate({ facts: f, lang: 'en', style: 'joyful', length: 'standard', count: 4, seed: 'bday' });
  ok('birthday: the person celebrated is used, the title "Riya turns 5!" is not forced into sentences', r.versions.some((v) => plain(v).includes('Riya')) && !r.versions.some((v) => C.htmlToText(v.fields.message).includes('Riya turns 5!')));
});
group('names with special characters are made safe', () => {
  const nasty = `Zoë & O'Brien <script>alert(1)</script>`;
  for (const lang of LANGS) {
    const f = facts('wedding', lang, { title: 'x', host: nasty }, { names: nasty });
    const r = C.generate({ facts: f, lang, style: 'elegant', length: 'detailed', count: 4, seed: 'xss|' + lang });
    r.versions.forEach((v) => {
      ok(lang + ' no raw script tag in the message', !/<script/i.test(v.fields.message));
      ok(lang + ' message markup only p and b', !/<(?!\/?(p|b)>)/.test(v.fields.message), v.fields.message);
    });
    ok(lang + ' the names survive (escaped)', r.versions.some((v) => v.fields.message.includes('Zoë &amp; O&#39;Brien')) || r.versions.some((v) => plain(v).includes('Zoë')));
  }
});
group('missing optional details: writes naturally without inventing', () => {
  for (const cat of C.CATEGORIES) for (const lang of LANGS) {
    const f = facts(cat, lang, { title: '', host: '', events: [] });
    const r = C.generate({ facts: f, lang, style: C.defaultStyle(cat), length: 'detailed', count: 3, seed: 'empty|' + cat });
    r.versions.forEach((v) => {
      const t = plain(v);
      ok(`${cat}/${lang} nothing missing shows`, C.FIELDS.every((k) => v.fields[k]) && !/\{\w+\}|undefined|<b><\/b>| ,|  /.test(t + v.fields.message), t);
      ok(`${cat}/${lang} no invented numbers`, !/\d/.test(t), t);
    });
  }
});
group('multiple events: detailed message lists every event, standard names them', () => {
  const events = [{ name: 'Mehendi', date: '2026-12-10', start: '16:00', venue: 'Rambagh', city: 'Jaipur' }, { name: 'Sangeet', date: '2026-12-11', start: '19:30', venue: 'Rambagh', city: 'Jaipur' }, { name: 'Wedding Ceremony', date: '2026-12-12', start: '19:00', venue: 'City Palace', city: 'Jaipur' }];
  for (const lang of LANGS) {
    const f = facts('wedding', lang, { events });
    const d = C.generate({ facts: f, lang, style: 'royal', length: 'detailed', count: 4, seed: 'ev|' + lang });
    ok(lang + ' detailed: all three events with their dates', d.versions.every((v) => ['Mehendi', 'Sangeet', 'Wedding Ceremony'].every((n) => plain(v).includes(n))) && d.versions.every((v) => /10|11|12/.test(plain(v))));
    const s = C.generate({ facts: f, lang, style: 'royal', length: 'standard', count: 4, seed: 'ev2|' + lang });
    ok(lang + ' standard: events are named', s.versions.every((v) => plain(v).includes('Sangeet') || plain(v).includes('Mehendi')));
  }
});
group('tradition is used only when chosen', () => {
  const sikh = C.generate({ facts: facts('wedding', 'pa', {}, { tradition: 'sikh' }), lang: 'pa', style: 'traditional', length: 'standard', count: 4, seed: 'sikh' });
  ok('Sikh wedding (Punjabi) can mention laavan / Waheguru / ੴ', sikh.versions.some((v) => /ਲਾਵਾਂ|ਵਾਹਿਗੁਰੂ|ੴ/.test(plain(v))));
  ok('Sikh wedding never uses Hindu-only lines', !sikh.versions.some((v) => /ਗਣੇਸ਼|ਸੱਤ ਫੇਰੇ|ਕੁਲ ਦੇਵਤਾ/.test(plain(v))));
  const hindu = C.generate({ facts: facts('housewarming', 'hi', {}, { tradition: 'hindu' }), lang: 'hi', style: 'spiritual', length: 'standard', count: 4, seed: 'hindu' });
  ok('Hindu housewarming (Hindi) can use Hindu wording', hindu.versions.some((v) => /गणेश|ईश्वर|गृह प्रवेश पूजा|ॐ/.test(plain(v))));
  ok('Hindu housewarming never uses Sikh-only lines', !hindu.versions.some((v) => /वाहेगुरु|अरदास|सुखमनी/.test(plain(v))));
});

/* 3. repetition controls */
group('different invitations get different wording; the same seed is repeatable', () => {
  let differ = 0;
  for (let i = 0; i < 10; i++) {
    const a = C.defaultWording(inv('wedding', { id: 'inv_a' + i }), 'en', 'traditional');
    const b = C.defaultWording(inv('wedding', { id: 'inv_b' + i }), 'en', 'traditional');
    if (C.FIELDS.some((k) => a[k] !== b[k])) differ++;
  }
  ok('10 pairs of new weddings: wording differs', differ === 10, String(differ));
  const x = C.generate({ facts: facts('birthday', 'hi'), lang: 'hi', style: 'joyful', length: 'standard', count: 4, seed: 'same' });
  const y = C.generate({ facts: facts('birthday', 'hi'), lang: 'hi', style: 'joyful', length: 'standard', count: 4, seed: 'same' });
  ok('fixed seed gives identical output (deterministic tests)', JSON.stringify(x) === JSON.stringify(y));
});
group('regenerating avoids rejected wording and phrases already shown', () => {
  const f = facts('anniversary', 'en');
  const first = C.generate({ facts: f, lang: 'en', style: 'heartfelt', length: 'standard', count: 3, seed: 'r1' });
  const rejected = first.versions.flatMap((v) => C.htmlToText(v.fields.message).split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter((s) => s.length > 12);
  const seen = first.versions.flatMap((v) => v.used);
  const second = C.generate({ facts: f, lang: 'en', style: 'heartfelt', length: 'standard', count: 3, seed: 'r2', rejected, avoidIds: seen });
  const again = second.versions.flatMap((v) => C.htmlToText(v.fields.message).split(/(?<=[.!?])\s+/)).filter((s) => rejected.includes(s.trim()) && !/Leela|Saturday/.test(s));
  ok('no rejected sentence comes back', again.length === 0, again.join(' | '));
});
group('after many rounds, versions in one request still do not share lines', () => {
  const f = facts('wedding', 'en');
  let rejected = [], seen = [], shared = 0;
  for (let round = 0; round < 8; round++) {
    const r = C.generate({ facts: f, lang: 'en', style: 'royal', length: 'standard', count: 4, seed: 'many|' + round, rejected, avoidIds: seen });
    for (const k of ['familyName', 'subtitle', 'welcome', 'thankyou']) if (new Set(r.versions.map((v) => v.fields[k])).size < r.versions.length) shared++;
    r.versions.forEach((v) => { seen.push(...v.used); rejected.push(...C.FIELDS.flatMap((k) => C.htmlToText(v.fields[k]).split(/(?<=[.!?])\s+/)).filter((x) => x.length > 12)); });
  }
  ok('no short line is shared by two versions of one request, even in round 8', shared === 0, String(shared));
});
group('new wording for one line: different, fits the rest, no repeats', () => {
  for (const lang of LANGS) for (const k of C.FIELDS) {
    const f = facts('housewarming', lang);
    const v = C.generate({ facts: f, lang, style: 'family', length: 'standard', count: 1, seed: 'sec|' + lang }).versions[0];
    const r = C.regenerateSection({ facts: f, lang, style: 'family', length: 'standard', version: v, section: k, seed: 'sec2|' + k, approach: v.approach });
    ok(`${lang} ${k}: new text`, r && r.text && C.htmlToText(r.text).trim() !== C.htmlToText(v.fields[k]).trim());
    if (r) ok(`${lang} ${k}: no phrase shared with other lines`, !C.repeatsAcross({ ...v.fields, [k]: r.text }, { ignore: C.ignoreFor(f, lang) }).length);
  }
});
group('repeat detector finds a phrase used in two lines', () => {
  const r = C.repeatsAcross({ familyName: 'With the blessings of our elders', welcome: 'Hello', message: '<p>With the blessings of our elders and the Almighty, we invite you.</p>', subtitle: '', thankyou: '' });
  ok('found', r.length > 0 && r[0].fields.includes('familyName') && r[0].fields.includes('message'));
});
group('the built-in writer never uses the overused-phrase list', () => {
  const all = JSON.stringify(B).toLowerCase();
  Object.values(C.OVERUSED).flat().forEach((p) => ok('not in banks: ' + p, !all.includes(p.toLowerCase())));
});

/* 4. checking AI answers (fixed fixtures) */
group('AI answers are checked before they are shown', () => {
  const f = facts('wedding', 'en');
  const good = (o = {}) => Object.assign({ approach: 'Opens with memory', headline: 'Shubh Vivah', subtitle: 'invite you to share the day they marry', welcome: 'We would love you with us as Aarav & Diya begin their life together.', message: ['Aarav & Diya met in college and never looked back.', 'Join us in Jaipur on 12 December.'], thankyou: 'Thank you for your love and good wishes.' }, o);
  const v = C.validateAi([good()], f, 'en');
  ok('good version accepted and names bolded', v.versions.length === 1 && v.versions[0].fields.message.includes('<b>Aarav &amp; Diya</b>'));
  ok('placeholder rejected', C.validateAi([good({ welcome: 'Dear [Guest Name], welcome.' })], f, 'en').versions.length === 0);
  ok('link rejected', C.validateAi([good({ thankyou: 'See www.example.com' })], f, 'en').versions.length === 0);
  ok('missing line rejected', C.validateAi([good({ subtitle: '' })], f, 'en').versions.length === 0);
  ok('invented number (25 years) rejected', C.validateAi([good({ message: ['After 25 years of friendship, they marry.'] })], f, 'en').versions.length === 0);
  ok('date from the facts accepted', C.validateAi([good({ message: ['See you on 12 December at 7 pm.'] })], f, 'en').versions.length === 1);
  ok('wrong script for Hindi rejected', C.validateAi([good()], facts('wedding', 'hi'), 'hi').versions.length === 0);
  ok('Hindi in Devanagari accepted', C.validateAi([{ headline: 'शुभ विवाह', subtitle: 'के विवाह में आप आमंत्रित हैं', welcome: 'आपका हार्दिक स्वागत है।', message: ['Aarav & Diya के नए जीवन की शुरुआत पर आपका आशीर्वाद चाहिए।'], thankyou: 'धन्यवाद।' }], facts('wedding', 'hi'), 'hi').versions.length === 1);
  ok('Punjabi in Devanagari rejected', C.validateAi([{ headline: 'शुभ विवाह', subtitle: 'के विवाह में आप आमंत्रित हैं', welcome: 'आपका हार्दिक स्वागत है।', message: ['आपका आशीर्वाद चाहिए।'], thankyou: 'धन्यवाद।' }], facts('wedding', 'pa'), 'pa').versions.length === 0);
  ok('near-duplicate versions: only one kept', C.validateAi([good(), good({ approach: 'x' })], f, 'en').versions.length === 1);
  ok('markup from the AI is escaped', !C.validateAi([good({ message: ['Hello <img src=x onerror=alert(1)>'] })], f, 'en').versions.length);
  ok('not an array → nothing', C.validateAi(null, f, 'en').versions.length === 0);
  ok('one AI line checked in context', C.checkLine('A new welcome for Aarav & Diya.', 'welcome', { fields: { familyName: 'a', subtitle: 'b', welcome: 'c', message: '<p>d</p>', thankyou: 'e' } }, f, 'en') === 'A new welcome for Aarav & Diya.');
});

/* 5. earlier invitations */
group('earlier "type of message" choices map to studio styles', () => {
  ok('traditional → traditional', C.styleFromTone('traditional', 'wedding') === 'traditional');
  ok('devotional → spiritual', C.styleFromTone('devotional', 'religious') === 'spiritual');
  ok('fun → joyful', C.styleFromTone('fun', 'birthday') === 'joyful');
  ok('unknown tone → the event type default', C.styleFromTone('zzz', 'corporate') === 'formal');
  ok('business events do not offer spiritual or family styles', !C.stylesFor('conference').some((s) => ['spiritual', 'family', 'traditional'].includes(s.id)));
  ok('a puja does not offer the playful style', !C.stylesFor('religious').some((s) => s.id === 'playful'));
  ok('all 12 styles exist', C.STYLES.length === 12);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(fails.slice(0, 30).join('\n')); process.exit(1); }
