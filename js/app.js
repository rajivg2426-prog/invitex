/* InviteX host app – shell, router, home, settings, help. Exposed as window.H */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model, esc = IX.esc;
  const H = (window.H = { routes: {}, store: null, user: null });
  const view = document.getElementById('view');

  /* ---------- modal helpers ---------- */
  H.modal = ({ title, body, actions = [], wide = false, onOpen }) =>
    new Promise((resolve) => {
      const root = document.getElementById('modalRoot');
      const last = document.activeElement;
      const bg = document.createElement('div');
      bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
        <div class="modal-h"><h2 id="mdl-t">${esc(title)}</h2><button class="btn ghost iconbtn" data-x aria-label="Close">✕</button></div>
        <div class="modal-b">${body}</div>
        ${actions.length ? `<div class="modal-f">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}</div>` : ''}
      </div>`;
      root.appendChild(bg);
      const modal = bg.querySelector('.modal');
      const done = (v) => { bg.remove(); document.removeEventListener('keydown', key); last && last.focus && last.focus(); resolve(v); };
      const key = (e) => {
        if (e.key === 'Escape') done(null);
        if (e.key === 'Tab') { // focus trap
          const f = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        }
      };
      document.addEventListener('keydown', key);
      bg.querySelector('[data-x]').onclick = () => done(null);
      bg.addEventListener('mousedown', (e) => { if (e.target === bg) done(null); });
      bg.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
        const a = actions[+b.dataset.a];
        if (a.onClick) { const r = await a.onClick(modal); if (r === false) return; done(r === undefined ? a.value : r); } else done(a.value);
      }));
      onOpen && onOpen(modal, done);
      (modal.querySelector('input, select, textarea') || modal.querySelector('[data-a]') || modal.querySelector('[data-x]')).focus();
    });
  H.confirm = (title, msg, okLabel = 'Confirm', danger = false) =>
    H.modal({ title, body: `<p>${msg}</p>`, actions: [{ label: 'Cancel', value: false }, { label: okLabel, value: true, cls: danger ? 'danger' : 'primary' }] }).then((v) => !!v);

  /* ---------- router ---------- */
  H.go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
  H.cleanup = [];
  async function route() {
    H.cleanup.forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
    H.cleanup = [];
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
    const name = parts[0] || 'home';
    document.querySelectorAll('.topnav a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#/' + (name === 'home' ? '' : name)));
    if (H.store.mode === 'supabase' && !H.user && name !== 'login' && name !== 'help') return H.go('#/login');
    const fn = H.routes[name] || H.routes.home;
    try { await fn(view, ...parts.slice(1)); } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="err">${esc(e.message)}</p><a class="btn" href="#/">Back to my invitations</a></div>`;
    }
    view.focus({ preventScroll: true });
  }
  H.render = (html) => { view.innerHTML = html; window.scrollTo(0, 0); };

  /* ---------- shared bits ---------- */
  H.thumbStyle = (inv) => {
    const p = M.palette(inv);
    return `background: linear-gradient(135deg, ${p.bg}, ${p.bg2}); color: ${p.accent}`;
  };
  H.title = (inv) => M.txt(inv, inv.defaultLang, 'title') || 'Untitled invitation';

  /* ---------- home ---------- */
  H.routes.home = async (v) => {
    const list = await H.store.listInvitations();
    const stats = await Promise.all(list.map(async (inv) => M.stats(await H.store.listRsvps(inv.id), await H.store.listGuests(inv.id), inv.events)));
    H.render(`
      <section class="hero-home">
        <div>
          <h1>Create an invitation in minutes, <em>share it in seconds.</em></h1>
          <p>Design a beautiful digital invitation for any occasion, send personal links on WhatsApp, and track every RSVP from one dashboard.</p>
          <div class="row" style="margin-top:1rem">
            <a class="btn gold lg" href="#/new">✨ Create invitation</a>
            ${list.length ? '' : '<button class="btn lg" id="loadSamples" style="background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.3)">Load 4 sample invitations</button>'}
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="mini-phone" style="background:linear-gradient(#3b0a16,#22050c);color:#d4a557"><div>TOGETHER WITH<br>THEIR FAMILIES<b style="font-family:'Cormorant Garamond'">Aarav &amp; Diya</b>25 · NOV</div></div>
          <div class="mini-phone" style="background:linear-gradient(#f4e4dc,#e9cfc4);color:#7a1f2e"><div>हिमाचली<b style="font-family:'Noto Sans Devanagari'">धाम</b>Family Dham</div></div>
          <div class="mini-phone" style="background:linear-gradient(#0b1530,#050a19);color:#4cc9f0"><div>INNOVATE<b>SUMMIT 2026</b>Bengaluru</div></div>
        </div>
      </section>
      <div class="row between" style="margin-bottom:.8rem"><h2 style="margin:0">My invitations <span class="muted small">(${list.length})</span></h2>
        <div class="row">${list.length ? '<button class="btn sm" id="loadSamples">+ Sample invitations</button>' : ''}<a class="btn primary sm" href="#/new">+ New invitation</a></div></div>
      ${list.length ? `<div class="inv-grid">${list.map((inv, i) => invCard(inv, stats[i])).join('')}</div>` : `<div class="empty card"><div class="big">💌</div><p>No invitations yet. Create your first one, or load the samples to explore.</p></div>`}
    `);
    v.querySelectorAll('#loadSamples').forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try { await window.IXSamples.create(H.store); IX.toast('Sample invitations created', 'ok'); } catch (e) { IX.toast(e.message, 'bad'); }
      route();
    }));
    v.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => invAction(b.dataset.act, b.dataset.id)));
  };
  function invCard(inv, st) {
    const cat = IXT.CATEGORIES.find((c) => c.id === inv.category) || {};
    const ev = (inv.events || []).find((e) => e.date);
    const dirty = inv.status === 'published' && H.hasUnpublished(inv);
    return `<article class="inv-card">
      <div class="inv-thumb" style="${H.thumbStyle(inv)}"><span class="pill ${inv.status}">${inv.status === 'published' ? '● Published' : 'Draft'}</span><div class="t-title">${esc(H.title(inv))}</div></div>
      <div class="inv-body">
        <div class="small muted">${esc(cat.icon || '')} ${esc(cat.name || '')}${ev ? ' · ' + esc(IX.fmtDate(ev.date, inv.timezone, 'en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: inv.timezone })) : ''}</div>
        ${dirty ? '<div class="pill maybe">Unpublished changes</div>' : ''}
        <div class="inv-stats"><span><b>${st.attendees}</b> attending</span><span><b>${st.yes}</b> yes</span><span><b>${st.no}</b> no</span><span><b>${st.responses}</b> replies</span></div>
        <div class="inv-actions">
          <a class="btn sm primary" href="#/edit/${esc(inv.id)}/1">✏️ Edit</a>
          <a class="btn sm" href="#/dash/${esc(inv.id)}">📊 RSVPs</a>
          ${inv.status === 'published' ? `<a class="btn sm" href="#/dash/${esc(inv.id)}/share">📤 Share</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${esc(IX.inviteUrl(inv.slug))}">👁 View</a>` : ''}
          <button class="btn sm ghost" data-act="dup" data-id="${esc(inv.id)}" title="Duplicate">⧉ Duplicate</button>
          <button class="btn sm ghost danger" data-act="del" data-id="${esc(inv.id)}" title="Delete">🗑</button>
        </div>
      </div></article>`;
  }
  async function invAction(act, id) {
    if (act === 'dup') {
      const c = await H.store.duplicateInvitation(id);
      IX.toast('Duplicated as a new draft', 'ok');
      return H.go('#/edit/' + c.id + '/1');
    }
    if (act === 'del') return H.deleteInvitation(id);
  }
  H.deleteInvitation = async (id) => {
    const inv = await H.store.getInvitation(id);
    const ok = await H.confirm('Delete invitation?', `This permanently deletes <b>${esc(H.title(inv))}</b>, its guest list, all RSVP responses and uploaded media. The guest link will stop working. This cannot be undone.`, 'Delete permanently', true);
    if (!ok) return;
    await H.store.deleteInvitation(id);
    IX.toast('Invitation and all its data deleted', 'ok');
    H.go('#/');
  };
  H.hasUnpublished = (inv) => {
    if (!inv.published) return false;
    const a = M.publicSnapshot(inv), b = IX.deepClone(inv.published);
    ['updatedAt', 'publishedVersionAt', 'status', 'publishedAt'].forEach((k) => { delete a[k]; delete b[k]; });
    return JSON.stringify(a) !== JSON.stringify(b);
  };

  /* ---------- new ---------- */
  H.routes.new = async () => {
    const inv = M.newInvitation('wedding');
    // start with complete, matching wording so the card is never blank
    // (written for this invitation, so two new cards do not read the same)
    if (window.IXStudio) IXStudio.fillDefault(inv, 'en');
    else if (window.IXWording) {
      inv.tone = IXWording.tones('wedding')[0].id;
      Object.assign(inv.text.en, IXWording.build('wedding', 'en', inv.tone));
    }
    await H.store.saveInvitation(inv);
    H.go('#/edit/' + inv.id + '/1');
  };

  /* ---------- settings ---------- */
  H.routes.settings = async (v) => {
    const local = H.store.mode === 'local';
    H.render(`<h1>Settings</h1>
      <div class="card stack">
        <h2>Data mode: ${local ? 'Demo / Local' : 'Production (Supabase)'}</h2>
        ${local ? `<div class="notice warn"><b>Your data is stored only in this browser on this device</b> (IndexedDB). Guest links open only in this same browser, and RSVPs from other people's phones are <b>not</b> collected. To receive real RSVPs from guests, connect a Supabase project — see <a href="docs/DEPLOYMENT.md" target="_blank">docs/DEPLOYMENT.md</a>.</div>`
          : `<div class="notice ok">Connected to Supabase. Signed in as <b>${esc(H.user && H.user.email)}</b>. Guests can open links from any device and RSVPs synchronise to your dashboard.</div><div class="row"><button class="btn" id="chk">🔌 Check connection</button><button class="btn" id="signOut">Sign out</button></div><div id="chkOut"></div>`}
      </div>
      ${local ? `<div class="card stack">
        <h2>Backup &amp; restore</h2>
        <p class="muted small">Download everything (invitations, guests, RSVPs, photos) as one file, or restore it on another browser.</p>
        <div class="row"><button class="btn" id="exp">⬇ Download backup (.json)</button>
        <label class="btn">⬆ Restore backup<input type="file" accept="application/json,.json" id="imp" hidden></label></div>
      </div>
      <div class="card stack">
        <h2>Delete all local data</h2>
        <p class="muted small">Removes every invitation, guest list, RSVP and uploaded file from this browser.</p>
        <button class="btn danger" id="wipe">Delete everything</button>
      </div>` : ''}`);
    const so = v.querySelector('#signOut');
    if (so) so.onclick = async () => { await H.store.signOut(); H.user = null; H.go('#/login'); };
    const ck = v.querySelector('#chk');
    if (ck) ck.onclick = async () => { const r = await H.store.checkConnection(); v.querySelector('#chkOut').innerHTML = `<div class="notice ${r.ok ? 'ok' : 'bad'}">${esc(r.msg)}</div>`; };
    if (!local) return;
    v.querySelector('#exp').onclick = async () => {
      const data = await H.store.exportAll();
      IX.download('invitex-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data), 'application/json');
    };
    v.querySelector('#imp').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { await H.store.importAll(JSON.parse(await f.text())); IX.toast('Backup restored', 'ok'); H.go('#/'); } catch (err) { IX.toast(err.message, 'bad'); }
    };
    v.querySelector('#wipe').onclick = async () => {
      if (!(await H.confirm('Delete all local data?', 'Every invitation, guest and RSVP in this browser will be erased. This cannot be undone.', 'Delete everything', true))) return;
      await H.store.wipe();
      location.hash = '#/';
      location.reload();
    };
  };

  /* ---------- login (production) ---------- */
  H.routes.login = async (v) => {
    if (H.store.mode !== 'supabase') return H.go('#/');
    H.render(`<div class="card stack" style="max-width:420px;margin:2rem auto">
      <h1>Host sign in</h1><p class="muted small">Sign in to create invitations and see your RSVP dashboard. Guests never need an account.</p>
      <form id="lf" class="stack">
        <div class="field"><label for="le">Email</label><input class="input" id="le" type="email" required autocomplete="email"></div>
        <div class="field"><label for="lp">Password</label><input class="input" id="lp" type="password" minlength="8" autocomplete="current-password"><span class="hint">Leave empty to receive a one-time sign-in link by email.</span></div>
        <p class="err" id="lerr" hidden></p>
        <div class="row"><button class="btn primary" type="submit">Sign in</button><button class="btn" type="button" id="su">Create account</button></div>
      </form></div>`);
    const err = v.querySelector('#lerr');
    const show = (m) => { err.textContent = m; err.hidden = false; };
    v.querySelector('#lf').onsubmit = async (e) => {
      e.preventDefault();
      const em = v.querySelector('#le').value.trim(), pw = v.querySelector('#lp').value;
      try {
        if (!pw) { await H.store.magicLink(em); IX.toast('Check your email for a sign-in link', 'ok'); return; }
        await H.store.signIn(em, pw);
        H.user = await H.store.getUser();
        H.go('#/');
      } catch (ex) { show(ex.message); }
    };
    v.querySelector('#su').onclick = async () => {
      const em = v.querySelector('#le').value.trim(), pw = v.querySelector('#lp').value;
      if (!IX.validEmail(em) || pw.length < 8) return show('Enter an email and a password of at least 8 characters.');
      try { await H.store.signUp(em, pw); IX.toast('Account created. Check your email to confirm it.', 'ok'); } catch (ex) { show(ex.message); }
    };
  };

  /* ---------- help ---------- */
  H.routes.help = async () => {
    H.render(`<div class="card help" style="max-width:820px">
      <h1>Quick guide</h1>
      <ol>
        <li><b>1 · Design</b> – tap <i>Create invitation</i>, choose the occasion, a design and colours – or upload your own artwork as the card.</li>
        <li><b>2 · Fill your card</b> – pick a message style (every line is written to match), then add the names, date and place. You can also click any line on the card preview and type right there. Photos, music, the full message and fonts are in the folded panels below.</li>
        <li><b>3 · Share</b> – choose your link name and press <i>Publish</i>. RSVP questions, password and expiry are under <i>More options</i>. Edits after publishing stay a draft until you press <i>Update published invitation</i>.</li>
        <li><b>Share</b> – in the RSVP dashboard add guests and send each a personal WhatsApp link, or share one general link / QR code.</li>
        <li><b>Track</b> – watch confirmed attendees, adults/children, food preferences and event-wise numbers; export to CSV/Excel or print.</li>
      </ol>
      <h2>About WhatsApp</h2>
      <p>InviteX uses WhatsApp's official click-to-chat links. Pressing a WhatsApp button opens WhatsApp with the message ready — <b>you still press Send</b>. InviteX records that WhatsApp was opened, not that the message was delivered.</p>
      <h2>Demo vs Production mode</h2>
      <p>${H.store.mode === 'local' ? 'You are in <b>Demo/Local mode</b>: everything stays in this browser. It is perfect for designing and previewing, but guests on their own phones cannot open the link or RSVP until Production mode (Supabase) is set up.' : 'You are in <b>Production mode</b>: guests can open links on any device and their RSVPs sync to your dashboard.'}</p>
      <p>Full documentation: <a href="docs/USER_MANUAL.md" target="_blank">User manual</a> · <a href="docs/DEPLOYMENT.md" target="_blank">Deployment</a> · <a href="docs/TEST_REPORT.md" target="_blank">Test report</a></p>
    </div>`);
  };

  /* ---------- boot ---------- */
  (async () => {
    // wait for wizard.js / dashboard.js to register their routes
    if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
    try { H.store = await window.IXStore; } catch (e) { view.innerHTML = `<div class="card"><h2>Could not start</h2><p class="err">${esc(e.message)}</p></div>`; return; }
    const badge = document.getElementById('modeBadge');
    const banner = document.getElementById('modeBanner');
    if (H.store.mode === 'local') {
      badge.textContent = 'Demo · Local'; badge.className = 'mode-badge local';
      banner.innerHTML = '<b>Demo/Local mode:</b> data is saved only in this browser. Guest links work only on this device, and RSVPs from other phones are not collected. <a href="#/settings">Learn more</a>';
      banner.hidden = false;
    } else {
      badge.textContent = 'Production'; badge.className = 'mode-badge prod';
      H.user = await H.store.getUser();
      H.store.sb.auth.onAuthStateChange((_e, session) => { H.user = session ? session.user : null; });
    }
    // Load every font the editor offers, so the font and design pickers show the real
    // typefaces (before, they fell back to the system font and looked fake).
    if (window.IXT && IXT.FONT_URL && !document.getElementById('ixFonts')) {
      const l = document.createElement('link');
      l.id = 'ixFonts'; l.rel = 'stylesheet'; l.href = IXT.FONT_URL;
      document.head.appendChild(l);
    }
    window.addEventListener('hashchange', route);
    route();
  })();
})();
