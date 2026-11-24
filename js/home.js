/* InviteX home dashboard (#/) and new-invitation route (#/new[/category]).
 * Everything shown is computed from the host's real invitations, guest lists and
 * RSVPs in the store. No sample numbers. */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model, esc = IX.esc, H = window.H;

  /* ---------- line icons (stroke, 24px grid) ---------- */
  const P = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.6 5.2"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    pin: '<path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.4"/>',
    alert: '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    open: '<path d="M3 9.5 12 4l9 5.5v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="m3 9.5 9 6 9-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;
  H.icon = icon;

  /* ---------- quick-start occasions ---------- */
  const QUICK = [
    { cat: 'wedding', label: 'Wedding' },
    { cat: 'engagement', label: 'Engagement' },
    { cat: 'birthday', label: 'Birthday' },
    { cat: 'anniversary', label: 'Anniversary' },
    { cat: 'housewarming', label: 'Housewarming' },
    { cat: 'religious', label: 'Puja' },
    { cat: 'festival', label: 'Family gathering' },
    { cat: 'corporate', label: 'Corporate' },
  ];

  /* ---------- dates ---------- */
  const todayIn = (tz) => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 864e5);
  // The next event on or after today, else the last past one.
  function eventInfo(inv) {
    const dated = (inv.events || []).filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date || '')).sort((a, b) => a.date.localeCompare(b.date));
    if (!dated.length) return null;
    const today = todayIn(inv.timezone);
    const next = dated.find((e) => e.date >= today) || dated[dated.length - 1];
    return { ev: next, days: dayDiff(next.date, today), upcoming: next.date >= today };
  }
  const countdown = (d) => (d == null ? '' : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 1 ? `In ${d} days` : d === -1 ? 'Yesterday' : `${-d} days ago`);
  const ago = (iso) => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (!isFinite(s)) return '';
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) { const d = Math.floor(s / 86400); return d === 1 ? 'Yesterday' : d + ' days ago'; }
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };
  const fmtDay = (inv, date) => IX.fmtDate(date, inv.timezone, 'en', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: inv.timezone });

  /* ---------- per-viewer conveniences (filter + sort remembered) ---------- */
  const PREF = 'ix-home-prefs';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify({ filter: S.filter, sort: S.sort })); } catch (e) { /* storage blocked */ } };
  const S = { filter: prefs.filter || 'all', sort: prefs.sort || 'edited', q: '', items: [], activity: [] };

  /* ---------- thumbnail: the card's own design ---------- */
  async function thumbArt(inv) {
    const th = IXT.THEMES[inv.theme] || IXT.THEMES['minimal-ivory'];
    const p = M.palette(inv);
    let img = '';
    if (inv.media && inv.media.background) img = await H.store.resolveMedia(inv.media.background).catch(() => '');
    if (!img && inv.media && inv.media.cover) img = await H.store.resolveMedia(inv.media.cover).catch(() => '');
    const mo = IXT.motif(th.motif, p);
    const fonts = (inv.design && inv.design.fonts) || th.fonts;
    return { img, p, mo, script: fonts.script || th.fonts.script, head: fonts.head || th.fonts.head };
  }

  function thumbHtml(it) {
    const { inv, art } = it;
    const { p, mo } = art;
    const title = H.title(inv);
    const ev = it.info;
    const L = inv.defaultLang || 'en';
    const sub = M.txt(inv, L, 'familyName') || M.txt(inv, L, 'subtitle');
    return `<div class="hx-thumb ${art.img ? 'has-img' : ''}" style="--t-bg:${esc(p.bg)};--t-bg2:${esc(p.bg2)};--t-ink:${esc(p.text)};--t-acc:${esc(p.accent)}">
      ${art.img ? `<div class="hx-thumb-img" style="background-image:url('${esc(art.img)}')"></div>` : `${mo.corner ? `<div class="hx-c tl">${mo.corner}</div><div class="hx-c br">${mo.corner}</div>` : ''}`}
      <div class="hx-thumb-txt">
        ${sub ? `<div class="hx-t-sub" lang="${esc(L)}">${esc(sub.slice(0, 48))}</div>` : ''}
        <div class="hx-t-title" lang="${esc(L)}" style="font-family:${esc(IXT.fontStack(art.script, 'script'))}">${esc(title.slice(0, 60))}</div>
        ${ev ? `<div class="hx-t-date">${esc(IX.fmtDate(ev.ev.date, inv.timezone, 'en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: inv.timezone }))}</div>` : ''}
      </div>
    </div>`;
  }

  function cardHtml(it) {
    const { inv, st, info } = it;
    const cat = IXT.CATEGORIES.find((c) => c.id === inv.category) || {};
    const pub = inv.status === 'published';
    const dirty = pub && H.hasUnpublished(inv);
    const status = pub ? (info && !info.upcoming ? ['done', 'Event over'] : ['published', 'Published']) : ['draft', 'Draft'];
    return `<article class="hx-card" data-id="${esc(inv.id)}">
      <a class="hx-thumb-link" href="#/edit/${esc(inv.id)}/1" aria-label="Edit ${esc(H.title(inv))}">${thumbHtml(it)}</a>
      <span class="hx-status ${status[0]}">${status[1]}</span>
      <div class="hx-body">
        <div class="hx-meta"><span>${esc(cat.name || 'Event')}</span>${dirty ? '<span class="hx-dot-sep">·</span><span class="hx-warn">Unpublished changes</span>' : ''}</div>
        <h3 class="hx-name" lang="${esc(inv.defaultLang || 'en')}">${esc(H.title(inv))}</h3>
        <div class="hx-when">${icon('calendar')}${info ? `<span>${esc(fmtDay(inv, info.ev.date))}</span><span class="hx-count ${info.upcoming ? (info.days <= 7 ? 'soon' : '') : 'past'}">${esc(countdown(info.days))}</span>` : '<span class="muted">No date yet</span>'}</div>
        <dl class="hx-nums">
          <div><dt>Invited</dt><dd>${st.invited}</dd></div>
          <div><dt>Confirmed</dt><dd>${st.yes}${st.attendees > st.yes ? `<small> · ${st.attendees} people</small>` : ''}</dd></div>
          <div><dt>Pending</dt><dd>${st.pending}</dd></div>
        </dl>
        ${replyBar(st, true)}
        <div class="hx-actions">
          <a class="hx-qa primary" href="#/edit/${esc(inv.id)}/1">${icon('edit')}<span>Edit</span></a>
          <button class="hx-qa" type="button" data-act="preview" data-id="${esc(inv.id)}">${icon('eye')}<span>Preview</span></button>
          ${pub ? `<a class="hx-qa" href="#/dash/${esc(inv.id)}/share">${icon('share')}<span>Share</span></a>` : `<a class="hx-qa" href="#/edit/${esc(inv.id)}/3">${icon('send')}<span>Publish</span></a>`}
          <a class="hx-qa" href="#/dash/${esc(inv.id)}/guests">${icon('users')}<span>Guests</span></a>
          <a class="hx-qa" href="#/dash/${esc(inv.id)}/overview">${icon('chart')}<span>Analytics</span></a>
          <button class="hx-qa" type="button" data-act="dup" data-id="${esc(inv.id)}">${icon('copy')}<span>Duplicate</span></button>
          <div class="hx-menu">
            <button class="hx-qa iconbtn" type="button" data-act="menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions for ${esc(H.title(inv))}">${icon('more')}</button>
            <div class="hx-menu-list" role="menu" hidden>
              <a role="menuitem" href="#/dash/${esc(inv.id)}/responses">${icon('check')}Responses</a>
              ${pub ? `<a role="menuitem" target="_blank" rel="noopener" href="${esc(IX.inviteUrl(inv.slug))}">${icon('open')}Open guest link</a>` : ''}
              <button role="menuitem" type="button" class="danger" data-act="del" data-id="${esc(inv.id)}">${icon('trash')}Delete</button>
            </div>
          </div>
        </div>
      </div>
    </article>`;
  }

  /* ---------- replies at a glance: yes / maybe / no / not replied ---------- */
  function replyBar(st, small) {
    const seg = [['yes', st.yes, 'Confirmed'], ['maybe', st.maybe, 'Maybe'], ['no', st.no, 'Declined'], ['pend', st.pending, 'Not replied']];
    const sum = seg.reduce((n, x) => n + x[1], 0);
    if (!sum) return small ? '' : '<div class="hx-bar empty" aria-hidden="true"></div>';
    const label = seg.filter((x) => x[1]).map((x) => `${x[1]} ${x[2].toLowerCase()}`).join(', ');
    return `<div class="hx-bar ${small ? 'sm' : ''}" role="img" aria-label="Replies: ${esc(label)}">${seg.filter((x) => x[1]).map(([k, n, l]) => `<i class="${k}" style="flex:${n}" title="${esc(l)}: ${n}"></i>`).join('')}</div>`;
  }

  /* ---------- recent activity from real records ----------
   * Replies, link opens and sends come from the stored RSVPs and guest list.
   * "Sent" means the host opened WhatsApp or email for that guest, never "delivered". */
  function buildActivity(items) {
    const out = [];
    items.forEach(({ inv, rsvps, guests }) => {
      const t = H.title(inv), id = inv.id;
      rsvps.forEach((r) => {
        const n = (r.adults || 0) + (r.children || 0);
        const what = r.status === 'yes' ? `is coming${n > 1 ? ` (${n} people)` : ''}` : r.status === 'no' ? 'can’t make it' : `might come${n > 1 ? ` (${n} people)` : ''}`;
        out.push({ at: r.updatedAt || r.createdAt, kind: r.status, type: 'reply', html: `<b>${esc(r.name || 'A guest')}</b> ${esc(what)}`, inv: t, href: `#/dash/${id}/responses`, cta: 'View reply' });
      });
      const replied = new Set(rsvps.map((r) => r.guestId).filter(Boolean));
      guests.forEach((g) => {
        if (g.openedAt && !replied.has(g.id)) out.push({ at: g.openedAt, kind: 'open', type: 'open', html: `<b>${esc(g.name)}</b> opened the invitation but has not replied`, inv: t, href: `#/dash/${id}/guests`, cta: 'Remind' });
      });
      // sends are grouped per invitation and day, so a batch of 50 is one line
      const sends = {};
      guests.forEach((g) => { if (g.sentAt) { const day = g.sentAt.slice(0, 10); (sends[day] = sends[day] || []).push(g); } });
      Object.values(sends).forEach((gs) => {
        const last = gs.map((g) => g.sentAt).sort().pop();
        const who = gs.length === 1 ? `<b>${esc(gs[0].name)}</b>` : `<b>${gs.length} guests</b>`;
        out.push({ at: last, kind: 'sent', type: 'invite', html: `You invited ${who} on WhatsApp or email`, inv: t, href: `#/dash/${id}/guests`, cta: 'Guest list' });
      });
      if (inv.publishedAt) out.push({ at: inv.publishedAt, kind: 'pub', type: 'invite', html: 'You published the invitation', inv: t, href: `#/dash/${id}/share`, cta: 'Share' });
      if (inv.updatedAt && (!inv.publishedAt || Date.parse(inv.updatedAt) - Date.parse(inv.publishedAt) > 60000)) out.push({ at: inv.updatedAt, kind: 'edit', type: 'edit', html: 'You edited the invitation', inv: t, href: `#/edit/${id}/1`, cta: 'Open' });
    });
    return out.filter((a) => a.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  }
  const ACT_ICON = { yes: 'check', no: 'close', maybe: 'clock', pub: 'send', edit: 'edit', open: 'open', sent: 'send' };
  const ACT_TABS = [['all', 'All'], ['reply', 'Replies'], ['invite', 'Invites'], ['open', 'Opened']];

  /* ---------- what needs the host's attention, most urgent first ---------- */
  function attention(items) {
    const out = [];
    items.forEach((it) => {
      const { inv, st, info, guests, rsvps } = it, t = H.title(inv), id = inv.id;
      const pub = inv.status === 'published';
      const soon = info && info.upcoming ? info.days : null;
      const when = soon == null ? '' : ` · ${countdown(soon).toLowerCase()}`;
      if (!pub && soon != null && soon <= 30) out.push({ w: 100 - soon, tone: 'bad', text: `<b>${esc(t)}</b> is still a draft${esc(when)}. Guests cannot open it yet.`, cta: 'Publish', href: `#/edit/${id}/3` });
      if (!pub) return;
      if (info && !info.upcoming) return; // event over: nothing to chase
      const notSent = guests.filter((g) => !g.sentAt && !rsvps.some((r) => r.guestId === g.id)).length;
      if (st.pending && soon != null && soon <= 21) out.push({ w: 80 - soon, tone: 'warn', text: `<b>${st.pending}</b> ${st.pending === 1 ? 'guest has' : 'guests have'} not replied to <b>${esc(t)}</b>${esc(when)}.`, cta: 'Send reminders', href: `#/dash/${id}/guests` });
      if (notSent) out.push({ w: 40, tone: 'info', text: `<b>${notSent}</b> ${notSent === 1 ? 'guest on' : 'guests on'} <b>${esc(t)}</b> ${notSent === 1 ? 'has' : 'have'} not been sent the invitation.`, cta: 'Send invites', href: `#/dash/${id}/guests` });
      if (st.maybe && soon != null && soon <= 14) out.push({ w: 50 - soon, tone: 'warn', text: `<b>${st.maybe}</b> ${st.maybe === 1 ? 'guest is' : 'guests are'} not sure yet about <b>${esc(t)}</b>.`, cta: 'See who', href: `#/dash/${id}/responses` });
      const cap = inv.settings && inv.settings.maxGuestsTotal;
      if (cap && st.attendees >= cap * 0.9) out.push({ w: 90, tone: 'bad', text: `<b>${esc(t)}</b> has ${st.attendees} of ${cap} places taken.`, cta: 'Review', href: `#/dash/${id}/overview` });
      if (H.hasUnpublished(inv)) out.push({ w: 30, tone: 'info', text: `<b>${esc(t)}</b> has changes guests cannot see yet.`, cta: 'Update', href: `#/edit/${id}/3` });
      if (!guests.length && !rsvps.length) out.push({ w: 20, tone: 'info', text: `<b>${esc(t)}</b> is published but not shared with anyone yet.`, cta: 'Share', href: `#/dash/${id}/share` });
    });
    return out.sort((a, b) => b.w - a.w).slice(0, 5);
  }

  /* ---------- event-wise tracking: every upcoming event, with who is coming ---------- */
  function eventRows(items) {
    const rows = [];
    items.forEach((it) => {
      const today = todayIn(it.inv.timezone);
      (it.inv.events || []).forEach((e) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '') || e.date < today) return;
        const ev = it.st.events[e.id] || { heads: 0, yes: 0 };
        rows.push({ it, e, days: dayDiff(e.date, today), heads: ev.heads, yes: ev.yes });
      });
    });
    return rows.sort((a, b) => a.days - b.days || (a.e.start || '').localeCompare(b.e.start || ''));
  }

  /* ---------- filtering / sorting ---------- */
  function visible() {
    const q = S.q.trim().toLowerCase();
    let list = S.items.filter((it) => {
      if (S.filter === 'published' && it.inv.status !== 'published') return false;
      if (S.filter === 'draft' && it.inv.status === 'published') return false;
      if (S.filter === 'upcoming' && !(it.info && it.info.upcoming)) return false;
      if (q) {
        const cat = (IXT.CATEGORIES.find((c) => c.id === it.inv.category) || {}).name || '';
        const hay = [H.title(it.inv), cat, ...(it.inv.events || []).map((e) => [e.name, e.venue, e.city].join(' '))].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = {
      edited: (a, b) => (b.inv.updatedAt || '').localeCompare(a.inv.updatedAt || ''),
      date: (a, b) => {
        // upcoming soonest first, then undated, then past (most recent first)
        const k = (it) => (!it.info ? [1, 0] : it.info.upcoming ? [0, it.info.days] : [2, -it.info.days]);
        const x = k(a), y = k(b);
        return x[0] - y[0] || x[1] - y[1];
      },
      name: (a, b) => H.title(a.inv).localeCompare(H.title(b.inv)),
    };
    return list.sort(by[S.sort] || by.edited);
  }

  function renderList(v) {
    const box = v.querySelector('#hxList');
    if (!box) return;
    const list = visible();
    const counts = { all: S.items.length, published: S.items.filter((i) => i.inv.status === 'published').length, draft: S.items.filter((i) => i.inv.status !== 'published').length, upcoming: S.items.filter((i) => i.info && i.info.upcoming).length };
    v.querySelectorAll('[data-filter]').forEach((b) => {
      const on = b.dataset.filter === S.filter;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
      b.querySelector('i').textContent = counts[b.dataset.filter];
    });
    if (!S.items.length) {
      box.innerHTML = `<div class="hx-empty">
        <div class="hx-empty-art" aria-hidden="true">${icon('spark')}</div>
        <h3>Your first invitation is a few minutes away</h3>
        <p>Pick an occasion above, or start with the button below. You can also load four finished samples to look around.</p>
        <div class="row" style="justify-content:center"><a class="btn primary" href="#/new">${icon('plus')}Create new invitation</a><button class="btn" type="button" id="loadSamples">Load sample invitations</button></div>
      </div>`;
    } else if (!list.length) {
      box.innerHTML = `<div class="hx-empty small"><p>No invitations match${S.q ? ` “${esc(S.q)}”` : ''}.</p><button class="btn sm" type="button" id="hxClear">Show all invitations</button></div>`;
    } else {
      box.innerHTML = `<div class="hx-grid">${list.map(cardHtml).join('')}</div>`;
    }
    wireList(v);
  }

  function wireList(v) {
    const ls = v.querySelector('#hxList #loadSamples');
    if (ls) ls.onclick = loadSamples(ls);
    const cl = v.querySelector('#hxClear');
    if (cl) cl.onclick = () => { S.q = ''; S.filter = 'all'; v.querySelector('#hxSearch').value = ''; savePrefs(); renderList(v); };
    v.querySelectorAll('#hxList [data-act]').forEach((b) => (b.onclick = (e) => act(e, b, v)));
  }

  const loadSamples = (b) => async () => {
    b.disabled = true;
    try { await window.IXSamples.create(H.store); IX.toast('Sample invitations created', 'ok'); } catch (e) { IX.toast(e.message, 'bad'); }
    H.route();
  };

  function closeMenus(except) {
    document.querySelectorAll('.hx-menu-list:not([hidden])').forEach((m) => {
      if (m === except) return;
      m.hidden = true;
      const b = m.parentElement.querySelector('[data-act=menu]');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  async function act(e, b, v) {
    const id = b.dataset.id;
    if (b.dataset.act === 'menu') {
      e.stopPropagation();
      const m = b.nextElementSibling;
      closeMenus(m);
      m.hidden = !m.hidden;
      b.setAttribute('aria-expanded', String(!m.hidden));
      if (!m.hidden) m.querySelector('[role=menuitem]').focus();
      return;
    }
    closeMenus();
    if (b.dataset.act === 'preview') return preview(id);
    if (b.dataset.act === 'dup') {
      const c = await H.store.duplicateInvitation(id);
      IX.toast('Copied as a new draft', 'ok');
      return H.go('#/edit/' + c.id + '/1');
    }
    if (b.dataset.act === 'del') return H.deleteInvitation(id);
  }

  /* ---------- preview: the real guest page, phone or desktop ---------- */
  async function preview(id) {
    const inv = await H.store.getInvitation(id);
    if (!inv) return;
    H.modal({
      title: H.title(inv),
      wide: true,
      body: `<div class="hx-pv">
        <div class="seg" role="group" aria-label="Preview size"><button type="button" class="on" data-pv="phone">Phone</button><button type="button" data-pv="desktop">Desktop</button></div>
        <div class="pv-frame hx-pv-frame"><iframe title="Preview of ${esc(H.title(inv))}" src="invite.html?preview=1"></iframe></div>
        <p class="tiny muted" style="text-align:center;margin:.4rem 0 0">This is how guests will see it. ${inv.status === 'published' ? (H.hasUnpublished(inv) ? 'It includes changes you have not published yet.' : '') : 'It is still a draft, so guests cannot open it yet.'}</p>
      </div>`,
      actions: [{ label: 'Close', value: null }, { label: 'Edit', cls: 'primary', onClick: () => { H.go('#/edit/' + id + '/1'); } }],
      onOpen: (modal) => {
        const fr = modal.querySelector('iframe'), frame = modal.querySelector('.hx-pv-frame');
        const send = () => fr.contentWindow && fr.contentWindow.postMessage({ type: 'ix-preview', inv: M.publicSnapshot(inv), lang: inv.defaultLang, opened: false }, location.origin);
        const onMsg = (ev) => { if (ev.origin === location.origin && ev.data && ev.data.type === 'ix-preview-ready' && ev.source === fr.contentWindow) send(); };
        window.addEventListener('message', onMsg);
        H.cleanup.push(() => window.removeEventListener('message', onMsg));
        modal.querySelectorAll('[data-pv]').forEach((x) => (x.onclick = () => {
          modal.querySelectorAll('[data-pv]').forEach((y) => y.classList.toggle('on', y === x));
          frame.classList.toggle('desktop', x.dataset.pv === 'desktop');
        }));
        // the modal can close by Esc/backdrop too; drop the listener when it goes
        const obs = new MutationObserver(() => { if (!modal.isConnected) { window.removeEventListener('message', onMsg); obs.disconnect(); } });
        obs.observe(document.getElementById('modalRoot'), { childList: true });
      },
    });
  }

  /* ---------- the next event, in full ---------- */
  function nextCard(it) {
    const { inv, info, st } = it, e = info.ev, tz = inv.timezone, pub = inv.status === 'published';
    const replied = st.yes + st.no + st.maybe;
    const big = info.days === 0 ? ['Today', ''] : info.days === 1 ? ['1', 'day to go'] : [String(info.days), 'days to go'];
    return `<article class="hx-next" aria-label="Next event">
      <div class="hx-next-top">
        <div class="hx-next-art">${thumbHtml(it)}</div>
        <div class="hx-next-cd"><b>${esc(big[0])}</b><span>${esc(big[1])}</span></div>
      </div>
      <p class="hx-next-k">Next event</p>
      <h3>${esc(H.title(inv))}</h3>
      <ul class="hx-next-facts">
        <li>${icon('calendar')}<span>${esc(e.name ? e.name + ' · ' : '')}${esc(fmtDay(inv, e.date))}${e.start ? ' · ' + esc(IX.fmtTime(e.date, e.start, tz, 'en')) : ''}</span></li>
        ${e.venue || e.city ? `<li>${icon('pin')}<span>${esc([e.venue, e.city].filter(Boolean).join(', '))}</span></li>` : ''}
        <li>${icon('users')}<span>${st.invited ? `<b>${replied}</b> of ${st.invited} invited replied · <b>${st.attendees}</b> coming` : st.responses ? `<b>${st.attendees}</b> coming from ${st.responses} ${st.responses === 1 ? 'reply' : 'replies'}` : pub ? 'No guests added yet' : 'Draft – not shared yet'}</span></li>
      </ul>
      ${replyBar(st, true)}
      <div class="hx-next-act">
        ${pub ? `<a class="btn sm primary" href="#/dash/${esc(inv.id)}/share">${icon('share')}Share</a>` : `<a class="btn sm primary" href="#/edit/${esc(inv.id)}/3">${icon('send')}Publish</a>`}
        <a class="btn sm" href="#/dash/${esc(inv.id)}/guests">${icon('users')}Guests</a>
        <button class="btn sm ghost" type="button" data-act="preview" data-id="${esc(inv.id)}">${icon('eye')}Preview</button>
      </div>
    </article>`;
  }

  /* ---------- greeting ---------- */
  function greeting() {
    const h = new Date().getHours();
    const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    let name = '';
    const u = H.user;
    if (u) {
      const md = u.user_metadata || {};
      name = md.full_name || md.name || '';
      if (!name && u.email) name = u.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, '').trim();
      name = name.split(' ')[0];
      if (name) name = name[0].toUpperCase() + name.slice(1);
    }
    return part + (name ? ', ' + name : '');
  }

  /* ---------- home ---------- */
  H.routes.home = async (v) => {
    const invs = await H.store.listInvitations();
    S.items = await Promise.all(invs.map(async (inv) => {
      const [rsvps, guests] = await Promise.all([H.store.listRsvps(inv.id), H.store.listGuests(inv.id)]);
      return { inv, rsvps, guests, st: M.stats(rsvps, guests, inv.events), info: eventInfo(inv), art: await thumbArt(inv) };
    }));
    S.activity = buildActivity(S.items);
    const all = S.items.reduce((a, it) => {
      ['invited', 'yes', 'no', 'maybe', 'pending', 'attendees', 'adults', 'children', 'responses'].forEach((k) => (a[k] += it.st[k] || 0));
      return a;
    }, { invited: 0, yes: 0, no: 0, maybe: 0, pending: 0, attendees: 0, adults: 0, children: 0, responses: 0 });
    const tot = {
      inv: S.items.length, pub: S.items.filter((i) => i.inv.status === 'published').length,
      soon: S.items.filter((i) => i.info && i.info.upcoming && i.info.days <= 30).length,
      rate: Math.max(all.invited, all.responses) ? Math.round((all.responses / Math.max(all.invited, all.responses)) * 100) : 0,
    };
    const next = S.items.filter((it) => it.info && it.info.upcoming).sort((a, b) => a.info.days - b.info.days)[0];
    const todo = attention(S.items);
    const evRows = eventRows(S.items);
    const maxHeads = Math.max(1, ...evRows.map((r) => Math.max(r.heads, r.it.st.invited ? r.it.st.invited : 0)));
    const metric = (ic, label, val, sub) => `<div><dt>${icon(ic)}${label}</dt><dd>${val}</dd>${sub ? `<p>${sub}</p>` : ''}</div>`;

    H.render(`<div class="hx">
      <section class="hx-welcome ${next ? 'has-next' : ''}">
        <div class="hx-welcome-txt">
          <p class="hx-eyebrow">${esc(greeting())}</p>
          <h1>Every occasion deserves an extraordinary invitation.</h1>
          <p class="hx-lead">${next ? `Your next event, <b>${esc(H.title(next.inv))}</b>, is ${esc(countdown(next.info.days).toLowerCase())}.` : 'Design it, write it, share it on WhatsApp, and see who is coming, all in one place.'}</p>
          <a class="btn primary lg" href="#/new">${icon('plus')}Create new invitation</a>
        </div>
        ${next ? nextCard(next) : ''}
      </section>

      ${S.items.length ? `<dl class="hx-kpis" aria-label="Your numbers">
        ${metric('send', 'Invitations', tot.inv, `${tot.pub} published · ${tot.inv - tot.pub} ${tot.inv - tot.pub === 1 ? 'draft' : 'drafts'}`)}
        ${metric('users', 'People coming', all.attendees, all.attendees ? `${all.adults} adults · ${all.children} children` : 'From “yes” replies')}
        ${metric('clock', 'Awaiting reply', all.pending, `of ${all.invited} on your guest lists`)}
        ${metric('check', 'Response rate', tot.rate + '%', `${all.responses} ${all.responses === 1 ? 'reply' : 'replies'} so far`)}
        ${metric('calendar', 'Events in 30 days', tot.soon, next ? `Next: ${esc(countdown(next.info.days).toLowerCase())}` : 'Nothing coming up')}
      </dl>` : ''}

      <section class="hx-quick" aria-labelledby="hxQuickH">
        <h2 id="hxQuickH" class="hx-h">Start with an occasion</h2>
        <div class="hx-quick-row">
          ${QUICK.map((q) => { const c = IXT.CATEGORIES.find((x) => x.id === q.cat) || {}; const t = IXT.THEMES[c.theme] || {}; const p = (t.palettes || [{}])[0]; return `<a class="hx-occ" href="#/new/${q.cat}" style="--o-bg:${esc(p.bg || '#fff')};--o-acc:${esc(p.accent || '#c9a15a')}"><span class="hx-occ-sw" aria-hidden="true"></span>${esc(q.label)}</a>`; }).join('')}
          <a class="hx-occ more" href="#/new">All occasions</a>
        </div>
      </section>

      <div class="hx-cols">
        <section class="hx-main" aria-labelledby="hxListH">
          <div class="hx-toolbar">
            <h2 id="hxListH" class="hx-h">My invitations</h2>
            <div class="hx-filters" role="group" aria-label="Show">
              ${[['all', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['upcoming', 'Upcoming']].map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="false">${l}<i></i></button>`).join('')}
            </div>
            <div class="hx-tools">
              <label class="hx-search">${icon('search')}<span class="sr-only">Search invitations</span><input id="hxSearch" type="search" placeholder="Search by name, venue or occasion" autocomplete="off"></label>
              <label class="hx-sort"><span class="sr-only">Sort by</span><select id="hxSort" class="input">
                <option value="edited">Last edited</option><option value="date">Event date</option><option value="name">Name A–Z</option>
              </select></label>
            </div>
          </div>
          <div id="hxList"></div>

          ${S.items.length ? `<section class="hx-intel" aria-labelledby="hxIntelH">
            <h2 id="hxIntelH" class="hx-h">Guests and replies</h2>
            <div class="hx-panel">
              <dl class="hx-rsvp">
                <div class="yes"><dt>Confirmed</dt><dd>${all.yes}</dd><p>${all.attendees} ${all.attendees === 1 ? 'person' : 'people'}</p></div>
                <div class="maybe"><dt>Not sure yet</dt><dd>${all.maybe}</dd><p>may come</p></div>
                <div class="no"><dt>Declined</dt><dd>${all.no}</dd><p>can’t come</p></div>
                <div class="pend"><dt>Pending</dt><dd>${all.pending}</dd><p>not replied</p></div>
                <div class="tot"><dt>Expected attendees</dt><dd>${all.attendees}</dd><p>${all.adults} adults · ${all.children} children</p></div>
              </dl>
              ${replyBar(all)}
            </div>
            <div class="hx-panel">
              <div class="hx-panel-h"><h3>Event-wise tracking</h3><span class="tiny muted">People coming to each upcoming event</span></div>
              ${evRows.length ? `<ol class="hx-evs">${evRows.slice(0, 8).map((r) => `<li><a href="#/dash/${esc(r.it.inv.id)}/overview">
                <span class="hx-day"><b>${esc(IX.fmtDate(r.e.date, r.it.inv.timezone, 'en', { day: 'numeric', timeZone: r.it.inv.timezone }))}</b><small>${esc(IX.fmtDate(r.e.date, r.it.inv.timezone, 'en', { month: 'short', timeZone: r.it.inv.timezone }))}</small></span>
                <span class="hx-ev-t"><b>${esc(r.e.name || H.title(r.it.inv))}</b><small>${esc(H.title(r.it.inv))}${r.e.start ? ' · ' + esc(IX.fmtTime(r.e.date, r.e.start, r.it.inv.timezone, 'en')) : ''}${r.e.venue ? ' · ' + esc(r.e.venue) : ''}</small></span>
                <span class="hx-ev-n"><span class="hx-ev-bar"><i style="width:${Math.round((r.heads / maxHeads) * 100)}%"></i></span><b>${r.heads}</b><small>${r.it.inv.status === 'published' ? 'coming' : 'draft'}</small></span>
                <span class="hx-count ${r.days <= 7 ? 'soon' : ''}">${esc(countdown(r.days))}</span>
              </a></li>`).join('')}</ol>${evRows.length > 8 ? `<p class="tiny muted" style="margin:.5rem 0 0">${evRows.length - 8} more upcoming ${evRows.length - 8 === 1 ? 'event' : 'events'}.</p>` : ''}` : '<p class="muted small" style="margin:0">No upcoming events. Add a date to an invitation to track it here.</p>'}
            </div>
          </section>` : ''}
        </section>
        ${S.items.length ? `<aside class="hx-side" aria-label="Attention and activity">
          <section aria-labelledby="hxTodoH">
            <h2 id="hxTodoH" class="hx-h">Needs attention</h2>
            ${todo.length ? `<ul class="hx-todo">${todo.map((x) => `<li class="${x.tone}"><span class="hx-todo-ic">${icon(x.tone === 'info' ? 'bell' : 'alert')}</span><span class="hx-todo-t">${x.text}</span><a class="btn sm" href="${esc(x.href)}">${esc(x.cta)}</a></li>`).join('')}</ul>` : `<p class="hx-allgood">${icon('check')}Nothing needs you right now.</p>`}
          </section>
          <section aria-labelledby="hxActH">
            <div class="hx-act-head"><h2 id="hxActH" class="hx-h">Recent activity</h2>
              <div class="hx-filters sm" role="group" aria-label="Show activity">${ACT_TABS.map(([k, l]) => `<button type="button" data-actf="${k}" aria-pressed="${k === 'all'}" class="${k === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div></div>
            <div id="hxAct"></div>
          </section>
          <button class="btn sm ghost" type="button" id="loadSamplesSide">Add sample invitations</button>
        </aside>` : ''}
      </div>
    </div>`);

    const drawAct = (f) => {
      const box = v.querySelector('#hxAct');
      if (!box) return;
      const list = S.activity.filter((a) => f === 'all' || a.type === f).slice(0, 8);
      box.innerHTML = list.length ? `<ol class="hx-act">${list.map((a) => `<li><span class="hx-act-ic ${a.kind}">${icon(ACT_ICON[a.kind] || 'clock')}</span><span class="hx-act-t"><span>${a.html}</span><small>${esc(a.inv)} · ${esc(ago(a.at))}</small></span><a class="hx-act-go" href="${esc(a.href)}">${esc(a.cta)}</a></li>`).join('')}</ol>` : `<p class="muted small">${f === 'reply' ? 'Replies from guests will appear here.' : f === 'open' ? 'When a guest opens their personal link without replying, it shows here.' : f === 'invite' ? 'Invitations you send will appear here.' : 'Replies from guests will appear here.'}</p>`;
    };
    drawAct('all');
    v.querySelectorAll('[data-actf]').forEach((b) => (b.onclick = () => {
      v.querySelectorAll('[data-actf]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      drawAct(b.dataset.actf);
    }));
    v.querySelectorAll('.hx-next [data-act]').forEach((b) => (b.onclick = (e) => act(e, b, v)));

    const sr = v.querySelector('#hxSearch'), so = v.querySelector('#hxSort');
    so.value = S.sort;
    sr.value = S.q;
    let t;
    sr.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.q = sr.value; renderList(v); }, 120); };
    so.onchange = () => { S.sort = so.value; savePrefs(); renderList(v); };
    v.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.filter; savePrefs(); renderList(v); }));
    const ss = v.querySelector('#loadSamplesSide');
    if (ss) ss.onclick = loadSamples(ss);
    const outside = (e) => { if (!e.target.closest('.hx-menu')) closeMenus(); };
    const esc2 = (e) => { if (e.key === 'Escape') closeMenus(); };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', esc2);
    H.cleanup.push(() => { document.removeEventListener('click', outside); document.removeEventListener('keydown', esc2); });
    renderList(v);
  };

  /* ---------- new (optionally for one occasion) ---------- */
  H.routes.new = async (_v, category) => {
    const cat = IXT.CATEGORIES.some((c) => c.id === category) ? category : 'wedding';
    const inv = M.newInvitation(cat);
    // start with complete, matching wording so the card is never blank
    // (written for this invitation, so two new cards do not read the same)
    if (window.IXStudio) IXStudio.fillDefault(inv, 'en');
    else if (window.IXWording) {
      inv.tone = IXWording.tones(cat)[0].id;
      Object.assign(inv.text.en, IXWording.build(cat, 'en', inv.tone));
    }
    await H.store.saveInvitation(inv);
    H.go('#/edit/' + inv.id + '/1');
  };
})();
