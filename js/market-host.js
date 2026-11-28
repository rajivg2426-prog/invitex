/* InviteX designer cards for hosts (window.IXMarket): the India-only marketplace pilot.
 *   panel / wire   the "Designer cards" choice in step 1: live designs from Indian designers,
 *                  shown with InviteX-watermarked previews until the host buys one
 *   choose         puts the design on the card: its picture, and the host's words written
 *                  into the boxes the designer marked (drawn by invite.js)
 *   ensurePaid     called before Publish: an unbought design is paid for once by UPI
 *                  (Razorpay, through the sharing-campaign Edge Function), then the
 *                  watermarked preview is swapped for the full artwork
 * The server decides the price and who owns what; publishing an unbought design is refused
 * by the database (supabase/marketplace.sql, _mk_invitation_guard). Online version only. */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc, H = window.H;
  const rs = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const REF_KEY = 'ivx-mk-ref';
  const ssGet = () => { try { return JSON.parse(sessionStorage.getItem(REF_KEY) || 'null'); } catch (e) { return null; } };
  const ssSet = (v) => { try { sessionStorage.setItem(REF_KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } };

  // A designer's sales link (index.html#/new?designer=slug&ref=code): remember it for this visit
  const q = (location.hash.split('?')[1] || '');
  if (q) {
    const p = new URLSearchParams(q);
    if (/^[a-z0-9-]{3,48}$/.test(p.get('designer') || '')) ssSet({ designer: p.get('designer'), ref: /^[A-Za-z0-9_-]{1,40}$/.test(p.get('ref') || '') ? p.get('ref') : null, at: Date.now() });
  }

  const pub = (bucket, path) => (path && H.store.sb ? H.store.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : '');
  const S = { list: null, all: false, err: '', loading: false, busy: '' };

  const M = (window.IXMarket = {
    available: () => !!(H.store && H.store.mode === 'supabase'),
    on: (inv) => !!(inv && inv.design && inv.design.market && inv.design.market.id),
    clear(inv) { if (inv && inv.design) delete inv.design.market; if (inv) delete inv.marketplace; },
    referral: () => ssGet(),
  });

  M.panel = (inv) => {
    const cur = M.on(inv) ? inv.design.market : null;
    return `<p class="small muted" style="margin:0">Cards made by designers in India, checked by InviteX. Try any of them on your card for free. You pay once, by UPI, when you publish, and the designer earns most of it.</p>
      ${cur ? `<div class="mk-cur"><img src="${esc(cur.image)}" alt=""><div class="stack" style="gap:.4rem"><b>✓ Your card uses “${esc(cur.title)}”</b>
        <span class="small muted">by ${esc(cur.designer)} · ${cur.owned ? 'bought, yours to use' : esc(rs(cur.price)) + ', paid when you publish'}</span>
        <div class="row"><button type="button" class="btn sm" data-mk-pal-next ${cur.palettes && cur.palettes.length > 1 ? '' : 'hidden'}>Next colour choice</button><button type="button" class="btn sm ghost" id="mkStop">Stop using it</button></div></div></div>` : ''}
      <div class="row between" style="gap:.5rem"><label class="check small"><input type="checkbox" id="mkAll" ${S.all ? 'checked' : ''}> Show designs for every occasion</label></div>
      <div id="mkGrid" class="mk-grid" aria-live="polite"><div class="row"><div class="spinner sm"></div><span class="small muted">Loading designer cards…</span></div></div>`;
  };

  M.wire = async (body, inv, { changed, rerender }) => {
    const grid = body.querySelector('#mkGrid'); if (!grid) return;
    const stop = body.querySelector('#mkStop');
    if (stop) stop.onclick = () => { M.clear(inv); changed(); rerender(); };
    const nx = body.querySelector('[data-mk-pal-next]');
    if (nx) nx.onclick = () => { const m = inv.design.market; m.palette = ((m.palette || 0) + 1) % m.palettes.length; changed(); };
    body.querySelector('#mkAll').onchange = (e) => { S.all = e.target.checked; S.list = null; M.wire(body, inv, { changed, rerender }); };
    if (!S.list || S.listFor !== (S.all ? '*' : inv.category)) {
      try { S.list = await H.store.call('marketplace_designs', { p_occasion: S.all ? null : inv.category }); S.listFor = S.all ? '*' : inv.category; S.err = ''; }
      catch (e) { S.list = null; S.err = /marketplace_designs|does not exist|404/.test(e.message) ? 'Designer cards are not switched on yet.' : e.message; }
    }
    if (!grid.isConnected) return;
    if (S.err) { grid.innerHTML = `<p class="small muted">${esc(S.err)}</p>`; return; }
    const ref = ssGet();
    const list = (S.list || []).slice().sort((a, b) => (ref && b.designer.slug === ref.designer ? 1 : 0) - (ref && a.designer.slug === ref.designer ? 1 : 0));
    if (!list.length) { grid.innerHTML = `<p class="small muted">No designer cards for this occasion yet.${S.all ? '' : ' Tick “every occasion” to see the others.'}</p>`; return; }
    const curId = M.on(inv) ? inv.design.market.id : '';
    grid.innerHTML = list.map((g) => {
      const front = g.previews.find((p) => p.role === 'front') || g.previews[0] || {};
      return `<button type="button" class="mk-tile ${g.id === curId ? 'on' : ''}" data-mk="${esc(g.id)}" aria-pressed="${g.id === curId}">
        <span class="mk-img"><img src="${esc(pub('designer-previews', front.preview))}" alt="" loading="lazy"></span>
        <b>${esc(g.title)}</b><small>by ${esc(g.designer.name)}</small>
        <span class="pill ${g.owned ? 'published' : ''}">${g.owned ? 'Yours' : esc(rs(g.price))}</span></button>`;
    }).join('');
    grid.querySelectorAll('[data-mk]').forEach((b) => (b.onclick = async () => {
      const g = list.find((x) => x.id === b.dataset.mk);
      if (inv.calligraphy && inv.calligraphy.active !== false && !(await H.confirm('Use this designer card?', 'Your calligraphy design will be taken off the card. It is kept, so you can switch back any time.', 'Use designer card'))) return;
      if (inv.calligraphy) inv.calligraphy.active = false;
      await M.choose(inv, g);
      changed(); rerender();
      IX.toast(g.owned ? 'Your designer card is on. Your words are written into it.' : `Try it free. You pay ${rs(g.price)} once, when you publish.`, 'ok', 5000);
    }));
  };

  M.choose = async (inv, g) => {
    const front = g.previews.find((p) => p.role === 'front') || g.previews[0] || {};
    inv.design.market = {
      id: g.id, title: g.title, designer: g.designer.name, designerSlug: g.designer.slug, price: g.price, owned: !!g.owned,
      image: pub('designer-previews', front.preview), zones: front.zones || [], w: front.w || 1000, h: front.h || 1400,
      palettes: g.palettes || [], palette: 0, fonts: g.fonts || '',
    };
    inv.marketplace = { designId: g.id };
    const pair = window.IXGallery && IXGallery.FONT_PAIRS.find((p) => p.id === g.fonts);
    if (pair) inv.design.fonts = { ...inv.design.fonts, ...pair.fonts };
    if (g.owned) await M.upgrade(inv);
  };

  // swap the watermarked preview for the full artwork (only after purchase)
  M.upgrade = async (inv) => {
    const m = inv.design.market;
    const r = await H.store.call('my_design', { p_id: m.id });
    if (!r || !r.ok) return false;
    const front = (r.design.pages || []).find((p) => p.role === 'front') || (r.design.pages || [])[0];
    if (front && front.path) { m.image = pub('designer-art', front.path); m.zones = front.zones || m.zones; m.w = front.w || m.w; m.h = front.h || m.h; }
    m.owned = true;
    return true;
  };

  /* Before Publish. Resolves true when publishing may go ahead. */
  M.ensurePaid = async (inv, save) => {
    if (!M.on(inv)) { delete inv.marketplace; return true; }
    if (!M.available()) return true;
    const m = inv.design.market;
    inv.marketplace = { designId: m.id };
    const st = await H.store.call('my_design_order_state', { p_design: m.id });
    if (!st.owned) {
      const go = await H.confirm(`Buy “${m.title}”?`,
        `This card by ${esc(m.designer)} costs <b>${esc(rs(m.price))}</b>, including GST. Pay once by UPI and use it for all your invitations. Most of it goes to the designer.`,
        `Pay ${rs(m.price)} with UPI`, false);
      if (!go) return false;
      const ok = await buy(m);
      if (!ok) return false;
      S.list = null;   // the gallery now shows it as "Yours"
    }
    await M.upgrade(inv);
    await save();
    return true;
  };

  function buy(m) {
    return new Promise(async (resolve) => {
      const fail = (e) => { IX.toast(e.message || String(e), 'bad', 6000); resolve(false); };
      const ref = ssGet();
      let o;
      try { o = await H.store.payment('design_order', { design_id: m.id, ref: ref && ref.designer === m.designerSlug ? ref.ref : null }); } catch (e) { return fail(e); }
      if (o.status === 'owned') return resolve(true);
      try { await window.IXCampaign.loadCheckout(); } catch (e) { return fail(e); }
      const status = async () => { try { const r = await H.store.payment('design_status', { design_id: m.id }); return ['unlocked', 'already_unlocked'].includes(r.result); } catch (e) { return false; } };
      const rzp = new window.Razorpay({
        key: o.key_id, order_id: o.order_id, amount: o.amount_paise, currency: o.currency,
        name: 'InviteX', description: (o.is_test ? '[TEST] ' : '') + 'Designer card: ' + String(m.title).slice(0, 80),
        config: { display: { blocks: { upi: { name: 'Pay using UPI', instruments: [{ method: 'upi' }] } }, sequence: ['block.upi'], preferences: { show_default_blocks: false } } },
        theme: { color: '#6d1f4a' }, retry: { enabled: true },
        handler: async (resp) => {
          IX.toast('Checking your payment with Razorpay…');
          try {
            const r = await H.store.payment('design_verify', { design_id: m.id, razorpay_order_id: resp.razorpay_order_id, razorpay_payment_id: resp.razorpay_payment_id, razorpay_signature: resp.razorpay_signature });
            if (['unlocked', 'already_unlocked'].includes(r.result)) { IX.toast('Payment received. The design is yours.', 'ok', 5000); return resolve(true); }
            if (r.result === 'refund_due') return fail(new Error('Something did not match, so the design was not given. Your money will be refunded within 5–7 working days.'));
            resolve(await status());
          } catch (e) { fail(e); }
        },
        modal: { ondismiss: async () => { const ok = await status(); if (!ok) IX.toast('Payment not finished. Your card is saved; publish again when you are ready.', 'info', 5000); resolve(ok); } },
      });
      rzp.open();
    });
  }
})();
