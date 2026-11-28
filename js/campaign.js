/* InviteX sharing campaigns: the "Start sharing" step and the payment gate (window.IXCampaign).
 *
 * Everything before sharing is free. When the host starts sharing an invitation with guests,
 * the database decides whether this campaign is free (charging off, a promotion, free access…)
 * or costs the configured price, paid once by UPI through Razorpay Checkout. One campaign covers
 * every guest, and resending inside it is free.
 *
 * This file never decides anything about money: it shows what the server says, opens Razorpay
 * Checkout with the order the server created, and sends the result back to the server to check.
 * In Demo/Local mode, or before supabase/billing.sql is installed, sharing is simply open. */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc, H = window.H;
  const RZP_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
  const POLL_MS = 5000, POLL_MAX = 10 * 60 * 1000;
  const C = (window.IXCampaign = { state: null, invId: null });

  const rupees = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const FREE_WHY = {
    payments_off: 'Sharing is free right now.',
    emergency: 'Sharing is free right now.',
    test_mode: 'Sharing is free right now.',
    exemption: 'You have free sharing on your account.',
    promotion: 'Free with a current offer.',
    new_user: 'Free for new accounts.',
    free_quota: 'Your first sharing campaigns are free.',
    existing: 'Included free, because this invitation was shared before paid sharing began.',
  };
  const STATUS = {
    draft: ['Not started', 'draft'], awaiting_payment: ['Waiting for payment', 'pending'], payment_pending: ['Payment being confirmed', 'maybe'],
    payment_failed: ['Payment did not go through', 'no'], ready: ['Ready to share', 'published'], sharing: ['Sharing', 'published'],
    completed: ['Finished', 'draft'], cancelled: ['Cancelled', 'draft'],
  };

  /* ---------- state ---------- */
  C.load = async (inv) => {
    C.invId = inv.id;
    try { C.state = await H.store.campaignState(inv.id); } catch (e) { C.state = { error: e.message }; }
    return C.state;
  };
  C.canShare = () => {
    const s = C.state;
    if (!s || s.error) return false;
    if (s.billing === false) return true;
    return !!(s.campaign && s.campaign.can_share);
  };
  C.isGated = () => !!(C.state && C.state.billing !== false);
  // record a share in the campaign (counts only; never blocks the host's action)
  C.markShared = (guestId, channel, action = 'share') => {
    const c = C.state && C.state.campaign;
    if (!C.isGated() || !c || !c.can_share) return;
    H.store.campaignMarkShared(c.id, guestId, channel, action).then((j) => { if (j && C.state) C.state.campaign = j; }).catch(() => {});
  };

  /* ---------- Razorpay Checkout (loaded only when a payment opens) ---------- */
  let rzpLoading = null;
  const loadCheckout = () => rzpLoading || (rzpLoading = new Promise((res, rej) => {
    if (window.Razorpay) return res();
    const s = document.createElement('script'); s.src = RZP_SRC; s.async = true;
    s.onload = () => (window.Razorpay ? res() : rej(new Error('Razorpay did not load')));
    s.onerror = () => { rzpLoading = null; rej(new Error('Could not load the Razorpay payment window. Check your internet connection.')); };
    document.head.appendChild(s);
  }));
  C.loadCheckout = loadCheckout;   // also used for designer cards (market-host.js)

  /* ---------- the panel at the top of the Share tab ----------
   * render(el, inv, onReady): draws the right step into el. Calls onReady() when sharing is open. */
  C.render = async (el, inv, onReady) => {
    let timer = null, stopAt = 0;
    const stop = () => { if (timer) clearTimeout(timer); timer = null; };
    if (H.cleanup) H.cleanup.push(stop);
    const reload = async () => { await C.load(inv); draw(); };
    const fail = (e) => IX.toast(e.message || String(e), 'bad', 6000);
    const busy = (b, on) => { if (b) { b.disabled = on; b.setAttribute('aria-busy', on ? 'true' : 'false'); } };

    const draw = () => {
      stop();
      const s = C.state || {};
      if (s.error) { el.innerHTML = `<div class="notice bad">Could not check your sharing campaign: ${esc(s.error)} <button class="btn sm" id="cmRetry">Try again</button></div>`; el.querySelector('#cmRetry').onclick = reload; return; }
      if (s.billing === false) { el.innerHTML = ''; onReady(); return; }
      const c = s.campaign, q = s.quote || {};
      const open = c && !['completed', 'cancelled'].includes(c.status);
      if (c && c.can_share) { el.innerHTML = header(c); wireHeader(c); onReady(); return; }
      if (open && ['awaiting_payment', 'payment_failed'].includes(c.status)) return payCard(c);
      if (open && c.status === 'payment_pending') return pendingCard(c);
      startCard(c, q);
    };

    // 1. Not started yet (or the last campaign finished)
    const startCard = (last, q) => {
      const charged = q.payment_required;
      const lastDone = last && last.status === 'completed' && last.entitlement_status === 'active';
      const refunded = last && last.entitlement_status === 'refunded';
      el.innerHTML = `<div class="card stack cm-card">
        <div class="cm-top"><span class="cm-ic" aria-hidden="true">📨</span><div>
          <h2 style="margin:0">${lastDone || refunded ? 'Start a new sharing campaign' : 'Ready to send your invitation?'}</h2>
          <p class="small muted" style="margin:.25rem 0 0">Your invitation, guest list and messages are ready. Starting sharing opens WhatsApp, email, link and QR sharing for <b>all your guests</b>, and lets guests open the link.</p></div></div>
        ${refunded ? '<div class="notice warn">Your last campaign was refunded. Links you already sent still work. To share with more guests, start a new campaign.</div>' : ''}
        ${charged
          ? `<div class="cm-price"><b>${rupees(q.charge_paise)}</b><span>once, by UPI</span></div>
             <ul class="cm-points small"><li>One payment covers every guest on your list.</li><li>Resending, reminders and new guests in this campaign are free.</li><li>Pay with any UPI app: scan a QR code on a computer, or pick your UPI app on a phone.</li></ul>
             ${q.mode === 'test' ? '<p class="cm-test">TEST MODE: Razorpay test payment, no real money is taken.</p>' : ''}`
          : `<div class="notice ok">${esc(FREE_WHY[q.free_reason] || 'Sharing is free right now.')}</div>`}
        <div class="row">
          <button class="btn gold lg" id="cmStart">${charged ? `Start sharing · Pay ${rupees(q.charge_paise)} by UPI` : 'Start sharing'}</button>
          ${lastDone ? '<button class="btn" id="cmReopen">Reopen last campaign (free)</button>' : ''}
        </div>
      </div>`;
      el.querySelector('#cmStart').onclick = async (e) => {
        const b = e.currentTarget; busy(b, true);
        try {
          const c = await H.store.campaignStart(inv.id, 'start-' + inv.id + '-' + Date.now());
          C.state.campaign = c;
          if (c.can_share) { IX.toast('Sharing is open. Send your invitation!', 'ok'); return draw(); }
          if (c.status === 'payment_pending') return draw();
          await pay(c, b);
        } catch (x) { fail(x); busy(b, false); }
      };
      const ro = el.querySelector('#cmReopen');
      if (ro) ro.onclick = async (e) => { busy(e.currentTarget, true); try { C.state.campaign = await H.store.campaignAction('reopen', last.id); draw(); } catch (x) { fail(x); busy(e.currentTarget, false); } };
    };

    // 2. Payment needed (first time or after a failed try)
    const payCard = (c) => {
      const failed = c.status === 'payment_failed';
      const test = c.order && c.order.is_test;
      el.innerHTML = `<div class="card stack cm-card">
        <h2 style="margin:0">Pay ${rupees(c.amount_paise)} by UPI to start sharing</h2>
        <p class="small muted" style="margin:0">${esc(c.name)}. One payment covers every guest, and resending is free.</p>
        ${failed ? '<div class="notice warn">The last payment did not go through. You can try again. A retry never charges you twice for this campaign.</div>' : ''}
        ${test || (C.state.quote && C.state.quote.mode === 'test') ? '<p class="cm-test">TEST MODE: Razorpay test payment, no real money is taken.</p>' : ''}
        <div class="row"><button class="btn gold lg" id="cmPay">${failed ? 'Try again' : 'Pay'} ${rupees(c.amount_paise)} by UPI</button>
          <button class="btn ghost" id="cmCheck">I already paid</button><button class="btn ghost" id="cmCancel">Not now</button></div>
      </div>`;
      el.querySelector('#cmPay').onclick = (e) => pay(c, e.currentTarget);
      el.querySelector('#cmCheck').onclick = (e) => check(c, e.currentTarget, true);
      el.querySelector('#cmCancel').onclick = async (e) => {
        busy(e.currentTarget, true);
        try { C.state.campaign = await H.store.campaignAction('cancel', c.id); await reload(); } catch (x) { fail(x); busy(e.currentTarget, false); }
      };
    };

    // 3. UPI payment waiting for the bank
    const pendingCard = (c) => {
      el.innerHTML = `<div class="card stack cm-card" aria-live="polite">
        <div class="row"><div class="spinner sm" aria-hidden="true"></div><h2 style="margin:0">Waiting for UPI to confirm your payment…</h2></div>
        <p class="small muted" style="margin:0">This usually takes a few seconds, sometimes a few minutes. Keep this page open, or come back later: sharing opens by itself once the payment is confirmed. You will not be charged twice.</p>
        <div class="row"><button class="btn" id="cmCheck">Check now</button></div>
      </div>`;
      el.querySelector('#cmCheck').onclick = (e) => check(c, e.currentTarget, true);
      if (!stopAt) stopAt = Date.now() + POLL_MAX;
      const tick = async () => { if (Date.now() > stopAt || !el.isConnected) return; await check(c, null, false); };
      timer = setTimeout(tick, POLL_MS);
    };

    // ask the server to check with Razorpay
    const check = async (c, btn, loud) => {
      busy(btn, true);
      try {
        const r = await H.store.payment('status', { campaign_id: c.id });
        if (loud && r.result === 'waiting') IX.toast('No payment found yet for this campaign.', 'info', 4000);
      } catch (x) { if (loud) fail(x); }
      await reload();
    };

    // open Razorpay Checkout for the server's order
    const pay = async (c, btn) => {
      busy(btn, true);
      let o;
      try { o = await H.store.payment('order', { campaign_id: c.id }); } catch (x) { fail(x); busy(btn, false); return reload(); }
      if (o.status === 'unlocked') { IX.toast('Sharing is open. Send your invitation!', 'ok'); return reload(); }
      try { await loadCheckout(); } catch (x) { fail(x); busy(btn, false); return; }
      const rzp = new window.Razorpay({
        key: o.key_id, order_id: o.order_id, amount: o.amount_paise, currency: o.currency,
        name: 'InviteX', description: (o.is_test ? '[TEST] ' : '') + 'Sharing campaign: ' + (c.name || '').slice(0, 80),
        // UPI only: a QR code on computers, the list of UPI apps on phones
        config: { display: { blocks: { upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] } }, sequence: ['block.upi'], preferences: { show_default_blocks: false } } },
        theme: { color: '#6d1f4a' },
        retry: { enabled: true },
        handler: async (resp) => {
          el.innerHTML = '<div class="card"><div class="row"><div class="spinner sm"></div><b>Checking your payment with Razorpay…</b></div></div>';
          try {
            const r = await H.store.payment('verify', { campaign_id: c.id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature });
            if (r.result === 'unlocked' || r.result === 'already_unlocked') IX.toast('Payment received. Sharing is open!', 'ok', 5000);
          } catch (x) { fail(x); }
          reload();
        },
        modal: { ondismiss: () => { busy(btn, false); check(c, null, false); } },
      });
      rzp.on('payment.failed', () => { /* Razorpay shows the reason and lets the host retry; the server records it */ });
      rzp.open();
    };

    // 4. Sharing open: the campaign strip above the sharing tools
    const header = (c) => {
      const st = STATUS[c.status] || [c.status, ''];
      const e = c.entitlement || {};
      const paid = e.grant_type === 'paid' ? `Paid ${rupees(e.amount_paise)}` : esc((FREE_WHY[e.source] || 'Free').replace(/\.$/, ''));
      return `<div class="card cm-strip">
        <div class="row between"><div><span class="lbl">Sharing campaign</span><h2 style="margin:.1rem 0 0;font-size:1.05rem">${esc(c.name)}</h2></div>
          <div class="row"><span class="pill ${st[1]}">${st[0]}</span><span class="pill">${paid}</span><button class="btn sm ghost" id="cmDone">Mark as done</button></div></div>
        <p class="tiny muted" style="margin:.4rem 0 0">${Number(c.guest_count || 0) === 1 ? 'Covers the 1 guest on your list' : `Covers all ${Number(c.guest_count || 0)} guests on your list`}. Resending and adding guests in this campaign are free. InviteX counts when you open WhatsApp or email; it cannot confirm that a WhatsApp message was delivered.</p>
      </div>`;
    };
    const wireHeader = (c) => {
      el.querySelector('#cmDone').onclick = async (e) => {
        if (!(await H.confirm('Mark this campaign as done?', 'Links you sent keep working and guests can still reply. To share again later, reopen it for free.', 'Mark as done'))) return;
        busy(e.currentTarget, true);
        try { C.state.campaign = await H.store.campaignAction('complete', c.id); H.route(); } catch (x) { fail(x); busy(e.currentTarget, false); }
      };
    };

    if (!C.state || C.invId !== inv.id) await C.load(inv);
    draw();
  };

  // a short line for places outside the Share tab (publish step, guest list)
  C.lockedNote = (inv) => {
    if (!C.isGated() || C.canShare()) return '';
    const q = (C.state && C.state.quote) || {};
    return `<div class="notice warn cm-locked">Guests can open your link once you <b>start sharing</b>${q.payment_required ? ` (${rupees(q.charge_paise)} once, by UPI, for all your guests)` : ' (free right now)'}. <a href="#/dash/${esc(inv.id)}/share">Start sharing</a></div>`;
  };
  C.rupees = rupees;
  C.FREE_WHY = FREE_WHY;
  C.STATUS = STATUS;
})();
