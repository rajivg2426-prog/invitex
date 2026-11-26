/* InviteX Admin page (#/admin/<users|invitations|usage|activity>).
 * Visible only to admins. Every number and every action goes through the admin_*
 * database functions in supabase/admin.sql, which check the admin role inside the
 * database, so a host who opens this address still gets nothing. No service key here. */
(function () {
  'use strict';
  const IX = window.IX, esc = IX.esc, H = window.H;
  const icon = (n) => (H.icon ? H.icon(n) : '');
  const PAGE = 50;
  const TABS = [
    ['users', 'Users', 'users', 'Everyone who has an InviteX account.'],
    ['invitations', 'Invitations', 'send', 'Every invitation, from every account.'],
    ['usage', 'Usage', 'chart', 'How much InviteX is being used, week by week.'],
    ['activity', 'Activity log', 'clock', 'Every change an admin has made, newest first.'],
  ];
  const ACTIONS = {
    'user.suspend': 'Paused account',
    'user.activate': 'Re-activated account',
    'user.make_admin': 'Made admin',
    'user.remove_admin': 'Removed admin',
    'user.ai_tries': 'Gave AI tries',
    'invitation.unpublish': 'Unpublished invitation',
    'invitation.delete': 'Deleted invitation',
    'user.make_super_admin': 'Made Super Admin',
    'pricing.update': 'Changed pricing & payments',
    'promotion.create': 'Created promotion',
    'promotion.update': 'Changed promotion',
    'access.grant': 'Gave free sharing',
    'access.revoke': 'Ended free sharing',
  };
  // admin-billing.js adds its screens to these
  H.adminTabs = TABS; H.adminScreens = {}; H.adminActions = ACTIONS;
  // rough rupee cost per AI image (see docs/AI_DESIGNS_SETUP.md)
  const RS_PER_IMAGE = { google: 3.5, openai: 5 };

  /* ---------- small helpers ---------- */
  const n = (x) => Number(x || 0).toLocaleString('en-IN');
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const when = (iso) => {
    if (!iso) return '<span class="muted">Never</span>';
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) { const d = Math.floor(s / 86400); return d === 1 ? 'Yesterday' : d + ' days ago'; }
    return esc(day(iso));
  };
  const stamp = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.setAttribute('aria-busy', on ? 'true' : 'false'); } };
  const fail = (e) => IX.toast(e.message || String(e), 'bad', 5000);

  /* ---------- page shell: left menu like the home dashboard ---------- */
  function shell(tab) {
    const t = TABS.find((x) => x[0] === tab);
    H.render(`<div class="ax">
      <nav class="hx-rail ax-rail" aria-label="Admin">
        <div class="ax-who"><span class="ax-badge">${H.isSuperAdmin && H.isSuperAdmin() ? 'Super Admin' : 'Admin'}</span><small title="${esc(H.user && H.user.email)}">${esc(H.user && H.user.email)}</small></div>
        <ul>${TABS.map(([k, l, ic]) => `<li><a href="#/admin/${k}" class="${k === tab ? 'on' : ''}" ${k === tab ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a></li>`).join('')}</ul>
        <ul class="hx-rail-sub"><li><a href="#/">${icon('arrow')}<span>My invitations</span></a></li><li><a href="docs/USER_MANUAL.md" target="_blank" rel="noopener">${icon('open')}<span>Admin guide</span></a></li></ul>
      </nav>
      <div class="ax-main">
        <header class="ax-head"><h1>${esc(t[1])}</h1><p class="muted">${esc(t[3])}</p></header>
        <div id="axBody"><div class="page-loading"><div class="spinner"></div></div></div>
      </div>
    </div>`);
    return document.getElementById('axBody');
  }

  function blocked(title, html) {
    H.render(`<div class="card stack" style="max-width:620px;margin:2rem auto"><h1>${esc(title)}</h1>${html}<div class="row"><a class="btn" href="#/">Back to my invitations</a></div></div>`);
  }

  H.routes.admin = async (v, tab, ...rest) => {
    if (H.store.mode !== 'supabase') {
      return blocked('Admin needs the live app', '<p>The Admin page works only when InviteX is connected to Supabase (Production mode). In Demo/Local mode there is only one person, this browser, so there is nothing to manage.</p>');
    }
    await H.loadAccount(true);
    if (!H.account.setup) {
      return blocked('Admin setup is not finished', `<p>The database does not have the admin part yet. In Supabase, open <b>SQL Editor</b>, paste the whole of <code>supabase/admin.sql</code> and press <b>Run</b>. Then make yourself admin as the user manual explains (Part 3).</p>${H.account.error ? `<p class="tiny muted">Details: ${esc(H.account.error)}</p>` : ''}`);
    }
    if (!H.isAdmin()) {
      return blocked('This page is for admins', '<p>Your account is a host account. Only an InviteX admin can open the Admin page. Ask the person who runs InviteX if you need access.</p>');
    }
    Object.assign(H.adminScreens, { users, invitations, usage, activity }, H.adminScreens);
    const T = TABS.some((t) => t[0] === tab) ? tab : TABS[0][0];
    const body = shell(T);
    try { await H.adminScreens[T](body, ...rest.map(decodeURIComponent)); } catch (e) {
      body.innerHTML = `<div class="notice bad">Could not load this screen: ${esc(e.message)}</div>`;
    }
  };

  /* ================= Users ================= */
  async function users(body) {
    const S = { q: '', rows: [], total: 0 };
    body.innerHTML = `<section class="hx-panel">
      <div class="ax-tools">
        <label class="hx-search">${icon('search')}<span class="sr-only">Search by email</span><input id="axQ" type="search" placeholder="Search by email" autocomplete="off"></label>
        <span class="small muted" id="axCount" aria-live="polite"></span>
      </div>
      <div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr>
        <th scope="col">Account</th><th scope="col">Joined</th><th scope="col">Last sign-in</th><th scope="col" class="num">Invitations</th><th scope="col" class="num">Replies</th><th scope="col" class="num">AI tries</th><th scope="col"><span class="sr-only">Actions</span></th>
      </tr></thead><tbody id="axRows"></tbody></table></div>
      <div class="row" id="axMoreRow" hidden><button class="btn" id="axMore">Show more</button></div>
    </section>`;
    const rowsEl = body.querySelector('#axRows');
    const load = async (more) => {
      const r = await H.store.admin('users', { p_q: S.q, p_limit: PAGE, p_offset: more ? S.rows.length : 0 });
      S.rows = more ? S.rows.concat(r.rows) : r.rows; S.total = r.total;
      draw();
    };
    const draw = () => {
      body.querySelector('#axCount').textContent = `${n(S.total)} ${S.total === 1 ? 'account' : 'accounts'}${S.q ? ' found' : ''}`;
      rowsEl.innerHTML = S.rows.length ? S.rows.map((u) => {
        const me = H.user && u.id === H.user.id;
        return `<tr data-id="${esc(u.id)}" class="${u.status === 'suspended' ? 'ax-off' : ''}">
          <td><div class="ax-acc"><b>${esc(u.email || '(no email)')}</b><span>${me ? '<span class="pill">You</span>' : ''}${u.role === 'super_admin' ? '<span class="pill published">Super Admin</span>' : u.role === 'admin' ? '<span class="pill published">Admin</span>' : ''}${u.status === 'suspended' ? '<span class="pill no">Paused</span>' : ''}</span></div></td>
          <td>${esc(day(u.created_at))}</td>
          <td>${when(u.last_sign_in_at)}</td>
          <td class="num">${n(u.invitations)}${u.published ? `<small class="muted"> · ${n(u.published)} live</small>` : ''}</td>
          <td class="num">${n(u.replies)}</td>
          <td class="num">${n(u.ai_used)} / ${n(u.ai_limit)}</td>
          <td class="acts"><button class="btn sm" data-manage="${esc(u.id)}">Manage</button></td>
        </tr>`;
      }).join('') : `<tr><td colspan="7" class="muted">${S.q ? 'No account matches that email.' : 'No accounts yet.'}</td></tr>`;
      body.querySelector('#axMoreRow').hidden = S.rows.length >= S.total;
      rowsEl.querySelectorAll('[data-manage]').forEach((b) => (b.onclick = () => manage(S.rows.find((x) => x.id === b.dataset.manage), () => load(false))));
    };
    let t;
    body.querySelector('#axQ').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); load(false).catch(fail); }, 250); };
    body.querySelector('#axMore').onclick = (e) => { busy(e.target, true); load(true).catch(fail).finally(() => busy(e.target, false)); };
    await load(false);
  }

  function manage(u, reload) {
    const me = H.user && u.id === H.user.id;
    const paused = u.status === 'suspended';
    H.modal({
      title: u.email || 'Account',
      body: `<div class="stack ax-manage">
        <dl class="ax-facts">
          <div><dt>Role</dt><dd>${u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'Host'}</dd></div>
          <div><dt>Status</dt><dd>${paused ? 'Paused' : 'Active'}</dd></div>
          <div><dt>Invitations</dt><dd>${n(u.invitations)} (${n(u.published)} published)</dd></div>
          <div><dt>Replies received</dt><dd>${n(u.replies)}</dd></div>
          <div><dt>Joined</dt><dd>${esc(day(u.created_at))}</dd></div>
          <div><dt>Last edit</dt><dd>${u.last_edit ? when(u.last_edit) : 'No invitations yet'}</dd></div>
        </dl>
        ${paused && u.suspended_reason ? `<div class="notice warn">Paused because: ${esc(u.suspended_reason)}</div>` : ''}

        <section class="ax-sec">
          <h3>AI design tries</h3>
          <p class="small muted">Used <b>${n(u.ai_used)}</b> of <b>${n(u.ai_limit)}</b>. One try paints up to 4 designs.</p>
          <form class="row" id="mTries">
            <label class="sr-only" for="mTriesN">Tries to add</label><input class="input" id="mTriesN" type="number" min="1" max="1000" value="3" style="width:90px">
            <label class="sr-only" for="mTriesNote">Note</label><input class="input grow" id="mTriesNote" maxlength="120" placeholder="Note, for example: bought a pack">
            <button class="btn primary" type="submit">Add tries</button>
          </form>
        </section>

        ${me ? '<p class="small muted">This is your own account. Another admin has to change your role or pause it, so you can never lock yourself out.</p>' : `
        <section class="ax-sec">
          <h3>${paused ? 'Re-activate this account' : 'Pause this account'}</h3>
          ${paused
            ? '<p class="small muted">They can sign in and use their invitations again. Invitations that were unpublished stay as drafts until they publish them again.</p><button class="btn primary" id="mAct">Re-activate</button>'
            : `<p class="small muted">They are signed out of their data: they cannot open, change or create invitations, or use AI tries. Their guests' replies are kept.</p>
               <div class="field"><label for="mWhy">Reason (they will see it)</label><input class="input" id="mWhy" maxlength="300" placeholder="For example: spam invitations"></div>
               <label class="check"><input type="checkbox" id="mUnpub"> Also take their published invitations offline${u.published ? ` (${n(u.published)})` : ''}</label>
               <div><button class="btn danger" id="mSus">Pause account</button></div>`}
        </section>
        ${H.isSuperAdmin && H.isSuperAdmin() && u.role !== 'super_admin' ? `<section class="ax-sec">
          <h3>Role</h3>
          <p class="small muted">${u.role === 'admin' ? 'Admins can see every account, invitation and payment, and pause accounts. Only the Super Admin changes prices and free access.' : 'A host sees only their own invitations. Making them admin gives them this page, without price controls.'}</p>
          <button class="btn" id="mRole">${u.role === 'admin' ? 'Remove admin' : 'Make admin'}</button>
        </section>` : u.role === 'super_admin' ? '<p class="small muted">This is the Super Admin account.</p>' : ''}
        ${H.isSuperAdmin && H.isSuperAdmin() ? `<section class="ax-sec"><h3>Free sharing</h3><p class="small muted">Let this person start sharing campaigns without paying.</p><a class="btn" href="#/admin/free/${encodeURIComponent(u.email || '')}">Give free sharing</a></section>` : ''}`}
      </div>`,
      onOpen: (m, done) => {
        const run = async (btn, fn, msg) => {
          busy(btn, true);
          try { await fn(); IX.toast(msg, 'ok'); done(true); reload().catch(fail); } catch (e) { fail(e); } finally { busy(btn, false); }
        };
        m.querySelector('#mTries').onsubmit = (e) => {
          e.preventDefault();
          const k = parseInt(m.querySelector('#mTriesN').value, 10);
          if (!(k >= 1 && k <= 1000)) { IX.toast('Enter between 1 and 1000 tries', 'bad'); return; }
          run(e.submitter, () => H.store.admin('grant_ai_tries', { p_user: u.id, p_extra: k, p_note: m.querySelector('#mTriesNote').value }), `Added ${k} AI ${k === 1 ? 'try' : 'tries'}`);
        };
        const act = m.querySelector('#mAct');
        if (act) act.onclick = () => run(act, () => H.store.admin('set_user_status', { p_user: u.id, p_status: 'active', p_reason: '', p_unpublish: false }), 'Account re-activated');
        const sus = m.querySelector('#mSus');
        if (sus) sus.onclick = async () => {
          const unpub = m.querySelector('#mUnpub').checked;
          run(sus, async () => {
            const r = await H.store.admin('set_user_status', { p_user: u.id, p_status: 'suspended', p_reason: m.querySelector('#mWhy').value, p_unpublish: unpub });
            if (r && r.unpublished) IX.toast(`${r.unpublished} published ${r.unpublished === 1 ? 'invitation' : 'invitations'} taken offline`, 'info');
          }, 'Account paused');
        };
        const role = m.querySelector('#mRole');
        if (role) role.onclick = async () => {
          const toAdmin = u.role !== 'admin';
          if (toAdmin && !(await H.confirm('Make this person an admin?', `<b>${esc(u.email)}</b> will see every account and invitation, and can pause accounts and delete invitations.`, 'Make admin'))) return;
          run(role, () => H.store.admin('set_role', { p_user: u.id, p_role: toAdmin ? 'admin' : 'host' }), toAdmin ? 'Now an admin' : 'Admin role removed');
        };
      },
    });
  }

  /* ================= Invitations ================= */
  async function invitations(body) {
    const S = { q: '', status: 'all', rows: [], total: 0 };
    body.innerHTML = `<section class="hx-panel">
      <div class="ax-tools">
        <div class="hx-filters" role="group" aria-label="Show">${[['all', 'All'], ['published', 'Published'], ['draft', 'Drafts']].map(([k, l]) => `<button type="button" data-st="${k}" aria-pressed="${k === 'all'}" class="${k === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div>
        <label class="hx-search">${icon('search')}<span class="sr-only">Search invitations</span><input id="axQ" type="search" placeholder="Search by title, link name or owner email" autocomplete="off"></label>
        <span class="small muted" id="axCount" aria-live="polite"></span>
      </div>
      <div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr>
        <th scope="col">Invitation</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col" class="num">Guests</th><th scope="col" class="num">Replies</th><th scope="col" class="num">Coming</th><th scope="col">Last edited</th><th scope="col"><span class="sr-only">Actions</span></th>
      </tr></thead><tbody id="axRows"></tbody></table></div>
      <div class="row" id="axMoreRow" hidden><button class="btn" id="axMore">Show more</button></div>
    </section>`;
    const rowsEl = body.querySelector('#axRows');
    const cats = (window.IXT && IXT.CATEGORIES) || [];
    const load = async (more) => {
      const r = await H.store.admin('invitations', { p_q: S.q, p_status: S.status, p_limit: PAGE, p_offset: more ? S.rows.length : 0 });
      S.rows = more ? S.rows.concat(r.rows) : r.rows; S.total = r.total;
      draw();
    };
    const draw = () => {
      body.querySelector('#axCount').textContent = `${n(S.total)} ${S.total === 1 ? 'invitation' : 'invitations'}`;
      rowsEl.innerHTML = S.rows.length ? S.rows.map((i) => {
        const cat = (cats.find((c) => c.id === i.category) || {}).name || '';
        const live = i.status === 'published';
        const expired = i.expires_at && i.expires_at < new Date().toISOString().slice(0, 10);
        return `<tr data-id="${esc(i.id)}">
          <td><div class="ax-acc"><b>${esc(i.title)}</b><span class="tiny muted">${esc(cat)}${i.slug ? `${cat ? ' · ' : ''}/${esc(i.slug)}` : ''}</span></div></td>
          <td>${esc(i.owner_email || '')}</td>
          <td>${live ? `<span class="pill published">Published</span>${expired ? ' <span class="pill">Expired</span>' : ''}` : '<span class="pill draft">Draft</span>'}</td>
          <td class="num">${n(i.guests)}</td><td class="num">${n(i.replies)}</td><td class="num">${n(i.coming)}</td>
          <td>${when(i.updated_at)}</td>
          <td class="acts">${live && i.slug ? `<a class="btn sm ghost" href="${esc(IX.inviteUrl(i.slug))}" target="_blank" rel="noopener">Open</a><button class="btn sm" data-unpub="${esc(i.id)}">Unpublish</button>` : ''}<button class="btn sm danger" data-del="${esc(i.id)}">Delete</button></td>
        </tr>`;
      }).join('') : `<tr><td colspan="8" class="muted">${S.q || S.status !== 'all' ? 'No invitation matches.' : 'No invitations yet.'}</td></tr>`;
      body.querySelector('#axMoreRow').hidden = S.rows.length >= S.total;
      const find = (id) => S.rows.find((x) => x.id === id);
      rowsEl.querySelectorAll('[data-unpub]').forEach((b) => (b.onclick = () => unpublish(find(b.dataset.unpub), b)));
      rowsEl.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => del(find(b.dataset.del), b)));
    };
    const reason = (title, html, ok, danger) => H.modal({
      title,
      body: `<div class="stack">${html}<div class="field"><label for="mWhy">Reason (kept in the activity log)</label><input class="input" id="mWhy" maxlength="300"></div></div>`,
      actions: [{ label: 'Cancel', value: null }, { label: ok, cls: danger ? 'danger' : 'primary', onClick: (m) => ({ why: m.querySelector('#mWhy').value }) }],
    });
    async function unpublish(i, btn) {
      const r = await reason('Unpublish this invitation?', `<p><b>${esc(i.title)}</b> by ${esc(i.owner_email || 'unknown')} goes back to a draft. Guests who open the link will see that it is not available. The owner can publish it again.</p>`, 'Unpublish');
      if (!r) return;
      busy(btn, true);
      try { await H.store.admin('unpublish_invitation', { p_id: i.id, p_reason: r.why }); IX.toast('Invitation unpublished', 'ok'); await load(false); } catch (e) { fail(e); busy(btn, false); }
    }
    async function del(i, btn) {
      const r = await reason('Delete this invitation for good?', `<p>This permanently deletes <b>${esc(i.title)}</b> by ${esc(i.owner_email || 'unknown')}, with its ${n(i.guests)} guests, ${n(i.replies)} replies and uploaded photos. The owner is not told. This cannot be undone.</p>`, 'Delete permanently', true);
      if (!r) return;
      busy(btn, true);
      try { await H.store.adminDeleteInvitation(i.id, i.owner_id, r.why); IX.toast('Invitation deleted', 'ok'); await load(false); } catch (e) { fail(e); busy(btn, false); }
    }
    body.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => {
      S.status = b.dataset.st;
      body.querySelectorAll('[data-st]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      load(false).catch(fail);
    }));
    let t;
    body.querySelector('#axQ').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); load(false).catch(fail); }, 250); };
    body.querySelector('#axMore').onclick = (e) => { busy(e.target, true); load(true).catch(fail).finally(() => busy(e.target, false)); };
    await load(false);
  }

  /* ================= Usage ================= */
  async function usage(body) {
    const u = await H.store.admin('usage', { p_weeks: 8 });
    const T = u.totals || {};
    const prov = u.ai_by_provider || {};
    const cost = Object.entries(prov).reduce((s, [p, imgs]) => s + (RS_PER_IMAGE[p] || RS_PER_IMAGE.google) * Number(imgs || 0), 0);
    const tile = (ic, label, val, sub) => `<div><span class="hx-tile-ic">${icon(ic)}</span><dt>${label}</dt><dd>${val}</dd>${sub ? `<p>${sub}</p>` : ''}</div>`;
    const weeks = (u.weeks || []).slice().reverse();
    const thisWeek = weeks.length ? weeks[0].week : '';
    body.innerHTML = `
      <dl class="hx-tiles" aria-label="Totals">
        ${tile('users', 'Accounts', n(T.users), `${n(T.active30)} signed in this month${T.suspended ? ` · ${n(T.suspended)} paused` : ''}`)}
        ${tile('send', 'Invitations', n(T.invitations), `${n(T.published)} published`)}
        ${tile('check', 'Replies', n(T.replies), `${n(T.coming)} people coming · ${n(T.guests)} guests listed`)}
        ${tile('spark', 'AI designs', n(T.ai_images), `≈ ₹${n(Math.round(cost))} · ${n(T.ai_requests)} requests${T.ai_failed ? `, ${n(T.ai_failed)} failed` : ''}`)}
      </dl>
      <section class="hx-panel">
        <div class="hx-panel-h"><h3>Week by week</h3><span class="tiny muted">Last 8 weeks, weeks start on Monday</span></div>
        <div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr>
          <th scope="col">Week of</th><th scope="col" class="num">New accounts</th><th scope="col" class="num">Invitations made</th><th scope="col" class="num">Published</th><th scope="col" class="num">Replies</th><th scope="col" class="num">AI designs</th>
        </tr></thead><tbody>${weeks.map((w) => `<tr${w.week === thisWeek ? ' class="ax-now"' : ''}><td>${esc(new Date(w.week + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}${w.week === thisWeek ? ' <span class="tiny muted">(this week)</span>' : ''}</td>
          <td class="num">${n(w.signups)}</td><td class="num">${n(w.created)}</td><td class="num">${n(w.published)}</td><td class="num">${n(w.replies)}</td><td class="num">${n(w.ai_images)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="hx-panel">
        <div class="hx-panel-h"><h3>AI design use</h3><span class="tiny muted">Estimate: about ₹${RS_PER_IMAGE.google} per Google image, ₹${RS_PER_IMAGE.openai} per OpenAI image</span></div>
        ${(u.ai_top || []).length ? `<div class="tbl-wrap"><table class="tbl ax-tbl"><thead><tr><th scope="col">Top accounts</th><th scope="col" class="num">Requests</th><th scope="col" class="num">Designs</th></tr></thead>
          <tbody>${u.ai_top.map((r) => `<tr><td>${esc(r.email || '(deleted account)')}</td><td class="num">${n(r.requests)}</td><td class="num">${n(r.images)}</td></tr>`).join('')}</tbody></table></div>`
          : '<p class="small muted" style="margin:0">No AI designs have been made yet.</p>'}
        <p class="tiny muted" style="margin:0">To give someone more tries, open <a href="#/admin/users">Users</a> and press Manage.</p>
      </section>`;
  }

  /* ================= Activity log ================= */
  async function activity(body) {
    const S = { f: '', rows: [], total: 0 };
    body.innerHTML = `<section class="hx-panel">
      <div class="ax-tools">
        <div class="hx-filters" role="group" aria-label="Show">${[['', 'All'], ['user.', 'Accounts'], ['invitation.', 'Invitations'], ['pricing.', 'Pricing'], ['promotion.', 'Promotions'], ['access.', 'Free sharing']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === ''}" class="${k === '' ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="small muted" id="axCount" aria-live="polite"></span>
      </div>
      <ol class="ax-log" id="axRows"></ol>
      <div class="row" id="axMoreRow" hidden><button class="btn" id="axMore">Show more</button></div>
    </section>`;
    const list = body.querySelector('#axRows');
    const detail = (a) => {
      const d = a.details || {};
      const bits = [];
      if (d.added) bits.push(`+${n(d.added)} tries, now ${n(d.new_limit)}`);
      if (d.owner) bits.push(`owner ${esc(d.owner)}`);
      if (d.slug) bits.push(`/${esc(d.slug)}`);
      if (d.guests != null || d.replies != null) bits.push(`${n(d.guests)} guests and ${n(d.replies)} replies removed`);
      if (d.unpublished) bits.push(`${n(d.unpublished)} invitations taken offline`);
      if (d.reason) bits.push(`reason: “${esc(d.reason)}”`);
      if (d.note) bits.push(`note: “${esc(d.note)}”`);
      if (d.old && d.new) {
        const L = { payment_required: 'charging', price_paise: 'price', mode: 'mode', emergency_free: 'emergency free', new_user_free_days: 'new-user free days', free_campaigns_per_user: 'free campaigns per person', guest_cap: 'guest limit', campaign_grace_days: 'days after event' };
        Object.keys(L).forEach((k) => { if (JSON.stringify(d.old[k]) !== JSON.stringify(d.new[k])) bits.push(`${L[k]}: ${esc(k === 'price_paise' ? '₹' + d.old[k] / 100 : String(d.old[k]))} → ${esc(k === 'price_paise' ? '₹' + d.new[k] / 100 : String(d.new[k]))}`); });
      }
      if (d.old_role) bits.push(`${esc(d.old_role)} → ${esc(d.new_role)}`);
      if (d.until) bits.push(`until ${esc(new Date(d.until).toLocaleDateString('en-IN'))}`);
      if (d.campaigns) bits.push(`${n(d.campaigns)} campaigns`);
      return bits.join(' · ');
    };
    const load = async (more) => {
      const r = await H.store.admin('activity', { p_limit: PAGE, p_offset: more ? S.rows.length : 0, p_action: S.f });
      S.rows = more ? S.rows.concat(r.rows) : r.rows; S.total = r.total;
      body.querySelector('#axCount').textContent = `${n(S.total)} ${S.total === 1 ? 'entry' : 'entries'}`;
      list.innerHTML = S.rows.length ? S.rows.map((a) => {
        const kind = /^invitation\./.test(a.action) ? 'inv' : /^(pricing|promotion|access)\./.test(a.action) ? 'money' : 'user';
        const bad = /suspend|delete|remove/.test(a.action);
        return `<li class="${bad ? 'bad' : ''}">
          <span class="ax-log-ic">${icon(kind === 'inv' ? 'send' : kind === 'money' ? 'chart' : 'users')}</span>
          <div><p><b>${esc(ACTIONS[a.action] || a.action)}</b> · ${esc(a.target_label || '')}</p>
          ${detail(a) ? `<p class="small muted">${detail(a)}</p>` : ''}
          <p class="tiny muted">${esc(a.admin_email || 'a removed admin')} · <time datetime="${esc(a.created_at)}">${esc(stamp(a.created_at))}</time></p></div>
        </li>`;
      }).join('') : '<li class="ax-empty muted">Nothing here yet. Changes made on the Admin page appear here.</li>';
      body.querySelector('#axMoreRow').hidden = S.rows.length >= S.total;
    };
    body.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => {
      S.f = b.dataset.f;
      body.querySelectorAll('[data-f]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      load(false).catch(fail);
    }));
    body.querySelector('#axMore').onclick = (e) => { busy(e.target, true); load(true).catch(fail).finally(() => busy(e.target, false)); };
    await load(false);
  }
})();
