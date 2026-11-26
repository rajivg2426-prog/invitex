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
    if (H.user && H.store.mode === 'supabase') {
      await H.loadAccount();
      if (H.account.status === 'suspended' && name !== 'help') return suspended();
    }
    const fn = H.routes[name] || H.routes.home;
    try { await fn(view, ...parts.slice(1)); } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="card"><h2>Something went wrong</h2><p class="err">${esc(e.message)}</p><a class="btn" href="#/">Back to my invitations</a></div>`;
    }
    view.focus({ preventScroll: true });
  }
  H.route = () => route();

  /* ---------- my role (host / admin) and status ---------- */
  H.account = { role: 'host', status: 'active' };
  H.isAdmin = () => (H.account.role === 'admin' || H.account.role === 'super_admin') && H.account.status === 'active';
  H.isSuperAdmin = () => H.account.role === 'super_admin' && H.account.status === 'active';
  H.loadAccount = async (force) => {
    const uid = H.user ? H.user.id : null;
    if (!force && H.accountFor === uid && uid) return H.account;
    H.accountFor = uid;
    H.account = uid ? await H.store.myAccount().catch(() => ({ role: 'host', status: 'active' })) : { role: 'host', status: 'active' };
    const nav = document.getElementById('navAdmin');
    if (nav) nav.hidden = !H.isAdmin();
    return H.account;
  };
  function suspended() {
    const r = H.account.reason;
    H.render(`<div class="card stack" style="max-width:520px;margin:2rem auto">
      <h1>Your account is paused</h1>
      <p>An InviteX admin has paused this account, so you cannot open or change invitations right now.${r ? ` Reason given: <b>${esc(r)}</b>.` : ''}</p>
      <p class="muted small">If you think this is a mistake, contact the person who runs InviteX for you.</p>
      <div class="row"><button class="btn" id="susOut">Sign out</button></div></div>`);
    view.querySelector('#susOut').onclick = async () => { await H.store.signOut(); H.user = null; H.loadAccount(true); H.go('#/login'); };
  }
  H.render = (html) => { view.innerHTML = html; window.scrollTo(0, 0); };

  /* ---------- shared bits ---------- */
  H.thumbStyle = (inv) => {
    const p = M.palette(inv);
    return `background: linear-gradient(135deg, ${p.bg}, ${p.bg2}); color: ${p.accent}`;
  };
  H.title = (inv) => M.txt(inv, inv.defaultLang, 'title') || 'Untitled invitation';

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

  // Home dashboard and #/new live in js/home.js

  // Settings (Account, Language, WhatsApp, Plan) live in js/settings.js

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
        <li><b>1 · Design</b> – tap <i>Create new invitation</i>, choose the occasion, a design and colours – or upload your own artwork as the card.</li>
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
      H.store.sb.auth.onAuthStateChange((_e, session) => { H.user = session ? session.user : null; if (!session) H.loadAccount(true); });
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
