/* InviteX settings: Account, Language, WhatsApp and Plan.
 * Preferences apply to NEW invitations only; existing invitations keep their own choices.
 * Plan shows how sharing is priced, your sharing campaigns and your receipts (information only). */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model, esc = IX.esc, H = window.H;
  const TABS = [['account', 'Account'], ['language', 'Language'], ['whatsapp', 'WhatsApp'], ['plan', 'Plan']];
  const LANGS = () => window.IX_LANGS || { en: 'English', hi: 'हिन्दी', pa: 'ਪੰਜਾਬੀ' };
  const SAMPLE = {
    en: "You're warmly invited to celebrate with us.\nAarav & Diya · Thursday, 21 January 2027\nRSVP here: invitex.app/…",
    hi: 'आप सादर आमंत्रित हैं।\nआरव और दिया · गुरुवार, 21 जनवरी 2027\nयहाँ जवाब दें: invitex.app/…',
    pa: 'ਤੁਹਾਨੂੰ ਨਿੱਘਾ ਸੱਦਾ ਹੈ।\nਆਰਵ ਅਤੇ ਦੀਆ · ਵੀਰਵਾਰ, 21 ਜਨਵਰੀ 2027\nਇੱਥੇ ਜਵਾਬ ਦਿਓ: invitex.app/…',
  };

  // Clean a preferences object so only known values are stored.
  function clean(p) {
    const all = Object.keys(LANGS());
    const langs = (Array.isArray(p.langs) ? p.langs : ['en']).filter((l) => all.includes(l));
    const out = {
      name: String(p.name || '').trim().slice(0, 80),
      phone: String(p.phone || '').trim().slice(0, 20),
      langs: langs.length ? langs : ['en'],
    };
    out.defaultLang = out.langs.includes(p.defaultLang) ? p.defaultLang : out.langs[0];
    out.msgLang = out.langs.includes(p.msgLang) ? p.msgLang : '';
    out.msgStyle = p.msgStyle === 'full' ? 'full' : 'card';
    return out;
  }

  // Applied once when a new invitation is created.
  H.applyPrefs = async (inv) => {
    let p;
    try { p = await H.store.getPrefs(); } catch (e) { p = M.prefs ? M.prefs() : {}; }
    if (!p || !Object.keys(p).length) return inv;
    p = clean(p);
    if (p.name || p.phone) inv.contact = { name: p.name || inv.contact.name, phone: p.phone || inv.contact.phone };
    p.langs.forEach((l) => {
      if (inv.languages.includes(l)) return;
      inv.languages.push(l);
      inv.text[l] = Object.assign({}, inv.text.en);
      if (window.IXStudio) { try { IXStudio.fillDefault(inv, l); } catch (e) { /* keep the copied text */ } }
    });
    if (!p.langs.includes('en')) inv.languages = inv.languages.filter((l) => l !== 'en');
    inv.defaultLang = p.defaultLang;
    if (p.msgLang) inv.shareLang = p.msgLang;
    inv.msgStyle = p.msgStyle;
    return inv;
  };

  H.routes.settings = async (v, tab) => {
    const T = TABS.some((t) => t[0] === tab) ? tab : 'account';
    const local = H.store.mode === 'local';
    let P = clean(await H.store.getPrefs().catch(() => ({})));
    H.render(`<div class="st">
      <div class="st-head"><h1>Settings</h1><p class="muted small">Your choices here are used for every <b>new</b> invitation. Invitations you already made keep their own settings.</p></div>
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<a class="tab ${k === T ? 'on' : ''}" role="tab" aria-selected="${k === T}" href="#/settings/${k}" data-stab="${k}">${l}</a>`).join('')}</div>
      <div id="stBody"></div></div>`);
    const body = v.querySelector('#stBody');
    const save = async (patch, msg = 'Saved') => {
      P = clean(Object.assign({}, P, patch));
      try { await H.store.savePrefs(P); IX.toast(msg, 'ok', 1400); } catch (e) { IX.toast('Could not save: ' + e.message, 'bad'); }
    };
    ({ account, language, whatsapp, plan })[T](body, P, save, local);
  };

  /* ---------- Account ---------- */
  function account(body, P, save, local) {
    body.innerHTML = `
      <div class="card stack">
        <h2>Your details</h2>
        <p class="small muted">Shown as the contact person on new invitations, so guests can call or WhatsApp you.</p>
        <form id="acc" class="grid2">
          <div class="field"><label for="stName">Your name</label><input class="input" id="stName" autocomplete="name" maxlength="80" value="${esc(P.name)}" placeholder="e.g. Sharma family"></div>
          <div class="field"><label for="stPhone">WhatsApp number</label><input class="input" id="stPhone" type="tel" autocomplete="tel" maxlength="20" value="${esc(P.phone)}" placeholder="+91 98765 43210"></div>
          <div><button class="btn primary" type="submit">Save details</button></div>
        </form>
      </div>
      <div class="card stack">
        <h2>Data mode: ${local ? 'Demo / Local' : 'Production (Supabase)'}</h2>
        ${local ? `<div class="notice warn"><b>Your data is stored only in this browser on this device</b> (IndexedDB). Guest links open only in this same browser, and RSVPs from other people's phones are <b>not</b> collected. To receive real RSVPs from guests, connect a Supabase project — see <a href="docs/DEPLOYMENT.md" target="_blank">docs/DEPLOYMENT.md</a>.</div>`
          : `<div class="notice ok">Connected to Supabase. Signed in as <b>${esc(H.user && H.user.email)}</b>. Guests can open links from any device and RSVPs synchronise to your dashboard.</div><div class="row"><button class="btn" id="chk">Check connection</button><button class="btn" id="signOut">Sign out</button></div><div id="chkOut"></div>`}
      </div>
      ${local ? `<div class="card stack">
        <h2>Backup &amp; restore</h2>
        <p class="muted small">Download everything (invitations, guests, RSVPs, photos) as one file, or restore it on another browser.</p>
        <div class="row"><button class="btn" id="exp">Download backup (.json)</button>
        <label class="btn">Restore backup<input type="file" accept="application/json,.json" id="imp" hidden></label></div>
      </div>
      <div class="card stack">
        <h2>Delete all local data</h2>
        <p class="muted small">Removes every invitation, guest list, RSVP and uploaded file from this browser.</p>
        <button class="btn danger" id="wipe">Delete everything</button>
      </div>` : ''}`;
    body.querySelector('#acc').onsubmit = async (e) => {
      e.preventDefault();
      const phone = body.querySelector('#stPhone').value.trim();
      if (phone && (IX.normPhone(phone) || '').length < 10) { IX.toast('Please check the WhatsApp number', 'bad'); return; }
      await save({ name: body.querySelector('#stName').value, phone }, 'Details saved');
    };
    const so = body.querySelector('#signOut');
    if (so) so.onclick = async () => { await H.store.signOut(); H.user = null; H.go('#/login'); };
    const ck = body.querySelector('#chk');
    if (ck) ck.onclick = async () => { const r = await H.store.checkConnection(); body.querySelector('#chkOut').innerHTML = `<div class="notice ${r.ok ? 'ok' : 'bad'}">${esc(r.msg)}</div>`; };
    if (!local) return;
    body.querySelector('#exp').onclick = async () => {
      const data = await H.store.exportAll();
      IX.download('invitex-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data), 'application/json');
    };
    body.querySelector('#imp').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { await H.store.importAll(JSON.parse(await f.text())); IX.toast('Backup restored', 'ok'); H.go('#/'); } catch (err) { IX.toast(err.message, 'bad'); }
    };
    body.querySelector('#wipe').onclick = async () => {
      if (!(await H.confirm('Delete all local data?', 'Every invitation, guest and RSVP in this browser will be erased. This cannot be undone.', 'Delete everything', true))) return;
      await H.store.wipe();
      location.hash = '#/';
      location.reload();
    };
  }

  /* ---------- Language ---------- */
  function language(body, P, save) {
    const L = LANGS();
    const draw = () => {
      body.innerHTML = `<div class="card stack">
        <h2>Invitation languages</h2>
        <p class="small muted">New invitations start with these languages. Guests can switch between them on the invitation.</p>
        <div class="row" role="group" aria-label="Languages">${Object.entries(L).map(([l, n]) => `<label class="check"><input type="checkbox" name="stLang" value="${l}" ${P.langs.includes(l) ? 'checked' : ''}> <span lang="${l}">${esc(n)}</span></label>`).join('')}</div>
        <div class="field" style="max-width:280px"><label for="stDef">Main language (shown first)</label>
          <select class="input" id="stDef">${P.langs.map((l) => `<option value="${l}" ${l === P.defaultLang ? 'selected' : ''} lang="${l}">${esc(L[l])}</option>`).join('')}</select></div>
        <p class="tiny muted">Wording in Hindi and Punjabi is written for each occasion, not machine-translated. You can still change languages on any invitation.</p>
      </div>`;
      body.querySelectorAll('[name=stLang]').forEach((c) => (c.onchange = async () => {
        const langs = [...body.querySelectorAll('[name=stLang]:checked')].map((x) => x.value);
        if (!langs.length) { c.checked = true; IX.toast('Keep at least one language', 'bad'); return; }
        await save({ langs }); Object.assign(P, clean(Object.assign({}, P, { langs }))); draw();
      }));
      body.querySelector('#stDef').onchange = async (e) => { await save({ defaultLang: e.target.value }); P.defaultLang = e.target.value; };
    };
    draw();
  }

  /* ---------- WhatsApp ---------- */
  function whatsapp(body, P, save) {
    const L = LANGS();
    const draw = () => {
      const showL = P.msgLang || P.defaultLang;
      body.innerHTML = `<div class="card stack">
        <h2>WhatsApp message</h2>
        <div class="field"><span class="lbl">Message style</span><div class="seg" role="group" aria-label="Message style">
          <label><input type="radio" name="stStyle" value="card" ${P.msgStyle === 'card' ? 'checked' : ''}>Short, with card image</label>
          <label><input type="radio" name="stStyle" value="full" ${P.msgStyle === 'full' ? 'checked' : ''}>Full details</label></div>
          <span class="hint">Short: your card image with one line and the RSVP link. Full: a longer message with date, time and venue.</span></div>
        <div class="field" style="max-width:320px"><label for="stMsgLang">Message language</label>
          <select class="input" id="stMsgLang"><option value="">Same as the main language</option>${P.langs.map((l) => `<option value="${l}" ${l === P.msgLang ? 'selected' : ''} lang="${l}">${esc(L[l])}</option>`).join('')}</select>
          <span class="hint">Only the languages chosen under Language are offered.</span></div>
        ${P.msgStyle === 'card' ? `<div><span class="lbl">How the short message reads</span>
          <div class="wa-prev st-wa"><div class="wa-bubble"><div class="wa-text" lang="${showL}" id="stSample">${esc(SAMPLE[showL] || SAMPLE.en).replace(/\n/g, '<br>')}</div><span class="wa-time">now</span></div></div></div>` : ''}
        <p class="tiny muted">You can still change the wording for each invitation in its <b>Share</b> tab. InviteX opens WhatsApp with the message ready; you press Send.</p>
      </div>`;
      body.querySelectorAll('[name=stStyle]').forEach((r) => (r.onchange = async () => { await save({ msgStyle: r.value }); P.msgStyle = r.value; draw(); }));
      body.querySelector('#stMsgLang').onchange = async (e) => { await save({ msgLang: e.target.value }); P.msgLang = e.target.value; draw(); };
    };
    draw();
  }

  /* ---------- Plan: how pricing works for me, my sharing campaigns and receipts ----------
   * Information only. Prices and free access are decided by the server (supabase/billing.sql). */
  async function plan(body) {
    const inc = ['Unlimited invitations, photos and designs', 'Guest list with personal links', 'Preview and publish', 'One-tap RSVP and reply tracking', 'English, Hindi and Punjabi', 'Check-in at the venue'];
    body.innerHTML = '<div class="page-loading"><div class="spinner"></div></div>';
    const [q, camps, pays] = await Promise.all([H.store.sharingQuote().catch(() => null), H.store.myCampaigns().catch(() => []), H.store.myPayments().catch(() => [])]);
    const C = window.IXCampaign || {};
    const rs = C.rupees || ((p) => '₹' + p / 100);
    const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
    const priced = q && q.payment_required !== undefined;
    const pricing = !priced
      ? '<p class="small muted" style="margin:0">There is nothing to pay. InviteX never asks for card or bank details.</p>'
      : `<p style="margin:0">Making and preparing invitations is free. You pay only when you <b>start sharing</b> an invitation with guests:
           <b>${rs(q.amount_paise)}</b> per sharing campaign, once, by UPI. One campaign covers every guest, and resending is free.</p>
         ${q.payment_required ? '' : `<div class="notice ok">${esc((C.FREE_WHY || {})[q.free_reason] || 'Sharing is free for you right now.')}</div>`}
         <p class="tiny muted" style="margin:0">Payments are made by UPI through Razorpay. InviteX never sees or stores your UPI PIN, bank or card details.</p>`;
    const ST = C.STATUS || {};
    body.innerHTML = `<div class="card stack st-plan">
      <div class="row between"><div><span class="lbl">Your plan</span><h2 style="margin:.2rem 0 0">Pay per sharing campaign</h2></div><span class="pill published">Active</span></div>
      <ul class="st-inc">${inc.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${pricing}
    </div>
    ${camps.length ? `<div class="card stack"><h2 style="margin:0">Your sharing campaigns</h2>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Campaign</th><th>Status</th><th>Cost</th><th>Started</th></tr></thead><tbody>
      ${camps.map((c) => { const e = c.entitlement || {}; const st = ST[c.status] || [c.status, '']; return `<tr><td><a href="#/dash/${esc(c.invitation_id)}/share">${esc(c.name)}</a></td>
        <td><span class="pill ${st[1]}">${esc(st[0])}</span>${c.entitlement_status === 'refunded' ? ' <span class="pill">Refunded</span>' : ''}</td>
        <td>${e.grant_type === 'paid' ? rs(e.amount_paise) : e.grant_type ? 'Free' : c.amount_paise ? rs(c.amount_paise) + ' due' : '—'}</td><td>${esc(day(c.created_at))}</td></tr>`; }).join('')}
      </tbody></table></div></div>` : ''}
    ${pays.length ? `<div class="card stack"><h2 style="margin:0">Payments</h2>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Campaign</th><th class="num">Amount</th><th>Status</th><th>Razorpay payment</th></tr></thead><tbody>
      ${pays.map((p) => `<tr><td>${esc(day(p.paid_at || p.created_at))}</td><td>${esc(p.campaign)}${p.is_test ? ' <span class="pill">TEST</span>' : ''}</td><td class="num">${rs(p.amount_paise)}</td>
        <td>${p.status === 'paid' ? (p.refunded_paise ? `Refunded ${rs(p.refunded_paise)}` : 'Paid') : p.status === 'expired' ? 'Not paid' : p.status === 'failed' ? 'Failed' : 'Pending'}</td><td class="tiny">${esc(p.payment_id || '')}</td></tr>`).join('')}
      </tbody></table></div><p class="tiny muted" style="margin:0">Payments marked TEST were Razorpay test payments: no real money was taken.</p></div>` : ''}`;
  }
})();
