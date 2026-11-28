/* InviteX designer page (#/designer): the marketplace pilot, India only.
 *   not applied      → application form
 *   applied          → "we'll reply within 3 working days"
 *   approved         → agreement in plain words, then the designer home:
 *                      earnings, designs with their status, and the design editor
 *   design editor    → artwork upload (checked size, watermarked preview made here,
 *                      perceptual hash for duplicate checks), text areas drawn on the
 *                      card, palettes, fonts, price tier with the expected earning,
 *                      source file, AI use, then the 5-point rights declaration.
 * Everything is saved through the designer_* functions in supabase/marketplace.sql;
 * the database decides who may do what. */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc, H = window.H;
  const rs = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const call = (fn, args) => H.store.call(fn, args || {});
  const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); } };
  const fail = (e) => IX.toast(e.message || String(e), 'bad', 6000);
  const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
    'Ladakh', 'Lakshadweep', 'Puducherry'];
  const STYLES = ['Royal', 'Floral', 'Temple', 'Minimal', 'Mehndi', 'Pichwai', 'Watercolour', 'Modern', 'Kids', 'Corporate'];
  const ZONES = [['title', 'Title'], ['names', 'Names'], ['date', 'Date and time'], ['venue', 'Venue'], ['message', 'Message']];
  const STATUS = { draft: ['Draft', ''], in_review: ['In review', ''], changes_requested: ['Changes asked', 'warn'], live: ['Live', 'published'], paused: ['Paused', 'no'], removed: ['Removed', 'no'] };
  const RIGHTS = [
    ['own', 'I created this design myself, or I hold written rights to every part of it.'],
    ['noThirdParty', 'It has no photos, illustrations, fonts, logos or characters I am not allowed to sell.'],
    ['noLikeness', 'It shows no real person without their written consent.'],
    ['notSoldExclusive', 'I have not sold exclusive rights to this design to anyone else.'],
    ['understandsLiability', 'I understand that a false declaration closes my account and makes me responsible for the losses it causes.'],
  ];
  const MIN_W = 1500, MAX_MB = 15;
  const cats = () => (window.IXT && IXT.CATEGORIES) || [{ id: 'wedding', name: 'Wedding' }];
  const fontPairs = () => (window.IXGallery && IXGallery.FONT_PAIRS) || [{ id: 'classic', name: 'Classic royal' }];

  // What the designer earns on one sale, the same sum as the database (_mk_split)
  const earning = (price, S, d, exclusive) => {
    const gst = Math.round(price * 18 / 118), fee = Math.round(price * 0.0236), net = price - gst - fee;
    let pct = exclusive ? S.exclusive : S.standard;
    if (d && d.bonusUntil && new Date(d.bonusUntil) >= new Date()) pct += S.bonus;
    pct = Math.min(pct, S.cap);
    return { pct, amount: Math.floor(net * pct / 100), net };
  };

  H.routes.designer = async (v, sub, id) => {
    if (H.store.mode !== 'supabase') {
      return H.render('<div class="card stack" style="max-width:620px;margin:2rem auto"><h1>Design for InviteX</h1><p>The designer marketplace works only in the live app (Production mode), because designs and earnings are kept on the server.</p><div class="row"><a class="btn" href="#/">Back</a></div></div>');
    }
    let st;
    try { st = await call('my_designer_state'); } catch (e) {
      return H.render(`<div class="card stack" style="max-width:620px;margin:2rem auto"><h1>Design for InviteX</h1><div class="notice warn">The designer marketplace is not switched on yet.</div><p class="tiny muted">${esc(e.message)}</p></div>`);
    }
    if (!st.designer) return st.application && st.application.status === 'pending' ? waiting(st) : apply(st);
    if (st.designer.agreement !== st.settings.agreement) return agreement(st);
    if (sub === 'design') return editor(st, id);
    return home(st);
  };

  /* ---------------- apply ---------------- */
  function apply(st) {
    const turned = st.application && st.application.status === 'rejected';
    H.render(`<div class="dz"><section class="card stack" style="max-width:720px;margin:1.5rem auto">
      <h1>Design for InviteX</h1>
      <p>Sell your invitation designs to hosts across India. You keep the copyright. InviteX sells a licence to use your design and pays you <b>${st.settings.standard}% of what is left after GST and the payment fee</b>, ${st.settings.exclusive}% if the design is only on InviteX, and ${st.settings.referral}% on sales you bring in yourself. Pilot designers get ${st.settings.bonus} points more for six months.</p>
      <p class="small muted">The pilot is for designers living in India, with a PAN and an Indian bank account or UPI ID for payouts.</p>
      ${turned ? `<div class="notice">Your last application was not accepted${st.application.note ? `: ${esc(st.application.note)}` : ''}. You can apply again.</div>` : ''}
      <form class="stack" id="dzApply" novalidate>
        <div class="field"><label for="dzName">Name shown on your designs *</label><input class="input" id="dzName" required maxlength="80" placeholder="e.g. Meera Studio"></div>
        <div class="f2 stack-sm"><div class="field"><label for="dzCity">City *</label><input class="input" id="dzCity" required maxlength="80" autocomplete="address-level2"></div>
          <div class="field"><label for="dzState">State *</label><select class="input" id="dzState" required><option value="">Choose…</option>${STATES.map((s) => `<option>${esc(s)}</option>`).join('')}</select></div></div>
        <div class="field"><label for="dzPortfolio">Portfolio link *</label><input class="input" id="dzPortfolio" type="url" required maxlength="300" placeholder="https://www.behance.net/yourname"><span class="hint">Behance, Instagram, Dribbble or your own site. We check that the work is yours.</span></div>
        <fieldset class="field"><legend>Occasions you design for</legend><div class="row">${cats().map((c) => `<label class="check"><input type="checkbox" name="occ" value="${esc(c.id)}"> ${esc(c.name)}</label>`).join('')}</div></fieldset>
        <p class="err" id="dzErr" role="alert" hidden></p>
        <div class="row"><button class="btn primary" type="submit">Apply</button></div>
      </form></section></div>`);
    const f = document.getElementById('dzApply');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = document.getElementById('dzErr');
      const val = (id) => document.getElementById(id).value.trim();
      const p = { displayName: val('dzName'), city: val('dzCity'), state: val('dzState'), portfolioUrl: val('dzPortfolio'), occasions: [...f.querySelectorAll('[name=occ]:checked')].map((x) => x.value) };
      const show = (m) => { err.textContent = m; err.hidden = false; };
      if (p.displayName.length < 2 || p.city.length < 2 || !p.state) return show('Please fill in your name, city and state.');
      if (!/^https:\/\/\S{4,}$/i.test(p.portfolioUrl)) return show('Please give a portfolio link that starts with https://');
      busy(e.submitter, true);
      try {
        const r = await call('designer_apply', { p });
        if (!r.ok) throw new Error(r.message || { already_applied: 'You have already applied.', already_designer: 'You are already a designer.' }[r.code] || r.code);
        IX.toast('Application sent', 'ok'); H.routes.designer();
      } catch (x) { busy(e.submitter, false); show(x.message); }
    };
  }

  function waiting(st) {
    H.render(`<section class="card stack" style="max-width:620px;margin:2rem auto"><h1>Thanks for applying</h1>
      <p>We look at every application by hand and reply within 3 working days. You will see the answer here.</p>
      <p class="small muted">Applied on ${esc(new Date(st.application.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }))}.</p>
      <div class="row"><a class="btn" href="#/">Back to my invitations</a></div></section>`);
  }

  /* ---------------- agreement ---------------- */
  function agreement(st) {
    const S = st.settings;
    H.render(`<section class="card stack" style="max-width:760px;margin:1.5rem auto"><h1>Welcome, ${esc(st.designer.name)}</h1>
      <p>Before you upload, here is the designer agreement in plain words.</p>
      <ol class="stack-sm">
        <li><b>You keep the copyright.</b> InviteX gets a licence to show, resize and recolour your design, to let hosts change the words, colours and photos inside it, to show it to their guests, and to use small previews to promote InviteX.</li>
        <li><b>Hosts buy a licence, not the design.</b> A host may use it for their own events, as many invitations as they like. They may not resell it.</li>
        <li><b>Your share is of net revenue:</b> the price minus GST and the payment fee. ${S.standard}% as standard, ${S.exclusive}% when the design is only on InviteX for 12 months, ${S.referral}% on sales through your own link${st.designer.bonusUntil ? `, plus ${S.bonus} points until ${esc(new Date(st.designer.bonusUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''}.</li>
        <li><b>Payouts</b> are monthly, on the 5th, by UPI or bank transfer, once your available balance is ${rs(S.threshold)} or more. A sale becomes available ${S.pendingDays} days after it happens. Tax (TDS) is deducted as the law requires.</li>
        <li><b>Leaving:</b> you can remove a design with 30 days' notice. Hosts who already bought it keep using it.</li>
        <li><b>Copying:</b> if someone shows your design is theirs, it is paused, you have 7 days to reply, and if it is removed its sales are refunded and taken back from your earnings.</li>
      </ol>
      <p class="tiny muted">Version ${esc(S.agreement)}. The full legal text is being prepared with a lawyer; this summary is what the pilot runs on.</p>
      <label class="check"><input type="checkbox" id="dzAgree"> I have read this and agree</label>
      <div class="row"><button class="btn primary" id="dzAgreeBtn" disabled>Continue</button></div></section>`);
    const c = document.getElementById('dzAgree'), b = document.getElementById('dzAgreeBtn');
    c.onchange = () => (b.disabled = !c.checked);
    b.onclick = async () => { busy(b, true); try { const r = await call('designer_accept_agreement', { p_version: S.agreement }); if (!r.ok) throw new Error(r.code); H.routes.designer(); } catch (e) { fail(e); busy(b, false); } };
  }

  /* ---------------- home ---------------- */
  async function home(st) {
    const B = st.balance || {}, d = st.designer;
    const list = await call('designer_designs');
    H.render(`<div class="dz" style="max-width:1000px;margin:1.5rem auto;display:grid;gap:1rem">
      <header class="row between"><div><h1 style="margin:0">${esc(d.name)}</h1><p class="small muted" style="margin:0">Designer${d.trust !== 'new' ? ` · ${esc(d.trust)}` : ''}${d.status !== 'active' ? ` · <b>${esc(d.status)}</b>` : ''}</p></div>
        <a class="btn primary" href="#/designer/design/new">+ Upload a design</a></header>
      ${d.status !== 'active' ? '<div class="notice warn">Your designer account is paused. You cannot upload or sell until InviteX restores it. Write to us if you think this is a mistake.</div>' : ''}
      <dl class="hx-tiles" aria-label="Earnings">
        <div><dt>Waiting</dt><dd>${rs(B.pending)}</dd><p>Becomes available ${st.settings.pendingDays} days after each sale</p></div>
        <div><dt>Available</dt><dd>${rs(B.available)}</dd><p>Paid on the 5th once it reaches ${rs(st.settings.threshold)}</p></div>
        <div><dt>Paid to you</dt><dd>${rs(B.paid)}</dd><p>${d.kyc === 'verified' ? 'Payout details verified' : 'We will ask for your PAN and UPI or bank details before your first payout'}</p></div>
        <div><dt>Sales</dt><dd>${Number(B.sales || 0)}</dd><p>Lifetime earnings ${rs(B.lifetime)}</p></div>
      </dl>
      <section class="card stack"><h2 style="margin:0">Your designs</h2>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Design</th><th scope="col">Status</th><th scope="col" class="num">Price</th><th scope="col" class="num">Sales</th><th scope="col" class="num">Earned</th><th scope="col"></th></tr></thead><tbody>
          ${list.map((g) => { const [label, cls] = STATUS[g.status] || [g.status, '']; const editable = ['draft', 'changes_requested'].includes(g.status); return `<tr>
            <td><b>${esc(g.title || 'Untitled')}</b><div class="tiny muted">${esc(g.occasion)}</div>${g.status === 'changes_requested' && g.reviewNote ? `<div class="tiny" style="color:var(--warn,#a60)">Reviewer: ${esc(g.reviewNote)}</div>` : ''}</td>
            <td><span class="pill ${cls}">${esc(label)}</span></td><td class="num">${rs(g.price)}</td><td class="num">${Number(g.sales)}</td><td class="num">${rs(g.earned)}</td>
            <td>${editable ? `<a class="btn sm" href="#/designer/design/${esc(g.id)}">${g.status === 'draft' ? 'Continue' : 'Make changes'}</a>` : ''}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="muted" style="margin:0">No designs yet. Upload your first one: it takes about 30 minutes, most of it marking where the words go.</p>'}
      </section>
      <section class="card stack-sm"><h2 style="margin:0">Your sales link</h2>
        <p class="small" style="margin:0">Share this with your own followers. Sales through it pay you ${st.settings.referral}% of net${d.bonusUntil ? ' plus your pilot bonus' : ''}.</p>
        <div class="copyrow"><input class="input" readonly value="${esc(IX.baseUrl() + 'index.html#/new?designer=' + d.slug + '&ref=' + d.referral)}" aria-label="Your sales link"><button class="btn" data-copy>Copy</button></div>
      </section></div>`);
    const cp = document.querySelector('.dz [data-copy]');
    if (cp) cp.onclick = async () => { await IX.copy(cp.previousElementSibling.value); IX.toast('Link copied', 'ok'); };
  }

  /* ---------------- image helpers ---------------- */
  const loadImg = (file) => new Promise((res, rej) => { const u = URL.createObjectURL(file); const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This file is not an image we can read.')); i.src = u; });
  // 64-bit difference hash: 9x8 grey thumbnail, each bit = "brighter than the pixel to its right"
  function dHash(img) {
    const c = document.createElement('canvas'); c.width = 9; c.height = 8;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 9, 8);
    const d = x.getImageData(0, 0, 9, 8).data; let bits = '';
    for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) { const p = (y * 9 + i) * 4, q = p + 4; bits += (d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11) > (d[q] * 0.3 + d[q + 1] * 0.59 + d[q + 2] * 0.11) ? '1' : '0'; }
    let hex = ''; for (let k = 0; k < 64; k += 4) hex += parseInt(bits.slice(k, k + 4), 2).toString(16);
    return hex;
  }
  // 800px preview with a repeated diagonal "InviteX preview" mark
  function watermarked(img) {
    const w = 800, h = Math.round(img.naturalHeight * w / img.naturalWidth);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    x.save(); x.translate(w / 2, h / 2); x.rotate(-Math.PI / 6);
    x.font = '600 34px system-ui, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.38)'; x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1;
    for (let yy = -h; yy <= h; yy += 140) for (let xx = -w; xx <= w; xx += 360) { x.fillText('InviteX preview', xx, yy); x.strokeText('InviteX preview', xx, yy); }
    x.restore();
    return new Promise((res) => c.toBlob((b) => res(b), 'image/webp', 0.82));
  }
  const upload = async (bucket, path, blob) => {
    const { error } = await H.store.sb.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: true, cacheControl: '31536000' });
    if (error) throw error;
    return path;
  };
  const pub = (bucket, path) => (path ? H.store.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : '');

  /* ---------------- design editor ---------------- */
  async function editor(st, id) {
    const S = st.settings, d = st.designer;
    const list = id && id !== 'new' ? await call('designer_designs') : [];
    const g = list.find((x) => x.id === id) || { title: '', occasion: 'wedding', styleTags: [], tags: [], languages: ['en'], price: S.tiers[1] || S.tiers[0], exclusive: false, pages: [], palettes: [{ bg: '#3b0a16', text: '#f6e7c8', accent: '#d4a24c' }], fonts: 'classic', phash: [], sourcePath: '', aiUse: 'none' };
    if (id && id !== 'new' && !list.find((x) => x.id === id)) return H.go('#/designer');
    const folder = (g.pages[0] && g.pages[0].path ? g.pages[0].path.split('/')[1] : '') || IX.uid('d') ;
    const W = { g: IX.deepClone(g), front: g.pages.find((p) => p.role === 'front') || null, img: null };
    const needSource = d.trust === 'new' && Number(d.approvedCount || 0) < 5;
    H.render(`<div class="dz" style="max-width:1100px;margin:1.5rem auto">
      <div class="row between"><h1 style="margin:0">${g.id ? 'Edit design' : 'Upload a design'}</h1><a class="btn ghost" href="#/designer">Back</a></div>
      ${g.status === 'changes_requested' && g.reviewNote ? `<div class="notice warn">The reviewer asked: ${esc(g.reviewNote)}</div>` : ''}
      <div class="dz-grid">
        <section class="card stack">
          <h2 style="margin:0">1. Front of the card</h2>
          <p class="small muted" style="margin:0">PNG or JPEG, at least ${MIN_W} pixels wide, up to ${MAX_MB} MB. Leave the places for words empty: hosts type their own.</p>
          <input type="file" id="dzArt" accept="image/png,image/jpeg" aria-label="Front artwork">
          <p class="err" id="dzArtErr" role="alert" hidden></p>
          <div class="dz-stage" id="dzStage" ${W.front ? '' : 'hidden'}><img id="dzImg" alt="Your front artwork" src="${esc(W.front ? pub('designer-previews', W.front.preview) : '')}"><div class="dz-zones" id="dzZones"></div></div>
          <div id="dzZoneTools" ${W.front ? '' : 'hidden'} class="stack-sm">
            <p class="small" style="margin:0"><b>2. Mark where the words go.</b> Drag a box on the card, then choose what goes in it. Add at least a title and the names.</p>
            <ul class="dz-zlist" id="dzZList"></ul>
          </div>
        </section>
        <section class="card stack">
          <h2 style="margin:0">3. About the design</h2>
          <div class="field"><label for="dzTitle">Title *</label><input class="input" id="dzTitle" maxlength="80" value="${esc(g.title)}" placeholder="e.g. Rajwada Gold"></div>
          <div class="field"><label for="dzOcc">Occasion</label><select class="input" id="dzOcc">${cats().map((c) => `<option value="${esc(c.id)}" ${c.id === g.occasion ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <fieldset class="field"><legend>Style</legend><div class="row">${STYLES.map((s) => `<label class="check"><input type="checkbox" name="sty" value="${esc(s)}" ${g.styleTags.includes(s) ? 'checked' : ''}> ${esc(s)}</label>`).join('')}</div></fieldset>
          <div class="field"><label for="dzTags">Search words</label><input class="input" id="dzTags" value="${esc(g.tags.join(', '))}" placeholder="red, gold, peacock (up to 8)"></div>
          <fieldset class="field"><legend>Languages the layout suits</legend><div class="row">${[['en', 'English'], ['hi', 'हिन्दी'], ['pa', 'ਪੰਜਾਬੀ']].map(([k, l]) => `<label class="check"><input type="checkbox" name="lang" value="${k}" ${g.languages.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
          <fieldset class="field"><legend>Colours (up to 3 choices for hosts)</legend><div class="stack-sm" id="dzPals"></div><button type="button" class="btn sm" id="dzPalAdd">+ Add a colour choice</button></fieldset>
          <div class="field"><label for="dzFonts">Fonts</label><select class="input" id="dzFonts">${fontPairs().map((p) => `<option value="${esc(p.id)}" ${p.id === g.fonts ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select><span class="hint">Only fonts InviteX already has, so there is no font licence to worry about.</span></div>
          <div class="field"><label for="dzPrice">Price</label><select class="input" id="dzPrice">${S.tiers.map((t) => `<option value="${t}" ${t === g.price ? 'selected' : ''}>${rs(t)}</option>`).join('')}</select><span class="hint" id="dzEarn"></span></div>
          <label class="check"><input type="checkbox" id="dzExcl" ${g.exclusive ? 'checked' : ''}> Only on InviteX for 12 months (you earn ${S.exclusive}% instead of ${S.standard}%)</label>
          <fieldset class="field"><legend>Did you use AI?</legend>${[['none', 'No'], ['assisted', 'Yes, as a starting point, then I changed it a lot'], ['mostly', 'Mostly AI-made (cannot be sold here)']].map(([k, l]) => `<label class="check"><input type="radio" name="ai" value="${k}" ${g.aiUse === k ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>
          <div class="field"><label for="dzSrc">Layered source file ${needSource ? '*' : '(optional)'}</label><input type="file" id="dzSrc" accept=".psd,.ai,.pdf,.zip,.mp4,.procreate,.fig"><span class="hint">${needSource ? 'Needed for your first 5 designs: PSD, AI, PDF with layers, a Figma or Procreate export, or a screen recording of the canvas. Only reviewers see it.' : 'Helps if someone ever claims your design is theirs.'}${g.sourcePath ? ' <b>Uploaded.</b>' : ''}</span></div>
          <div class="row"><button class="btn" id="dzSave">Save draft</button></div>
        </section>
        <section class="card stack dz-submit">
          <h2 style="margin:0">4. Send for review</h2>
          <p class="small muted" style="margin:0">Tick each one. We keep this declaration with the design.</p>
          ${RIGHTS.map(([k, l]) => `<label class="check"><input type="checkbox" name="rights" value="${k}"> ${esc(l)}</label>`).join('')}
          <p class="err" id="dzSubErr" role="alert" hidden></p>
          <div class="row"><button class="btn primary" id="dzSubmit">Send for review</button></div>
          <p class="tiny muted" style="margin:0">A reviewer replies within 48 hours.</p>
        </section>
      </div></div>`);

    const $ = (s) => document.getElementById(s);
    const earn = () => { const e = earning(Number($('dzPrice').value), S, d, $('dzExcl').checked); $('dzEarn').textContent = `You earn about ${rs(e.amount)} per sale (${e.pct}% of ${rs(e.net)} after GST and the payment fee).`; };
    $('dzPrice').onchange = earn; $('dzExcl').onchange = earn; earn();

    // palettes
    const pals = () => {
      $('dzPals').innerHTML = W.g.palettes.map((p, i) => `<div class="row" data-i="${i}"><span class="tiny">Choice ${i + 1}</span>
        ${[['bg', 'Background'], ['text', 'Words'], ['accent', 'Accent']].map(([k, l]) => `<label class="tiny">${l} <input type="color" data-k="${k}" value="${esc(p[k] || '#000000')}"></label>`).join('')}
        ${W.g.palettes.length > 1 ? `<button type="button" class="btn sm ghost" data-rm="${i}" aria-label="Remove colour choice ${i + 1}">Remove</button>` : ''}</div>`).join('');
      $('dzPalAdd').disabled = W.g.palettes.length >= 3;
      $('dzPals').querySelectorAll('input[type=color]').forEach((inp) => (inp.oninput = () => { W.g.palettes[+inp.closest('[data-i]').dataset.i][inp.dataset.k] = inp.value; }));
      $('dzPals').querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { W.g.palettes.splice(+b.dataset.rm, 1); pals(); }));
    };
    $('dzPalAdd').onclick = () => { if (W.g.palettes.length < 3) { W.g.palettes.push({ ...W.g.palettes[W.g.palettes.length - 1] }); pals(); } };
    pals();

    // text areas drawn on the card (fractions of the card's size)
    const zonesOf = () => (W.front ? (W.front.zones = W.front.zones || []) : []);
    const drawZones = () => {
      $('dzZones').innerHTML = zonesOf().map((z, i) => `<div class="dz-zone" style="left:${z.x * 100}%;top:${z.y * 100}%;width:${z.w * 100}%;height:${z.h * 100}%"><span>${esc((ZONES.find((k) => k[0] === z.key) || [z.key, z.key])[1])}</span></div>`).join('');
      $('dzZList').innerHTML = zonesOf().map((z, i) => `<li class="row"><select class="input" data-zk="${i}" aria-label="What goes in box ${i + 1}" style="max-width:200px">${ZONES.map(([k, l]) => `<option value="${k}" ${k === z.key ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="input" data-za="${i}" aria-label="Alignment of box ${i + 1}" style="max-width:140px">${['center', 'left', 'right'].map((a) => `<option ${a === (z.align || 'center') ? 'selected' : ''}>${a}</option>`).join('')}</select>
        <button type="button" class="btn sm ghost" data-zr="${i}" aria-label="Remove box ${i + 1}">Remove</button></li>`).join('') || '<li class="tiny muted">No boxes yet.</li>';
      $('dzZList').querySelectorAll('[data-zk]').forEach((s) => (s.onchange = () => { zonesOf()[+s.dataset.zk].key = s.value; drawZones(); }));
      $('dzZList').querySelectorAll('[data-za]').forEach((s) => (s.onchange = () => { zonesOf()[+s.dataset.za].align = s.value; }));
      $('dzZList').querySelectorAll('[data-zr]').forEach((b) => (b.onclick = () => { zonesOf().splice(+b.dataset.zr, 1); drawZones(); }));
    };
    const stage = $('dzStage');
    let start = null, ghost = null;
    const pt = (e) => { const r = stage.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
    stage.addEventListener('pointerdown', (e) => { if (!W.front) return; start = pt(e); ghost = document.createElement('div'); ghost.className = 'dz-zone ghost'; $('dzZones').appendChild(ghost); stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => { if (!start) return; const p = pt(e); Object.assign(ghost.style, { left: Math.min(start.x, p.x) * 100 + '%', top: Math.min(start.y, p.y) * 100 + '%', width: Math.abs(p.x - start.x) * 100 + '%', height: Math.abs(p.y - start.y) * 100 + '%' }); });
    stage.addEventListener('pointerup', (e) => {
      if (!start) return; const p = pt(e); const z = { key: '', x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y), align: 'center' };
      start = null;
      if (z.w > 0.04 && z.h > 0.02) { const used = zonesOf().map((q) => q.key); z.key = (ZONES.find(([k]) => !used.includes(k)) || ZONES[4])[0]; Object.keys(z).forEach((k) => typeof z[k] === 'number' && (z[k] = Math.round(z[k] * 1000) / 1000)); zonesOf().push(z); }
      drawZones();
    });
    if (W.front) drawZones();

    // artwork upload
    $('dzArt').onchange = async (e) => {
      const file = e.target.files[0], err = $('dzArtErr'); err.hidden = true;
      if (!file) return;
      const show = (m) => { err.textContent = m; err.hidden = false; e.target.value = ''; };
      if (!['image/png', 'image/jpeg'].includes(file.type)) return show('Please upload a PNG or JPEG file.');
      if (file.size > MAX_MB * 1048576) return show(`This file is ${(file.size / 1048576).toFixed(1)} MB. Please keep it under ${MAX_MB} MB.`);
      try {
        const img = await loadImg(file);
        if (img.naturalWidth < MIN_W) return show(`This image is ${img.naturalWidth} pixels wide. Please upload at least ${MIN_W} pixels wide.`);
        IX.toast('Uploading…');
        const uid = H.user.id, ext = file.type === 'image/png' ? 'png' : 'jpg';
        const path = await upload('designer-art', `${uid}/${folder}/front.${ext}`, file);
        const preview = await upload('designer-previews', `${uid}/${folder}/front.webp`, await watermarked(img));
        W.front = { role: 'front', path, preview, w: img.naturalWidth, h: img.naturalHeight, zones: (W.front && W.front.zones) || [] };
        W.g.phash = [dHash(img)];
        $('dzImg').src = URL.createObjectURL(file); $('dzStage').hidden = false; $('dzZoneTools').hidden = false; drawZones();
        IX.toast('Uploaded. Now drag boxes where the words go.', 'ok');
      } catch (x) { show(x.message || 'Upload failed. Please try again.'); }
    };
    $('dzSrc').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 150 * 1048576) { e.target.value = ''; return IX.toast('Source files can be up to 150 MB.', 'warn'); }
      try { IX.toast('Uploading source file…'); W.g.sourcePath = await upload('designer-source', `${H.user.id}/${folder}/source-${IX.slugify(file.name).slice(0, 40) || 'file'}`, file); IX.toast('Source file uploaded', 'ok'); } catch (x) { fail(x); }
    };

    const collect = () => ({
      id: W.g.id || null, title: $('dzTitle').value.trim(), occasion: $('dzOcc').value,
      styleTags: [...document.querySelectorAll('[name=sty]:checked')].map((x) => x.value),
      tags: $('dzTags').value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 8),
      languages: [...document.querySelectorAll('[name=lang]:checked')].map((x) => x.value),
      price: Number($('dzPrice').value), exclusive: $('dzExcl').checked, palettes: W.g.palettes, fonts: $('dzFonts').value,
      pages: W.front ? [W.front] : [], phash: W.g.phash, sourcePath: W.g.sourcePath || '', aiUse: (document.querySelector('[name=ai]:checked') || {}).value || 'none',
    });
    const save = async () => {
      const r = await call('designer_save_design', { p: collect() });
      if (!r.ok) throw new Error({ agreement_needed: 'Please accept the agreement first.', bad_price: 'Please pick one of the prices.', locked: 'This design is in review and cannot be changed now.' }[r.code] || r.code);
      W.g.id = r.id; return r.id;
    };
    $('dzSave').onclick = async (e) => { busy(e.target, true); try { await save(); IX.toast('Draft saved', 'ok'); history.replaceState(null, '', '#/designer/design/' + W.g.id); } catch (x) { fail(x); } busy(e.target, false); };
    $('dzSubmit').onclick = async (e) => {
      const err = $('dzSubErr'); err.hidden = true;
      const show = (m) => { err.textContent = m; err.hidden = false; };
      const c = collect();
      if (c.title.length < 3) return show('Give the design a title.');
      if (!W.front) return show('Upload the front of the card first.');
      const keys = zonesOf().map((z) => z.key);
      if (!keys.includes('title') && !keys.includes('names')) return show('Mark at least a box for the title or the names.');
      if (needSource && !c.sourcePath) return show('Upload the layered source file. It is needed for your first 5 designs.');
      if (c.aiUse === 'mostly') return show('Designs that are mostly AI-made cannot be sold on InviteX.');
      const rights = {}; document.querySelectorAll('[name=rights]').forEach((x) => (rights[x.value] = x.checked));
      if (Object.values(rights).some((v) => !v)) return show('Please tick all five statements.');
      busy(e.target, true);
      try {
        await save();
        const r = await call('designer_submit_design', { p_id: W.g.id, p_rights: rights });
        if (!r.ok) throw new Error({ rights_missing: 'Please tick all five statements.', needs_source: 'Upload the layered source file first.', ai_not_allowed: 'Mostly AI-made designs cannot be sold here.', weekly_limit: `New designers can send ${r.n} designs a week. Please send this one later.`, needs_front: 'Upload the front of the card first.', needs_palette: 'Add at least one colour choice.', needs_title: 'Give the design a title.' }[r.code] || r.code);
        IX.toast('Sent for review. We reply within 48 hours.', 'ok'); H.go('#/designer');
      } catch (x) { show(x.message); busy(e.target, false); }
    };
  }
})();
