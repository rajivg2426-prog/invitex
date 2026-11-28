/* InviteX Admin: designer marketplace (pilot, India only).
 * Two screens on the Admin page:
 *   Designers – applications to approve or turn down
 *   Design review – submitted designs: approve, ask for changes, reject (optionally pausing the designer)
 * Every decision goes through the admin_* functions in supabase/marketplace.sql, which check the
 * admin role inside the database and write the activity log. */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc, H = window.H;
  const icon = (nm) => (H.icon ? H.icon(nm) : '');
  const rs = (paise) => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const IST = { timeZone: 'Asia/Kolkata' };
  const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { ...IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
  const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); } };
  const fail = (e) => IX.toast(e.message || String(e), 'bad', 6000);
  const admin = (fn, args) => H.store.admin(fn, args || {});
  const notSetUp = (e) => /admin_design|admin_designer|PGRST202|does not exist|Could not find the function/i.test(e.message || '');
  const setupHelp = '<div class="notice warn">The designer marketplace is not installed in the database yet. In Supabase, open <b>SQL Editor</b>, paste the whole of <code>supabase/marketplace.sql</code> and press <b>Run</b>.</div>';
  const guard = (fn) => async (body, ...a) => { try { await fn(body, ...a); } catch (e) { if (notSetUp(e)) body.innerHTML = setupHelp; else throw e; } };
  const filters = (list, on) => `<div class="hx-filters" role="group" aria-label="Show">${list.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === on}" class="${k === on ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const publicUrl = (bucket, path) => (path && H.store.sb ? H.store.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl : '');

  const REASONS = [
    'Not original, or copied from another design',
    'Low resolution or blurry',
    'Text areas do not fit on a phone',
    'Religious or cultural concern',
    'Uses fonts or stock images without rights',
    'Mostly AI-generated',
    'Other',
  ];
  const FLAG = { possible_duplicate: 'Looks like another design', ai_assisted: 'AI-assisted (declared)' };
  const STATUS = { in_review: 'In review', changes_requested: 'Changes asked', live: 'Live', paused: 'Paused', removed: 'Removed', draft: 'Draft' };

  /* ================= Designers: applications ================= */
  async function designers(body) {
    let f = 'pending';
    const draw = async () => {
      const list = await admin('designer_applications', { p_status: f });
      body.innerHTML = `<section class="hx-panel">
        <div class="ax-tools">${filters([['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Turned down'], ['all', 'All']], f)}
          <span class="small muted" aria-live="polite">${list.length} ${list.length === 1 ? 'application' : 'applications'}</span></div>
        <p class="tiny muted" style="margin:0">Pilot rules: Indian designers only, invited by you. Approve only when the portfolio clearly belongs to the person (posts going back more than a month, a name that matches). Approved pilot designers get +10 points on their share for 6 months.</p>
        ${list.length ? `<ol class="mk-apps">${list.map((a) => `<li class="mk-app card-sub" data-id="${esc(a.id)}">
            <div class="row between"><div><b>${esc(a.display_name)}</b> <span class="small muted">${esc(a.city)}, ${esc(a.state)}</span></div><span class="pill ${a.status === 'approved' ? 'published' : a.status === 'rejected' ? 'no' : ''}">${esc({ pending: 'Waiting', approved: 'Approved', rejected: 'Turned down' }[a.status] || a.status)}</span></div>
            <div class="small"><a href="${esc(a.portfolio_url)}" target="_blank" rel="noopener noreferrer">${esc(a.portfolio_url)}</a></div>
            <div class="tiny muted">${esc(a.email || '')} · applied ${esc(stamp(a.created_at))}${(a.occasions || []).length ? ' · ' + a.occasions.map(esc).join(', ') : ''}</div>
            ${a.review_note ? `<div class="tiny">Note: ${esc(a.review_note)}</div>` : ''}
            ${a.status === 'pending' ? `<div class="row"><input class="input" data-note placeholder="Note to keep (optional)" maxlength="500" aria-label="Note for ${esc(a.display_name)}" style="flex:1;min-width:180px">
              <button class="btn sm primary" data-approve>Approve</button><button class="btn sm danger ghost" data-reject>Turn down</button></div>` : ''}
          </li>`).join('')}</ol>` : '<p class="small muted" style="margin:0">Nothing here.</p>'}
      </section>`;
      body.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { f = b.dataset.f; draw().catch(fail); }));
      body.querySelectorAll('.mk-app').forEach((li) => {
        const decide = async (approve, btn) => {
          busy(btn, true);
          try {
            const r = await admin('decide_application', { p_id: li.dataset.id, p_approve: approve, p_note: li.querySelector('[data-note]').value || null, p_pilot_months: 6 });
            if (!r.ok) throw new Error(r.code === 'not_pending' ? 'Someone already decided this application.' : r.code);
            IX.toast(approve ? 'Approved. They can now sign the agreement and upload.' : 'Application turned down', 'ok');
            await draw();
          } catch (e) { fail(e); busy(btn, false); }
        };
        const a = li.querySelector('[data-approve]'), r = li.querySelector('[data-reject]');
        if (a) a.onclick = () => decide(true, a);
        if (r) r.onclick = () => decide(false, r);
      });
    };
    await draw();
  }

  /* ================= Design review ================= */
  async function review(body) {
    let f = 'in_review';
    const draw = async () => {
      const list = await admin('design_queue', { p_status: f });
      body.innerHTML = `<section class="hx-panel">
        <div class="ax-tools">${filters([['in_review', 'To review'], ['changes_requested', 'Changes asked'], ['live', 'Live'], ['paused', 'Paused'], ['removed', 'Removed']], f)}
          <span class="small muted" aria-live="polite">${list.length} ${list.length === 1 ? 'design' : 'designs'}</span></div>
        ${f === 'in_review' ? '<p class="tiny muted" style="margin:0">Check four things: it is original, it looks good, the text areas work on a phone, and religious or cultural images are used with respect. Aim to decide within 48 hours.</p>' : ''}
        ${list.length ? list.map(card).join('') : '<p class="small muted" style="margin:0">Nothing here.</p>'}
      </section>`;
      body.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { f = b.dataset.f; draw().catch(fail); }));
      body.querySelectorAll('.mk-design').forEach((el) => wireCard(el, draw));
    };
    await draw();
  }

  function card(g) {
    const pages = Array.isArray(g.pages) ? g.pages : [];
    const d = g.designer || {};
    const rights = g.rights || {};
    const review = g.status === 'in_review';
    return `<article class="mk-design card-sub" data-id="${esc(g.id)}" aria-label="${esc(g.title)}">
      <div class="row between"><div><b>${esc(g.title)}</b> <span class="small muted">${esc(g.occasion)} · ${rs(g.price)}</span></div><span class="pill">${esc(STATUS[g.status] || g.status)}</span></div>
      <div class="mk-pages">${pages.map((p) => `<figure><img loading="lazy" alt="${esc(p.role || 'page')} page" src="${esc(publicUrl('designer-previews', p.preview))}"><figcaption class="tiny muted">${esc(p.role || '')}${(p.zones || []).length ? ` · ${(p.zones || []).length} text ${(p.zones || []).length === 1 ? 'area' : 'areas'}` : ''}</figcaption></figure>`).join('') || '<p class="tiny muted">No pages uploaded.</p>'}</div>
      <div class="small">By <b>${esc(d.name || '')}</b> <span class="muted">(${esc(d.trust || 'new')}, ${Number(d.live || 0)} live, ${Number(d.rejected || 0)} turned down)</span></div>
      ${(g.flags || []).length ? `<div class="row">${g.flags.map((x) => `<span class="pill warn">${esc(FLAG[x] || x)}</span>`).join('')}</div>` : ''}
      <div class="tiny muted">${rights.at ? `Rights declared ${esc(stamp(rights.at))} (all 5 ticked, agreement ${esc(rights.agreement || '')})` : 'No rights declaration'} · AI use: ${esc(g.aiUse || 'none')} · Fonts: ${esc(g.fonts || 'default')}</div>
      <div class="row">${g.sourcePath ? `<button class="btn sm" data-source="${esc(g.sourcePath)}">${icon('open')} Open source file</button>` : '<span class="tiny muted">No source file</span>'}
        ${pages.map((p) => (p.path ? `<button class="btn sm ghost" data-full="${esc(p.path)}">Full ${esc(p.role || 'page')}</button>` : '')).join('')}</div>
      ${review ? `<div class="mk-decide stack-sm">
          <div class="row"><select class="input" data-reason aria-label="Reason" style="max-width:320px"><option value="">Pick a reason…</option>${REASONS.map((r) => `<option>${esc(r)}</option>`).join('')}</select>
          <input class="input" data-note maxlength="1000" placeholder="Note to the designer (a reason is needed to send back or turn down)" aria-label="Note to the designer" style="flex:1;min-width:180px"></div>
          <div class="row"><button class="btn sm primary" data-d="approve">Approve and list</button><button class="btn sm" data-d="changes">Ask for changes</button>
          <button class="btn sm danger ghost" data-d="reject">Turn down</button><button class="btn sm danger ghost" data-d="reject_flag" title="Turn down and pause the designer's account">Turn down and pause designer</button></div>
        </div>` : g.status === 'live' ? '<div class="row"><button class="btn sm" data-d="pause">Pause sales</button></div>'
        : g.status === 'paused' ? '<div class="row"><button class="btn sm" data-d="restore">List again</button><button class="btn sm danger ghost" data-d="remove">Remove</button></div>' : ''}
    </article>`;
  }

  function wireCard(el, redraw) {
    el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
      const decision = b.dataset.d;
      const reason = (el.querySelector('[data-reason]') || {}).value || '';
      const note = (el.querySelector('[data-note]') || {}).value || '';
      if (['changes', 'reject', 'reject_flag'].includes(decision) && !reason) { el.querySelector('[data-reason]').focus(); return IX.toast('Pick a reason first. The designer sees it.', 'warn'); }
      if (decision === 'reject_flag' && !(await H.confirm('Pause this designer?', 'The design is turned down and the designer cannot upload or sell until an admin restores the account.', 'Turn down and pause', true))) return;
      if (decision === 'remove' && !(await H.confirm('Remove this design?', 'It stops selling for good. Hosts who already bought it keep using it.', 'Remove', true))) return;
      busy(b, true);
      try {
        const r = await admin('review_design', { p_id: el.dataset.id, p_decision: decision, p_reason: reason || (decision === 'pause' || decision === 'remove' ? 'admin' : null), p_note: note || null });
        if (!r.ok) throw new Error({ not_in_review: 'This design is no longer waiting for review.', reason_needed: 'Pick a reason first.' }[r.code] || r.code);
        IX.toast({ approve: 'Approved. It is now in the gallery.', changes: 'Sent back with your note', reject: 'Turned down', reject_flag: 'Turned down and designer paused', pause: 'Sales paused', restore: 'Listed again', remove: 'Removed' }[decision], 'ok');
        await redraw();
      } catch (e) { fail(e); busy(b, false); }
    }));
    const open = async (bucket, path, btn) => {
      busy(btn, true);
      try {
        if (bucket === 'designer-source') {
          const { data, error } = await H.store.sb.storage.from(bucket).createSignedUrl(path, 600);
          if (error) throw error;
          window.open(data.signedUrl, '_blank', 'noopener');
        } else window.open(publicUrl(bucket, path), '_blank', 'noopener');
      } catch (e) { fail(e); }
      busy(btn, false);
    };
    el.querySelectorAll('[data-source]').forEach((b) => (b.onclick = () => open('designer-source', b.dataset.source, b)));
    el.querySelectorAll('[data-full]').forEach((b) => (b.onclick = () => open('designer-art', b.dataset.full, b)));
  }

  /* ---------- register with the Admin page ---------- */
  const T = H.adminTabs;
  if (!T) return;
  Object.assign(H.adminActions || {}, {
    'designer.approve': 'Approved designer', 'designer.reject': 'Turned down designer',
    'design.approve': 'Approved design', 'design.changes': 'Asked for design changes', 'design.reject': 'Turned down design',
    'design.reject_flag': 'Turned down design and paused designer', 'design.pause': 'Paused design', 'design.restore': 'Listed design again', 'design.remove': 'Removed design',
    'payout.queue': 'Queued designer payouts', 'payout.paid': 'Marked payout paid', 'payout.failed': 'Marked payout failed',
  });
  const at = Math.max(0, T.findIndex((t) => t[0] === 'usage' || t[0] === 'system'));
  T.splice(at, 0, ['designers', 'Designers', 'users', 'Designer applications for the marketplace pilot.'], ['review', 'Design review', 'check', 'Designs waiting for a decision, and every listed design.']);
  Object.assign(H.adminScreens, { designers: guard(designers), review: guard(review) });
})();
