/* InviteX Admin: money screens (Overview, Sharing campaigns, Pricing, Free access, Payments,
 * Revenue, System settings). Added to the Admin page from js/admin.js.
 * Every number and change goes through the admin_* functions in supabase/billing.sql, which
 * check the role inside the database: admins can look, only the Super Admin can change prices,
 * free access or payment mode. Nothing here decides who pays. */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc, H = window.H;
  const icon = (nm) => (H.icon ? H.icon(nm) : '');
  const PAGE = 50;
  const n = (x) => Number(x || 0).toLocaleString('en-IN');
  const rs = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const IST = { timeZone: 'Asia/Kolkata' };
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
  const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); } };
  const fail = (e) => IX.toast(e.message || String(e), 'bad', 6000);
  const admin = (fn, args) => H.store.admin(fn, args || {});
  const isSuper = () => !!(H.isSuperAdmin && H.isSuperAdmin());
  // India time <-> <input type="datetime-local">
  const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 330 * 60000); return d.toISOString().slice(0, 16); };
  const fromLocalInput = (v) => (v ? v + ':00+05:30' : null);
  const SOURCE = { payment: 'Paid', payments_off: 'Free (charging off)', test_mode: 'Free (test mode)', emergency: 'Free (emergency)', exemption: 'Free (free access)', promotion: 'Free (promotion)', new_user: 'Free (new user)', free_quota: 'Free (first campaigns)', existing: 'Free (shared before billing)' };
  const STATUS = () => (window.IXCampaign && IXCampaign.STATUS) || {};
  const notSetUp = (e) => /admin_billing|admin_pricing|PGRST202|does not exist|Could not find the function/i.test(e.message || '');
  const setupHelp = '<div class="notice warn">The payments part of the database is not installed yet. In Supabase, open <b>SQL Editor</b>, paste the whole of <code>supabase/billing.sql</code> and press <b>Run</b>. The steps are in <code>docs/PAYMENTS_SETUP.md</code>.</div>';
  const superOnly = () => (isSuper() ? '' : '<div class="notice">You can look at these settings. Only the Super Admin can change them.</div>');
  const tile = (ic, label, val, sub) => `<div><span class="hx-tile-ic">${icon(ic)}</span><dt>${label}</dt><dd>${val}</dd>${sub ? `<p>${sub}</p>` : ''}</div>`;
  const filters = (name, list, on) => `<div class="hx-filters" role="group" aria-label="Show">${list.map(([k, l]) => `<button type="button" data-${name}="${k}" aria-pressed="${k === on}" class="${k === on ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const wireFilters = (body, name, cb) => body.querySelectorAll(`[data-${name}]`).forEach((b) => (b.onclick = () => {
    body.querySelectorAll(`[data-${name}]`).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    cb(b.dataset[name]);
  }));
  const guard = (fn) => async (body, ...a) => { try { await fn(body, ...a); } catch (e) { if (notSetUp(e)) body.innerHTML = setupHelp + `<p class="tiny muted" style="margin:.5rem 0 0">Details from the database: ${esc(e.message || String(e))}</p>`; else throw e; } };

  /* ================= Overview ================= */
  async function overview(body) {
    const o = await admin('billing_overview');
    const p = o.policy || {}, U = o.users || {}, Cm = o.campaigns || {}, Pm = o.payments || {}, T = o.test || {};
    const charging = p.emergency_free ? '<span class="pill no">Emergency: everything free</span>' : p.payment_required ? `<span class="pill published">Charging ON · ${rs(p.price_paise)} per campaign</span>` : '<span class="pill">Charging OFF · sharing is free</span>';
    body.innerHTML = `
      <section class="hx-panel ab-policy">
        <div class="row between"><div class="row">${charging}${p.mode === 'test' ? '<span class="pill maybe">TEST MODE · only admins are asked to pay, with test money</span>' : '<span class="pill no">LIVE · real payments</span>'}</div>
        <a class="btn sm" href="#/admin/pricing">Pricing control</a></div>
        <p class="tiny muted" style="margin:0">${n(o.promotions_active)} promotion${o.promotions_active === 1 ? '' : 's'} running · ${n(o.exemptions_active)} ${o.exemptions_active === 1 ? 'person has' : 'people have'} free access · Times are India time.</p>
      </section>
      <dl class="hx-tiles" aria-label="Users and campaigns">
        ${tile('users', 'Users', n(U.total), `${n(U.active30)} active this month · ${n(U.new7)} new this week`)}
        ${tile('send', 'Invitations', n(o.invitations), '')}
        ${tile('calendar', 'Sharing campaigns', n(Cm.total), `${n(Cm.open)} sharing now · ${n(Cm.awaiting)} waiting for payment`)}
        ${tile('check', 'Paid campaigns', n(Cm.paid), `${n(Cm.complimentary)} complimentary`)}
      </dl>
      <dl class="hx-tiles" aria-label="Payments">
        ${tile('chart', 'Revenue', rs(Pm.revenue_paise), `Refunds ${rs(Pm.refunds_paise)} · average ${rs(Pm.average_paise)}`)}
        ${tile('check', 'Successful payments', n(Pm.successful), '')}
        ${tile('alert', 'Failed payments', n(Pm.failed), Pm.flagged ? `<b>${n(Pm.flagged)} need a look</b> (<a href="#/admin/payments/flagged">see</a>)` : '')}
        ${tile('clock', 'Pending payments', n(Pm.pending), 'UPI still confirming')}
      </dl>
      <p class="tiny muted">Real money only. Test payments: ${n(T.successful)} (${rs(T.revenue_paise)}), shown separately on <a href="#/admin/payments">Payments</a> and <a href="#/admin/revenue">Revenue</a>.</p>`;
  }

  /* ================= Sharing campaigns ================= */
  async function campaigns(body) {
    const S = { q: '', status: 'all', rows: [], total: 0 };
    body.innerHTML = `<section class="hx-panel">
      <div class="ax-tools">${filters('st', [['all', 'All'], ['unlocked', 'Unlocked'], ['awaiting_payment', 'Awaiting payment'], ['payment_pending', 'Pending'], ['payment_failed', 'Failed'], ['completed', 'Finished'], ['cancelled', 'Cancelled']], 'all')}
        <label class="hx-search">${icon('search')}<span class="sr-only">Search campaigns</span><input id="axQ" type="search" placeholder="Search by campaign or owner email" autocomplete="off"></label>
        <span class="small muted" id="axCount" aria-live="polite"></span></div>
      <div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col">Cost</th><th scope="col" class="num">Guests</th><th scope="col" class="num">Shares</th><th scope="col" class="num">Replies</th><th scope="col">Started</th></tr></thead><tbody id="axRows"></tbody></table></div>
      <div class="row" id="axMoreRow" hidden><button class="btn" id="axMore">Show more</button></div></section>`;
    const load = async (more) => {
      const r = await admin('campaigns', { p_q: S.q, p_status: S.status, p_limit: PAGE, p_offset: more ? S.rows.length : 0 });
      S.rows = more ? S.rows.concat(r.rows) : r.rows; S.total = r.total;
      body.querySelector('#axCount').textContent = `${n(S.total)} ${S.total === 1 ? 'campaign' : 'campaigns'}`;
      body.querySelector('#axRows').innerHTML = S.rows.length ? S.rows.map((c) => {
        const st = STATUS()[c.status] || [c.status, ''], e = c.entitlement || {}, k = c.stats || {};
        return `<tr><td><div class="ax-acc"><b>${esc(c.name)}</b><span class="tiny muted">${esc(c.owner_email || '')}${c.slug ? ' · /' + esc(c.slug) : ''}</span></div></td>
          <td><span class="pill ${st[1]}">${esc(st[0])}</span>${c.entitlement_status === 'refunded' ? ' <span class="pill">Refunded</span>' : ''}</td>
          <td>${e.grant_type === 'paid' ? rs(e.amount_paise) : e.source ? esc(SOURCE[e.source] || 'Free') : c.amount_paise ? rs(c.amount_paise) + ' due' : '—'}${c.order && c.order.is_test ? ' <span class="pill">TEST</span>' : ''}</td>
          <td class="num">${n(c.guest_count)}</td><td class="num">${n(Number(k.shared || 0) + Number(k.general_shares || 0))}</td><td class="num">${n(k.replies)}</td><td>${esc(day(c.created_at))}</td></tr>`;
      }).join('') : '<tr><td colspan="7" class="muted">No sharing campaigns match.</td></tr>';
      body.querySelector('#axMoreRow').hidden = S.rows.length >= S.total;
    };
    wireFilters(body, 'st', (v) => { S.status = v; load(false).catch(fail); });
    let t; body.querySelector('#axQ').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); load(false).catch(fail); }, 250); };
    body.querySelector('#axMore').onclick = (e) => { busy(e.target, true); load(true).catch(fail).finally(() => busy(e.target, false)); };
    await load(false);
  }

  /* ================= Pricing control ================= */
  async function pricing(body) {
    const r = await admin('pricing');
    const p = r.current || {}, can = isSuper();
    const dis = can ? '' : 'disabled';
    body.innerHTML = `${superOnly()}
      <form class="hx-panel stack" id="pf">
        <h3 style="margin:0">Charging</h3>
        <label class="ab-switch"><input type="checkbox" id="pOn" ${p.payment_required ? 'checked' : ''} ${dis}><span><b>Ask for payment when a host starts a new sharing campaign</b><br><small class="muted">Off: every new campaign is free. Campaigns already paid or unlocked are never affected.</small></span></label>
        <div class="field" style="max-width:560px"><label for="pPrice">Price per sharing campaign (₹10 to ₹100, whole rupees)</label>
          <div class="row"><span class="ab-rupee">₹</span><input class="input" id="pPrice" type="number" inputmode="numeric" min="10" max="100" step="1" value="${p.price_paise / 100}" style="width:110px" ${dis}>
          ${[10, 20, 50, 100].map((v) => `<button type="button" class="btn sm ghost" data-quick="${v}" ${dis}>₹${v}</button>`).join('')}</div>
          <span class="hint" id="pHint">Suggested: ₹20.</span></div>
        <div class="field"><span class="lbl">Charging model</span><p style="margin:.2rem 0 0">Per sharing campaign: one payment unlocks one campaign for one invitation, for any number of guests.</p></div>
        <div class="field"><span class="lbl">Payment method</span><p style="margin:.2rem 0 0">UPI only, through Razorpay (QR code on computers, UPI apps on phones).</p></div>
        <div class="field"><label for="pNote">Note for the audit log (optional)</label><input class="input" id="pNote" maxlength="300" placeholder="For example: festival price" ${dis}></div>
        <p class="tiny muted" style="margin:0">A change applies to campaigns started after you save. A payment already in progress keeps its price. Free promotions and free access sit on top of this and do not change it.</p>
        ${can ? '<div><button class="btn primary" type="submit">Save pricing</button></div>' : ''}
      </form>
      <section class="hx-panel"><div class="hx-panel-h"><h3>History</h3><span class="tiny muted">Newest first</span></div>
        <div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr><th scope="col">From</th><th scope="col">Charging</th><th scope="col">Price</th><th scope="col">Mode</th><th scope="col">Changed by</th><th scope="col">Note</th></tr></thead><tbody>
        ${(r.history || []).map((h, i) => `<tr${i === 0 ? ' class="ax-now"' : ''}><td>${esc(stamp(h.created_at))}${i === 0 ? ' <span class="tiny muted">(now)</span>' : ''}</td><td>${h.emergency_free ? 'Emergency free' : h.payment_required ? 'On' : 'Off'}</td><td>${rs(h.price_paise)}</td><td>${h.mode === 'live' ? 'Live' : 'Test'}</td><td>${esc(h.created_by_email || 'setup')}</td><td>${esc(h.note || '')}</td></tr>`).join('')}
        </tbody></table></div></section>`;
    const price = body.querySelector('#pPrice'), hint = body.querySelector('#pHint');
    const valid = () => { const v = Number(price.value); const okv = Number.isInteger(v) && v >= 10 && v <= 100; hint.innerHTML = okv ? 'Suggested: ₹20.' : '<span class="err">Use a whole number from 10 to 100.</span>'; price.setAttribute('aria-invalid', okv ? 'false' : 'true'); return okv; };
    price.oninput = valid;
    body.querySelectorAll('[data-quick]').forEach((b) => (b.onclick = () => { price.value = b.dataset.quick; valid(); }));
    if (!can) return;
    body.querySelector('#pf').onsubmit = async (e) => {
      e.preventDefault();
      if (!valid()) return price.focus();
      const on = body.querySelector('#pOn').checked, v = Number(price.value);
      if (on !== p.payment_required && !(await H.confirm(on ? 'Turn charging on?' : 'Turn charging off?', on ? `New sharing campaigns will cost <b>₹${v}</b>${p.mode === 'test' ? ' (in test mode only admins are asked to pay)' : ''}.` : 'New sharing campaigns will be free until you turn it back on.', on ? 'Turn on' : 'Turn off'))) return;
      busy(e.submitter, true);
      try { await admin('set_pricing', { p: { payment_required: on, price_rupees: v, note: body.querySelector('#pNote').value } }); IX.toast('Pricing saved', 'ok'); await pricing(body); } catch (x) { fail(x); busy(e.submitter, false); }
    };
  }

  /* ================= Free access ================= */
  async function free(body, email) {
    const [r, promos, ex] = await Promise.all([admin('pricing'), admin('promotions'), admin('exemptions', { p_q: '' })]);
    const p = r.current || {}, can = isSuper(), dis = can ? '' : 'disabled';
    const audience = { everyone: 'Everyone', new_users: 'New users (joined during the promotion)', selected: 'Selected people' };
    body.innerHTML = `${superOnly()}
      <section class="hx-panel stack ab-emergency">
        <h3 style="margin:0">Emergency free access</h3>
        <label class="ab-switch"><input type="checkbox" id="fEm" ${p.emergency_free ? 'checked' : ''} ${dis}><span><b>Make all new sharing campaigns free, right now</b><br><small class="muted">For outages or apologies. It overrides the price until you switch it off.</small></span></label>
      </section>
      <form class="hx-panel stack" id="ff">
        <h3 style="margin:0">Standing free rules</h3>
        <div class="grid2">
          <div class="field"><label for="fNew">New users share free for (days after sign-up)</label><input class="input" id="fNew" type="number" min="0" max="365" value="${p.new_user_free_days}" ${dis}><span class="hint">0 = off.</span></div>
          <div class="field"><label for="fFirst">Each person's first campaigns that are free</label><input class="input" id="fFirst" type="number" min="0" max="100" value="${p.free_campaigns_per_user}" ${dis}><span class="hint">0 = off. For example 1 = the first campaign is free.</span></div>
        </div>
        ${can ? '<div><button class="btn primary" type="submit">Save free rules</button></div>' : ''}
      </form>
      <section class="hx-panel stack">
        <div class="row between"><h3 style="margin:0">Promotions</h3>${can ? '<button class="btn sm primary" id="fPromoNew">New promotion</button>' : ''}</div>
        <p class="tiny muted" style="margin:0">A promotion makes sharing free between its start and end (India time). When it ends, the normal price applies again by itself.</p>
        ${promos.length ? `<div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr><th scope="col">Promotion</th><th scope="col">When</th><th scope="col">Who</th><th scope="col" class="num">Used</th><th scope="col">Status</th><th scope="col"></th></tr></thead><tbody>
          ${promos.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td class="small">${esc(stamp(x.starts_at))} → ${esc(stamp(x.ends_at))}</td><td class="small">${esc(audience[x.audience] || x.audience)}${x.audience === 'selected' ? ` (${n((x.emails || []).length)})` : ''}</td>
            <td class="num">${n(x.used_count)}${x.total_quota ? ' / ' + n(x.total_quota) : ''}${x.per_user_quota ? `<div class="tiny muted">${n(x.per_user_quota)} each</div>` : ''}</td>
            <td>${x.running ? '<span class="pill published">Running</span>' : !x.active ? '<span class="pill">Switched off</span>' : new Date(x.starts_at) > new Date() ? '<span class="pill pending">Scheduled</span>' : '<span class="pill draft">Ended</span>'}</td>
            <td class="acts">${can ? `<button class="btn sm" data-edit="${esc(x.id)}">Edit</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted" style="margin:0">No promotions yet.</p>'}
      </section>
      <section class="hx-panel stack">
        <h3 style="margin:0">Free access for selected people</h3>
        ${can ? `<form class="grid2" id="fx">
          <div class="field"><label for="fxE">Account email</label><input class="input" id="fxE" type="email" required value="${esc(email || '')}"></div>
          <div class="field"><label for="fxR">Reason (kept in the audit log)</label><input class="input" id="fxR" required maxlength="300" placeholder="For example: NGO partner"></div>
          <div class="field"><label for="fxU">Free until (optional)</label><input class="input" id="fxU" type="date"></div>
          <div class="field"><label for="fxQ">Number of free campaigns</label><input class="input" id="fxQ" type="number" min="0" max="1000" value="0"><span class="hint">0 = no limit.</span></div>
          <div><button class="btn primary" type="submit">Give free access</button></div></form>` : ''}
        ${ex.length ? `<div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr><th scope="col">Account</th><th scope="col">Reason</th><th scope="col">Until</th><th scope="col" class="num">Used</th><th scope="col">Status</th><th scope="col"></th></tr></thead><tbody>
          ${ex.map((x) => `<tr><td>${esc(x.email)}</td><td class="small">${esc(x.reason)}</td><td>${x.ends_at ? esc(day(x.ends_at)) : 'No end'}</td><td class="num">${n(x.used_count)}${x.campaign_quota ? ' / ' + n(x.campaign_quota) : ''}</td>
            <td>${x.revoked_at ? '<span class="pill draft">Ended</span>' : x.in_force ? '<span class="pill published">Active</span>' : '<span class="pill">Used up or expired</span>'}</td>
            <td class="acts">${can && !x.revoked_at ? `<button class="btn sm danger" data-revoke="${esc(x.id)}">End</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted" style="margin:0">Nobody has free access yet.</p>'}
        <p class="tiny muted" style="margin:0">Ending free access never takes back campaigns already unlocked with it.</p>
      </section>`;
    if (!can) return;
    const again = () => free(body, '');
    body.querySelector('#fEm').onchange = async (e) => {
      const on = e.target.checked;
      if (!(await H.confirm(on ? 'Make all sharing free now?' : 'End emergency free access?', on ? 'Every new sharing campaign will be free until you switch this off.' : 'New sharing campaigns will follow your normal price again.', on ? 'Make free' : 'End it', on))) { e.target.checked = !on; return; }
      try { await admin('set_pricing', { p: { emergency_free: on, note: on ? 'Emergency free access on' : 'Emergency free access off' } }); IX.toast(on ? 'All new sharing is free' : 'Normal pricing is back', 'ok'); } catch (x) { fail(x); e.target.checked = !on; }
    };
    body.querySelector('#ff').onsubmit = async (e) => {
      e.preventDefault(); busy(e.submitter, true);
      try { await admin('set_pricing', { p: { new_user_free_days: Number(body.querySelector('#fNew').value || 0), free_campaigns_per_user: Number(body.querySelector('#fFirst').value || 0) } }); IX.toast('Free rules saved', 'ok'); await again(); } catch (x) { fail(x); busy(e.submitter, false); }
    };
    const promoForm = (x) => H.modal({
      title: x ? 'Edit promotion' : 'New promotion', wide: true,
      body: `<div class="stack">
        <div class="field"><label for="pmN">Name</label><input class="input" id="pmN" maxlength="120" value="${esc(x ? x.name : '')}" placeholder="For example: Diwali week"></div>
        <div class="grid2"><div class="field"><label for="pmS">Starts (India time)</label><input class="input" id="pmS" type="datetime-local" value="${esc(toLocalInput(x ? x.starts_at : new Date().toISOString()))}"></div>
          <div class="field"><label for="pmE">Ends (India time)</label><input class="input" id="pmE" type="datetime-local" value="${esc(toLocalInput(x ? x.ends_at : new Date(Date.now() + 7 * 864e5).toISOString()))}"></div></div>
        <div class="field"><label for="pmA">Who gets it</label><select class="input" id="pmA">${Object.entries(audience).map(([k, l]) => `<option value="${k}" ${x && x.audience === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field" id="pmEmailsF" ${x && x.audience === 'selected' ? '' : 'hidden'}><label for="pmEm">Emails of the selected people (one per line)</label><textarea class="input" id="pmEm" rows="4">${esc(((x && x.emails) || []).join('\n'))}</textarea></div>
        <div class="grid2"><div class="field"><label for="pmT">Free campaigns in total</label><input class="input" id="pmT" type="number" min="0" value="${x ? x.total_quota : 0}"><span class="hint">0 = no limit.</span></div>
          <div class="field"><label for="pmP">Free campaigns per person</label><input class="input" id="pmP" type="number" min="0" value="${x ? x.per_user_quota : 1}"><span class="hint">0 = no limit.</span></div></div>
        <label class="check"><input type="checkbox" id="pmOn" ${!x || x.active ? 'checked' : ''}> Active</label>
      </div>`,
      onOpen: (m) => { m.querySelector('#pmA').onchange = (e) => { m.querySelector('#pmEmailsF').hidden = e.target.value !== 'selected'; }; },
      actions: [{ label: 'Cancel', value: null }, { label: 'Save promotion', cls: 'primary', onClick: (m) => ({
        id: x ? x.id : '', name: m.querySelector('#pmN').value, starts_at: fromLocalInput(m.querySelector('#pmS').value), ends_at: fromLocalInput(m.querySelector('#pmE').value),
        audience: m.querySelector('#pmA').value, emails: m.querySelector('#pmEm').value.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean),
        total_quota: Number(m.querySelector('#pmT').value || 0), per_user_quota: Number(m.querySelector('#pmP').value || 0), active: m.querySelector('#pmOn').checked }) }],
    }).then(async (v) => {
      if (!v) return;
      if (!v.name.trim() || !v.starts_at || !v.ends_at) return IX.toast('Give a name, a start and an end.', 'bad');
      try { const res = await admin('save_promotion', { p: v }); IX.toast('Promotion saved', 'ok'); if (res.not_found && res.not_found.length) IX.toast('No account for: ' + res.not_found.join(', '), 'warn', 7000); await again(); } catch (x2) { fail(x2); }
    });
    const nb = body.querySelector('#fPromoNew'); if (nb) nb.onclick = () => promoForm(null);
    body.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => promoForm(promos.find((x) => x.id === b.dataset.edit))));
    body.querySelector('#fx').onsubmit = async (e) => {
      e.preventDefault(); busy(e.submitter, true);
      const until = body.querySelector('#fxU').value;
      try {
        await admin('grant_exemption', { p_email: body.querySelector('#fxE').value, p_reason: body.querySelector('#fxR').value, p_ends_at: until ? until + 'T23:59:59+05:30' : null, p_quota: Number(body.querySelector('#fxQ').value || 0) });
        IX.toast('Free access given', 'ok'); await again();
      } catch (x) { fail(x); busy(e.submitter, false); }
    };
    body.querySelectorAll('[data-revoke]').forEach((b) => (b.onclick = async () => {
      if (!(await H.confirm('End this free access?', 'New campaigns will follow the normal price. Campaigns already unlocked stay unlocked.', 'End free access', true))) return;
      busy(b, true); try { await admin('revoke_exemption', { p_id: b.dataset.revoke }); IX.toast('Free access ended', 'ok'); await again(); } catch (x) { fail(x); busy(b, false); }
    }));
  }

  /* ================= Payment transactions ================= */
  const PAYST = { captured: ['Paid', 'published'], authorized: ['Pending', 'pending'], created: ['Started', 'pending'], failed: ['Failed', 'no'], refunded: ['Refunded', 'draft'], partially_refunded: ['Part refunded', 'maybe'] };
  const FLAG = { amount_mismatch: 'Amount did not match: not unlocked', duplicate_refund_due: 'Paid twice: refund due' };
  async function payments(body, first) {
    const S = { q: '', status: ['all', 'paid', 'pending', 'failed', 'refunded', 'flagged'].includes(first) ? first : 'all', from: '', to: '', test: false, rows: [], total: 0 };
    body.innerHTML = `<section class="hx-panel">
      <div class="ax-tools">${filters('ps', [['all', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['failed', 'Failed'], ['refunded', 'Refunded'], ['flagged', 'Needs a look']], S.status)}
        <label class="hx-search">${icon('search')}<span class="sr-only">Search payments</span><input id="axQ" type="search" placeholder="Email, campaign or Razorpay id" autocomplete="off"></label></div>
      <div class="ax-tools"><label class="small">From <input class="input" type="date" id="pFrom"></label><label class="small">To <input class="input" type="date" id="pTo"></label>
        <label class="check small"><input type="checkbox" id="pTest"> Show test payments instead</label>
        <button class="btn sm" id="pCsv">Download CSV</button><span class="small muted" id="axCount" aria-live="polite"></span></div>
      <div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr><th scope="col">When</th><th scope="col">Account</th><th scope="col">Campaign</th><th scope="col" class="num">Amount</th><th scope="col">Status</th><th scope="col">Razorpay</th></tr></thead><tbody id="axRows"></tbody></table></div>
      <div class="row" id="axMoreRow" hidden><button class="btn" id="axMore">Show more</button></div></section>`;
    const args = (more, limit) => ({ p_q: S.q, p_status: S.status, p_from: S.from || null, p_to: S.to || null, p_test: S.test, p_limit: limit || PAGE, p_offset: more ? S.rows.length : 0 });
    const status = (x) => { const st = x.payment_status ? PAYST[x.payment_status] || [x.payment_status, ''] : x.order_status === 'expired' ? ['Not paid', 'draft'] : x.order_status === 'failed' ? ['Could not start', 'no'] : ['Waiting', 'pending']; return st; };
    const load = async (more) => {
      const r = await admin('payments', args(more));
      S.rows = more ? S.rows.concat(r.rows) : r.rows; S.total = r.total;
      body.querySelector('#axCount').textContent = `${n(S.total)} ${S.test ? 'test ' : ''}${S.total === 1 ? 'entry' : 'entries'}`;
      body.querySelector('#axRows').innerHTML = S.rows.length ? S.rows.map((x) => { const st = status(x); return `<tr>
        <td class="small">${esc(stamp(x.created_at))}</td><td>${esc(x.email)}</td><td class="small">${esc(x.campaign_name)}</td>
        <td class="num">${rs(x.amount_paise || x.order_amount_paise)}${x.amount_refunded_paise ? `<div class="tiny muted">refunded ${rs(x.amount_refunded_paise)}</div>` : ''}</td>
        <td><span class="pill ${st[1]}">${st[0]}</span>${x.is_test ? ' <span class="pill">TEST</span>' : ''}${x.flag ? `<div class="tiny err">${esc(FLAG[x.flag] || x.flag)}</div>` : ''}${x.error_description && x.payment_status === 'failed' ? `<div class="tiny muted">${esc(x.error_description)}</div>` : ''}</td>
        <td class="tiny">${esc(x.provider_payment_id || '')}<div class="muted">${esc(x.provider_order_id || '')}</div></td></tr>`; }).join('') : '<tr><td colspan="6" class="muted">No payments match.</td></tr>';
      body.querySelector('#axMoreRow').hidden = S.rows.length >= S.total;
    };
    wireFilters(body, 'ps', (v) => { S.status = v; load(false).catch(fail); });
    let t; body.querySelector('#axQ').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); load(false).catch(fail); }, 250); };
    body.querySelector('#pFrom').onchange = (e) => { S.from = e.target.value; load(false).catch(fail); };
    body.querySelector('#pTo').onchange = (e) => { S.to = e.target.value; load(false).catch(fail); };
    body.querySelector('#pTest').onchange = (e) => { S.test = e.target.checked; load(false).catch(fail); };
    body.querySelector('#axMore').onclick = (e) => { busy(e.target, true); load(true).catch(fail).finally(() => busy(e.target, false)); };
    body.querySelector('#pCsv').onclick = async (e) => {
      busy(e.target, true);
      try {
        const r = await admin('payments', args(false, 5000));
        const rows = [['Date (India time)', 'Account', 'Campaign', 'Order amount (₹)', 'Payment amount (₹)', 'Refunded (₹)', 'Status', 'Method', 'Flag', 'Test', 'Razorpay payment id', 'Razorpay order id']]
          .concat(r.rows.map((x) => [stamp(x.created_at), x.email, x.campaign_name, (x.order_amount_paise || 0) / 100, (x.amount_paise || 0) / 100, (x.amount_refunded_paise || 0) / 100, status(x)[0], x.method || '', x.flag ? FLAG[x.flag] : '', x.is_test ? 'yes' : 'no', x.provider_payment_id || '', x.provider_order_id || '']));
        IX.download(`invitex-payments${S.test ? '-test' : ''}-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + IX.toCSV(rows), 'text/csv;charset=utf-8');
      } catch (x) { fail(x); } finally { busy(e.target, false); }
    };
    await load(false);
  }

  /* ================= Revenue ================= */
  async function revenue(body) {
    const S = { days: 30, test: false };
    body.innerHTML = `<section class="hx-panel"><div class="ax-tools">${filters('rd', [['7', '7 days'], ['30', '30 days'], ['90', '90 days']], '30')}
      <label class="check small"><input type="checkbox" id="rTest"> Test payments instead</label></div><div id="rBody"></div></section>`;
    const draw = async () => {
      const r = await admin('revenue', { p_days: S.days, p_test: S.test });
      const days = r.days || [];
      const tot = days.reduce((a, d) => ({ pay: a.pay + Number(d.payments), rev: a.rev + Number(d.revenue_paise), ref: a.ref + Number(d.refunds_paise), free: a.free + Number(d.free_campaigns) }), { pay: 0, rev: 0, ref: 0, free: 0 });
      const max = Math.max(1, ...days.map((d) => Number(d.revenue_paise)));
      const W = 720, Hh = 160, bw = W / Math.max(days.length, 1);
      const bars = days.map((d, i) => { const h = Math.round((Number(d.revenue_paise) / max) * (Hh - 20)); return `<rect x="${(i * bw + 1).toFixed(1)}" y="${Hh - h}" width="${Math.max(bw - 2, 1).toFixed(1)}" height="${h}" rx="2" fill="currentColor"><title>${esc(day(d.day + 'T12:00:00+05:30'))}: ${rs(d.revenue_paise)} from ${n(d.payments)} payments</title></rect>`; }).join('');
      const src = r.by_source || {};
      body.querySelector('#rBody').innerHTML = `
        <dl class="hx-tiles">${tile('chart', S.test ? 'Test revenue' : 'Revenue', rs(tot.rev), `${n(tot.pay)} payments`)}${tile('alert', 'Refunds', rs(tot.ref), '')}${tile('check', 'Net', rs(tot.rev - tot.ref), '')}${tile('spark', 'Free campaigns', n(tot.free), 'complimentary unlocks')}</dl>
        <figure class="ab-chart" aria-label="Revenue per day"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Revenue per day, last ${S.days} days">${bars}</svg>
          <figcaption class="tiny muted">Revenue per day (India time), last ${S.days} days. Highest day ${rs(max)}.</figcaption></figure>
        <div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr><th scope="col">Day</th><th scope="col" class="num">Payments</th><th scope="col" class="num">Revenue</th><th scope="col" class="num">Refunds</th><th scope="col" class="num">Free campaigns</th></tr></thead><tbody>
          ${days.slice().reverse().filter((d) => Number(d.payments) || Number(d.refunds_paise) || Number(d.free_campaigns)).map((d) => `<tr><td>${esc(day(d.day + 'T12:00:00+05:30'))}</td><td class="num">${n(d.payments)}</td><td class="num">${rs(d.revenue_paise)}</td><td class="num">${rs(d.refunds_paise)}</td><td class="num">${n(d.free_campaigns)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nothing in this period.</td></tr>'}
        </tbody></table></div>
        <p class="small muted">Unlocked campaigns in this period by reason: ${Object.keys(src).length ? Object.entries(src).map(([k, v]) => `${esc(SOURCE[k] || k)} ${n(v)}`).join(' · ') : 'none'}.</p>`;
    };
    wireFilters(body, 'rd', (v) => { S.days = Number(v); draw().catch(fail); });
    body.querySelector('#rTest').onchange = (e) => { S.test = e.target.checked; draw().catch(fail); };
    await draw();
  }

  /* ================= System settings ================= */
  async function system(body) {
    const r = await admin('pricing');
    const p = r.current || {}, can = isSuper(), dis = can ? '' : 'disabled';
    body.innerHTML = `${superOnly()}
      <section class="hx-panel stack">
        <h3 style="margin:0">Payment mode</h3>
        <p style="margin:0">Now: ${p.mode === 'live' ? '<span class="pill no">LIVE · real payments</span>' : '<span class="pill maybe">TEST · Razorpay test money only</span>'}</p>
        <p class="small muted" style="margin:0">In test mode, only admin accounts are asked to pay, with Razorpay test money, so you can try the whole flow. Every other host shares free.
          Live mode takes real money from every host. It needs your approval here, live Razorpay keys on the server, and the <code>PAYMENTS_LIVE_ALLOWED</code> server secret. See <code>docs/PAYMENTS_GO_LIVE.md</code>.</p>
        ${can ? (p.mode === 'live'
          ? '<div><button class="btn" id="sTest">Switch back to test mode</button></div>'
          : `<form class="stack" id="sLive"><div class="field"><label for="sConfirm">To switch to live, type: <b>I approve live payments</b></label><input class="input" id="sConfirm" autocomplete="off"></div><div><button class="btn danger" type="submit">Switch to live payments</button></div></form>`) : ''}
      </section>
      <form class="hx-panel stack" id="sf">
        <h3 style="margin:0">Campaign rules</h3>
        <div class="grid2">
          <div class="field"><label for="sGrace">A campaign closes this many days after the last event</label><input class="input" id="sGrace" type="number" min="0" max="90" value="${p.campaign_grace_days}" ${dis}><span class="hint">Links keep working after it closes. A new campaign needs a new payment.</span></div>
          <div class="field"><label for="sCap">Guest limit per campaign</label><input class="input" id="sCap" type="number" min="0" max="100000" value="${p.guest_cap}" ${dis}><span class="hint">0 = no limit (recommended). Shown for later; not enforced yet.</span></div>
        </div>
        ${can ? '<div><button class="btn primary" type="submit">Save</button></div>' : ''}
      </form>
      <section class="hx-panel stack"><h3 style="margin:0">Payment provider</h3>
        <p style="margin:0">Razorpay Standard Checkout, UPI only. Server keys: <code>RAZORPAY_KEY_ID</code>, <code>RAZORPAY_KEY_SECRET</code>, <code>RAZORPAY_WEBHOOK_SECRET</code> (Supabase Edge Function secrets; never in this website).</p>
        <p class="tiny muted" style="margin:0">Setup steps: <code>docs/PAYMENTS_SETUP.md</code>.</p></section>`;
    if (!can) return;
    body.querySelector('#sf').onsubmit = async (e) => {
      e.preventDefault(); busy(e.submitter, true);
      try { await admin('set_pricing', { p: { campaign_grace_days: Number(body.querySelector('#sGrace').value || 0), guest_cap: Number(body.querySelector('#sCap').value || 0) } }); IX.toast('Saved', 'ok'); await system(body); } catch (x) { fail(x); busy(e.submitter, false); }
    };
    const live = body.querySelector('#sLive');
    if (live) live.onsubmit = async (e) => {
      e.preventDefault();
      if (!(await H.confirm('Take real money?', 'Every host will be asked to pay real money by UPI when charging is on. Make sure the go-live checklist is done.', 'Switch to live', true))) return;
      busy(e.submitter, true);
      try { await admin('set_pricing', { p: { mode: 'live', confirm_live: body.querySelector('#sConfirm').value, note: 'Switched to live payments' } }); IX.toast('Live payments switched on', 'ok'); await system(body); } catch (x) { fail(x); busy(e.submitter, false); }
    };
    const bt = body.querySelector('#sTest');
    if (bt) bt.onclick = async () => { busy(bt, true); try { await admin('set_pricing', { p: { mode: 'test', note: 'Back to test mode' } }); IX.toast('Back in test mode', 'ok'); await system(body); } catch (x) { fail(x); busy(bt, false); } };
  }

  /* ---------- register with the Admin page ---------- */
  const T = H.adminTabs;
  if (!T) return;
  const usage = T.find((t) => t[0] === 'usage'), activity = T.find((t) => t[0] === 'activity');
  if (usage) { usage[1] = 'Usage analytics'; }
  if (activity) { activity[1] = 'Audit log'; }
  const order = [
    ['overview', 'Overview', 'chart', 'Users, campaigns and payments at a glance.'],
    T.find((t) => t[0] === 'users'),
    T.find((t) => t[0] === 'invitations'),
    ['campaigns', 'Sharing campaigns', 'send', 'Every sharing campaign, paid or free.'],
    ['pricing', 'Pricing control', 'spark', 'The payment switch and the price per sharing campaign.'],
    ['free', 'Free access', 'check', 'Emergency free access, promotions and free access for selected people.'],
    ['payments', 'Payment transactions', 'clock', 'Every UPI payment attempt through Razorpay.'],
    ['revenue', 'Revenue reports', 'chart', 'Money in and out, day by day (India time).'],
    usage,
    ['system', 'System settings', 'alert', 'Payment mode and campaign rules.'],
    activity,
  ].filter(Boolean);
  T.splice(0, T.length, ...order);
  Object.assign(H.adminScreens, { overview: guard(overview), campaigns: guard(campaigns), pricing: guard(pricing), free: guard(free), payments: guard(payments), revenue: guard(revenue), system: guard(system) });
})();
