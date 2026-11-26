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
  // "5 min ago", "yesterday", "on 3 Dec": reads well after a verb
  const agoL = (iso) => { const a = ago(iso); return /^\d+ [A-Z]/.test(a) ? 'on ' + a : a.toLowerCase(); };

  /* ---------- one source for every number on this page ----------
   * Each guest on a list is in exactly one state:
   *   not sent  →  shared (you opened WhatsApp/email, or they opened their link)  →  replied.
   * Replies that came through the general link have no guest row: they count as
   * replies, and as people who received the invitation. Tiles, charts, cards and the
   * next-event panel all read these same numbers. */
  const FKEYS = ['added', 'shared', 'opened', 'replied', 'awaiting', 'awaitingOpened', 'notSent', 'general', 'replies', 'yes', 'maybe', 'no', 'attendees', 'adults', 'children', 'maybeHeads'];
  function funnel(rsvps, guests) {
    const st = M.stats(rsvps, guests, []);
    const answered = new Set(rsvps.map((r) => r.guestId).filter(Boolean));
    const f = { added: guests.length, shared: 0, opened: 0, replied: 0, awaiting: 0, awaitingOpened: 0, notSent: 0, general: 0, replies: rsvps.length,
      yes: st.yes, maybe: st.maybe, no: st.no, attendees: st.attendees, adults: st.adults, children: st.children, maybeHeads: st.maybeHeads };
    guests.forEach((g) => {
      if (answered.has(g.id)) { f.replied++; f.shared++; f.opened++; return; }
      if (g.sentAt || g.remindedAt || g.openedAt) { f.shared++; f.awaiting++; if (g.openedAt) { f.opened++; f.awaitingOpened++; } } else f.notSent++;
    });
    f.general = f.replies - f.replied; // general link (or a guest since removed from the list)
    return derive(f);
  }
  function derive(f) {
    f.reached = f.shared + f.general; // people we know received the invitation
    f.people = f.added + f.general; // everyone the host is tracking
    f.rate = f.reached ? Math.round((f.replies / f.reached) * 100) : null;
    f.expectedHigh = f.attendees + f.maybeHeads;
    return f;
  }
  function total(items) {
    const f = {};
    FKEYS.forEach((k) => (f[k] = items.reduce((a, it) => a + (it.f[k] || 0), 0)));
    return derive(f);
  }
  // This week vs the week before. Shown only when the data covers both weeks
  // and there are enough replies for the comparison to mean something.
  function weekCompare(items, pick) {
    const now = Date.now(), wk = 7 * 864e5;
    let first = Infinity, cur = 0, prev = 0;
    items.forEach((it) => {
      [it.inv.publishedAt, ...it.guests.map((g) => g.sentAt), ...it.rsvps.map((r) => r.createdAt || r.updatedAt)].forEach((t) => { const x = Date.parse(t || ''); if (x < first) first = x; });
      it.rsvps.forEach((r) => {
        const age = now - Date.parse(r.createdAt || r.updatedAt);
        if (age >= 0 && age < wk) cur += pick(r); else if (age >= wk && age < 2 * wk) prev += pick(r);
      });
    });
    if (!(now - first >= 2 * wk) || cur + prev < 3) return null;
    return { cur, prev };
  }
  const deltaHtml = (d, unit) => {
    if (!d) return '';
    const dir = d.cur > d.prev ? 'up' : d.cur < d.prev ? 'down' : 'flat';
    return `<span class="hx-delta ${dir}" title="Compared with the 7 days before">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■'} ${d.cur} ${unit} this week · ${d.prev} the week before</span>`;
  };

  /* ---------- per-viewer conveniences (filter, sort and number scope remembered) ---------- */
  const PREF = 'ix-home-prefs';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (e) { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem(PREF, JSON.stringify({ filter: S.filter, sort: S.sort, scope: S.scope })); } catch (e) { /* storage blocked */ } };
  const S = { filter: prefs.filter || 'all', sort: prefs.sort || 'edited', scope: prefs.scope || 'all', q: '', items: [], activity: [], nextIdx: 0 };
  const scoped = () => (S.scope === 'all' ? S.items : S.items.filter((it) => it.inv.id === S.scope));

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
      ${art.img ? `<div class="hx-thumb-img" style="background-image:url('${esc(art.img)}')"></div>` : `${mo.thumb && mo.hero ? `<div class="hx-h ${mo.thumb}">${mo.hero}</div>` : mo.corner ? `<div class="hx-c tl">${mo.corner}</div><div class="hx-c br">${mo.corner}</div>` : ''}`}
      <div class="hx-thumb-txt">
        ${sub ? `<div class="hx-t-sub" lang="${esc(L)}">${esc(sub.slice(0, 48))}</div>` : ''}
        <div class="hx-t-title" lang="${esc(L)}" style="font-family:${esc(IXT.fontStack(art.script, 'script'))}">${esc(title.slice(0, 60))}</div>
        ${ev ? `<div class="hx-t-date">${esc(IX.fmtDate(ev.ev.date, inv.timezone, 'en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: inv.timezone }))}</div>` : ''}
      </div>
    </div>`;
  }

  function cardHtml(it) {
    const { inv, f, info } = it;
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
          <div><dt>Guests</dt><dd>${f.people}</dd></div>
          <div><dt>Replied</dt><dd>${f.replies}</dd></div>
          <div><dt>Coming</dt><dd>${f.attendees}${f.attendees ? `<small> ${f.attendees === 1 ? 'person' : 'people'}</small>` : ''}</dd></div>
        </dl>
        ${replyBar(f, true)}
        <div class="hx-actions">
          <a class="hx-qa primary" href="#/edit/${esc(inv.id)}/1">${icon('edit')}<span>Edit</span></a>
          <button class="hx-qa" type="button" data-act="preview" data-id="${esc(inv.id)}">${icon('eye')}<span>Preview</span></button>
          ${pub ? `<a class="hx-qa" href="#/dash/${esc(inv.id)}/share">${icon('share')}<span>Share</span></a>` : `<a class="hx-qa" href="#/edit/${esc(inv.id)}/share">${icon('send')}<span>Publish</span></a>`}
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

  /* ---------- replies at a glance: yes / maybe / no / waiting / not sent ---------- */
  function replyBar(f, small) {
    const seg = [['yes', f.yes, 'Confirmed'], ['maybe', f.maybe, 'Maybe'], ['no', f.no, 'Declined'], ['pend', f.awaiting, 'Waiting for a reply'], ['ns', f.notSent, 'Not sent yet']];
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
      const { inv, st, f, info } = it, t = H.title(inv), id = inv.id;
      const pub = inv.status === 'published';
      const soon = info && info.upcoming ? info.days : null;
      const when = soon == null ? '' : ` · ${countdown(soon).toLowerCase()}`;
      if (!pub && soon != null && soon <= 30) out.push({ w: 100 - soon, tone: 'bad', text: `<b>${esc(t)}</b> is still a draft${esc(when)}. Guests cannot open it yet.`, cta: 'Publish', href: `#/edit/${id}/share` });
      if (!pub) return;
      if (info && !info.upcoming) return; // event over: nothing to chase
      if (f.awaiting && soon != null && soon <= 21) out.push({ w: 80 - soon, tone: 'warn', text: `<b>${f.awaiting}</b> ${f.awaiting === 1 ? 'guest has' : 'guests have'} not replied to <b>${esc(t)}</b>${esc(when)}.`, cta: 'Send reminders', href: `#/dash/${id}/guests/pending` });
      if (f.notSent) out.push({ w: 40, tone: 'info', text: `<b>${f.notSent}</b> ${f.notSent === 1 ? 'guest on' : 'guests on'} <b>${esc(t)}</b> ${f.notSent === 1 ? 'has' : 'have'} not been sent the invitation.`, cta: 'Send invites', href: `#/dash/${id}/guests/new` });
      if (f.maybe && soon != null && soon <= 14) out.push({ w: 50 - soon, tone: 'warn', text: `<b>${f.maybe}</b> ${f.maybe === 1 ? 'guest is' : 'guests are'} not sure yet about <b>${esc(t)}</b>.`, cta: 'See who', href: `#/dash/${id}/responses/maybe` });
      const cap = inv.settings && inv.settings.maxGuestsTotal;
      if (cap && st.attendees >= cap * 0.9) out.push({ w: 90, tone: 'bad', text: `<b>${esc(t)}</b> has ${st.attendees} of ${cap} places taken.`, cta: 'Review', href: `#/dash/${id}/overview` });
      if (H.hasUnpublished(inv)) out.push({ w: 30, tone: 'info', text: `<b>${esc(t)}</b> has changes guests cannot see yet.`, cta: 'Update', href: `#/edit/${id}/share` });
      if (!f.people) out.push({ w: 20, tone: 'info', text: `<b>${esc(t)}</b> is published but not shared with anyone yet.`, cta: 'Share', href: `#/dash/${id}/share` });
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
  // Every invitation with an upcoming event, soonest first; the panel can step through them.
  const upcomingList = () => S.items.filter((it) => it.info && it.info.upcoming).sort((a, b) => a.info.days - b.info.days || (a.info.ev.start || '').localeCompare(b.info.ev.start || ''));
  const hasVenue = (e) => !!(e.venue || e.address || e.city || e.mapUrl);
  // "Starts in 3 days 4 h", "Starts in 2 h 15 min", "Happening now"
  function liveText(startMs) {
    const s = Math.floor((startMs - Date.now()) / 1000);
    if (s <= 0) return 'Happening now';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d) return `Starts in ${d} ${d === 1 ? 'day' : 'days'} ${h} h`;
    if (h) return `Starts in ${h} h ${m} min`;
    return `Starts in ${Math.max(1, m)} min`;
  }
  function nextCard(list, idx) {
    const it = list[idx], { inv, info, f } = it, e = info.ev, tz = inv.timezone, pub = inv.status === 'published', id = esc(inv.id);
    const big = info.days === 0 ? ['Today', ''] : info.days === 1 ? ['1', 'day to go'] : [String(info.days), 'days to go'];
    const start = e.start ? IX.zonedToUtc(e.date, e.start, tz) : null;
    const w = (n) => (f.reached ? (n / f.reached) * 100 : 0).toFixed(1) + '%';
    const progress = f.people ? `<div class="hx-prog">
        <div class="hx-prog-h"><span>Guest replies</span><b>${f.replies} of ${f.reached}${f.rate != null ? ` · ${f.rate}%` : ''}</b></div>
        <div class="hx-prog-bar" role="progressbar" aria-label="Guests who replied" aria-valuemin="0" aria-valuemax="${f.reached}" aria-valuenow="${f.replies}"><i class="yes" style="width:${w(f.yes)}"></i><i class="maybe" style="width:${w(f.maybe)}"></i><i class="no" style="width:${w(f.no)}"></i></div>
        <p>${[`<b>${f.attendees}</b> coming`, f.awaiting ? `<b>${f.awaiting}</b> waiting` : '', f.notSent ? `<b>${f.notSent}</b> not sent yet` : ''].filter(Boolean).join(' · ')}</p>
      </div>` : `<p class="hx-prog-none">${pub ? 'No guests on this invitation yet. Add guests, or share the general link.' : 'Draft. Publish it to start sharing.'}</p>`;
    return `<article class="hx-next" aria-label="Upcoming event">
      <div class="hx-next-top">
        <div class="hx-next-art">${thumbHtml(it)}</div>
        <div class="hx-next-cd"><b>${esc(big[0])}</b><span>${esc(big[1])}</span></div>
      </div>
      <div class="hx-next-row"><p class="hx-next-k">${idx === 0 ? 'Next event' : 'Upcoming event'}</p>${list.length > 1 ? `<span class="hx-next-nav"><button type="button" data-nx="-1" aria-label="Previous event" ${idx === 0 ? 'disabled' : ''}>‹</button><span>${idx + 1} of ${list.length}</span><button type="button" data-nx="1" aria-label="Next upcoming event" ${idx === list.length - 1 ? 'disabled' : ''}>›</button></span>` : ''}</div>
      <h3>${esc(H.title(inv))}</h3>
      ${start ? `<p class="hx-live" data-start="${start.getTime()}">${icon('clock')}<span>${esc(liveText(start.getTime()))}</span></p>` : ''}
      <ul class="hx-next-facts">
        <li>${icon('calendar')}<span>${esc(e.name ? e.name + ' · ' : '')}${esc(fmtDay(inv, e.date))}${e.start ? ' · ' + esc(IX.fmtTime(e.date, e.start, tz, 'en')) : ''}</span></li>
        ${hasVenue(e) ? `<li>${icon('pin')}<span>${esc([e.venue, e.city].filter(Boolean).join(', ') || 'Venue')}<a class="hx-dir" target="_blank" rel="noopener" href="${esc(IX.mapsDirectionsUrl(e))}">Get directions ${icon('arrow')}</a></span></li>` : ''}
      </ul>
      ${progress}
      <div class="hx-next-act">
        <a class="btn sm" href="#/edit/${id}/1">${icon('edit')}Edit</a>
        ${pub ? `<a class="btn sm primary" href="#/dash/${id}/share">${icon('share')}Share</a>` : `<a class="btn sm primary" href="#/edit/${id}/share">${icon('send')}Publish</a>`}
        <button class="btn sm" type="button" data-act="preview" data-id="${id}">${icon('eye')}Preview</button>
        <a class="btn sm" href="#/dash/${id}/guests">${icon('users')}Guests</a>
      </div>
    </article>`;
  }
  function drawNext(v) {
    const box = v.querySelector('#hxNext');
    if (!box) return;
    const list = upcomingList();
    if (!list.length) { box.innerHTML = ''; return; }
    S.nextIdx = Math.min(Math.max(0, S.nextIdx), list.length - 1);
    box.innerHTML = nextCard(list, S.nextIdx);
    box.querySelectorAll('[data-nx]').forEach((b) => (b.onclick = () => { S.nextIdx += +b.dataset.nx; drawNext(v); const f = box.querySelector(`[data-nx="${b.dataset.nx}"]:not([disabled])`) || box.querySelector('[data-nx]:not([disabled])'); f && f.focus(); }));
    box.querySelectorAll('[data-act]').forEach((b) => (b.onclick = (e) => act(e, b, v)));
  }

  /* ---------- charts from real replies (every part opens the people behind it) ---------- */
  const kids = (n) => `${n} ${n === 1 ? 'child' : 'children'}`;
  const pct = (n, of) => (of ? Math.round((n / of) * 100) + '%' : '0%');
  const SEG = [['yes', 'Confirmed', '#1f8a5b'], ['maybe', 'Not sure', '#e0a000'], ['no', 'Declined', '#c2373f'], ['awaiting', 'Waiting', '#b9abbf'], ['notsent', 'Not sent', '#e6dfe8']];
  const segN = (f, k) => (k === 'awaiting' ? f.awaiting : k === 'notsent' ? f.notSent : f[k]);
  function donut(f) {
    const sum = SEG.reduce((a, [k]) => a + segN(f, k), 0);
    let off = 0;
    const arcs = sum ? SEG.filter(([k]) => segN(f, k)).map(([k, l, c]) => { const n = segN(f, k), p = (n / sum) * 100; const el = `<circle data-list="${k}" cx="21" cy="21" r="15.9" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${25 - off}"><title>${l}: ${n}</title></circle>`; off += p; return el; }).join('') : '';
    return `<svg class="hx-donut" viewBox="0 0 42 42" role="img" aria-label="Guests: ${SEG.map(([k, l]) => `${segN(f, k)} ${l.toLowerCase()}`).join(', ')}">
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1ebe4" stroke-width="5"/>${arcs}
      <text x="21" y="20.5" text-anchor="middle" class="hx-donut-n">${f.people}</text><text x="21" y="25.5" text-anchor="middle" class="hx-donut-l">${f.people === 1 ? 'guest' : 'guests'}</text></svg>`;
  }
  // replies per week for the last 8 weeks: "coming" vs other answers
  const WK = 7 * 864e5;
  const weekIdx = (r, now) => 7 - Math.floor((now - Date.parse(r.createdAt || r.updatedAt)) / WK);
  function trend(items) {
    const now = Date.now();
    const weeks = Array.from({ length: 8 }, (_, i) => ({ end: now - (7 - i) * WK, yes: 0, other: 0 }));
    items.forEach((it) => it.rsvps.forEach((r) => {
      const i = weekIdx(r, now);
      if (i >= 0 && i < 8) weeks[i][r.status === 'yes' ? 'yes' : 'other']++;
    }));
    const max = Math.max(1, ...weeks.map((w) => w.yes + w.other));
    const total = weeks.reduce((a, w) => a + w.yes + w.other, 0);
    const lbl = (w) => new Date(w.end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `<div class="hx-trend" role="group" aria-label="${total} replies in the last 8 weeks">${weeks.map((w, i) => { const n = w.yes + w.other; return `<button type="button" class="hx-wk ${i === 7 ? 'now' : ''}" data-list="week:${i}" ${n ? '' : 'disabled'} aria-label="Week to ${esc(lbl(w))}: ${w.yes} coming, ${w.other} other replies" title="Week to ${esc(lbl(w))}: ${w.yes} coming, ${w.other} other">
        <span class="hx-wk-bar"><i class="o" style="height:${(w.other / max) * 100}%"></i><i class="y" style="height:${(w.yes / max) * 100}%"></i></span>
        ${n ? `<b>${n}</b>` : '<b class="z">0</b>'}<small>${i === 7 ? 'This week' : esc(lbl(w))}</small></button>`; }).join('')}</div>
      <p class="hx-trend-leg"><span class="y"></span>Coming <span class="o"></span>Other replies · <b>${total}</b> in 8 weeks · tap a week to see who</p>`;
  }

  /* ---------- the people behind a number ---------- */
  const LIST_T = { yes: 'Confirmed', maybe: 'Not sure yet', no: 'Declined', awaiting: 'Waiting for a reply', notsent: 'Not sent yet' };
  function listRows(kind, items) {
    const rows = [];
    const people = (r) => (r.status === 'no' ? 0 : (r.adults || 0) + (r.children || 0));
    const reply = (it, r) => rows.push({ name: r.name || 'A guest', inv: it.inv, n: people(r), status: r.status, note: 'Replied ' + agoL(r.updatedAt || r.createdAt) + (r.guestId ? '' : ' · general link'), href: `#/dash/${it.inv.id}/responses/${r.status}`, cta: 'Open' });
    if (LIST_T[kind] && ['yes', 'maybe', 'no'].includes(kind)) items.forEach((it) => it.rsvps.filter((r) => r.status === kind).forEach((r) => reply(it, r)));
    else if (kind === 'awaiting' || kind === 'notsent') items.forEach((it) => {
      const answered = new Set(it.rsvps.map((r) => r.guestId).filter(Boolean));
      it.guests.forEach((g) => {
        if (answered.has(g.id)) return;
        const sent = g.sentAt || g.remindedAt || g.openedAt;
        if (kind === 'awaiting' ? !sent : sent) return;
        rows.push({ name: g.name, inv: it.inv, n: null, note: kind === 'notsent' ? 'Not sent yet' : g.openedAt ? 'Opened the link ' + agoL(g.openedAt) : 'Sent ' + agoL(g.remindedAt || g.sentAt), href: `#/dash/${it.inv.id}/guests/${kind === 'notsent' ? 'new' : g.openedAt ? 'opened' : 'pending'}`, cta: kind === 'notsent' ? 'Send' : 'Remind' });
      });
    });
    else if (/^week:\d$/.test(kind)) { const i = +kind.slice(5), now = Date.now(); items.forEach((it) => it.rsvps.filter((r) => weekIdx(r, now) === i).forEach((r) => reply(it, r))); }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  function showList(kind, items) {
    const rows = listRows(kind, items);
    const week = /^week:/.test(kind);
    const title = week ? (+kind.slice(5) === 7 ? 'Replies this week' : `Replies in the week to ${new Date(Date.now() - (7 - kind.slice(5)) * WK).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`) : LIST_T[kind] || 'Guests';
    const heads = rows.reduce((a, r) => a + (r.n || 0), 0);
    const word = { yes: 'Coming', no: 'Declined', maybe: 'Not sure' };
    const scopeName = S.scope === 'all' ? `all ${S.items.length === 1 ? 'invitations' : S.items.length + ' invitations'}` : H.title(items[0].inv);
    H.modal({
      title,
      body: `<div class="hx-pl">
        <p class="small muted" style="margin:0">${rows.length} ${rows.length === 1 ? 'guest' : 'guests'}${heads ? ` · ${heads} ${heads === 1 ? 'person' : 'people'}` : ''} · ${esc(scopeName)}</p>
        ${rows.length > 6 ? `<label class="hx-search sm">${icon('search')}<span class="sr-only">Search this list</span><input type="search" data-plq placeholder="Search by name or invitation" autocomplete="off"></label>` : ''}
        ${rows.length ? `<ul class="hx-pl-list">${rows.map((r) => `<li data-s="${esc((r.name + ' ' + H.title(r.inv)).toLowerCase())}"><span class="hx-pl-t"><b>${esc(r.name)}</b><small>${esc(H.title(r.inv))} · ${esc(r.note)}</small></span>${r.n != null ? `<span class="hx-pl-n">${r.status && week ? `<span class="pill ${r.status}">${word[r.status]}</span>` : ''}${r.status !== 'no' ? `<b>${r.n}</b><small>${r.n === 1 ? 'person' : 'people'}</small>` : ''}</span>` : ''}<a class="btn sm" href="${esc(r.href)}" data-close>${esc(r.cta)}</a></li>`).join('')}</ul>` : `<p class="muted">Nobody here yet.</p>`}
      </div>`,
      actions: [{ label: 'Close', value: null }],
      onOpen: (modal, done) => {
        modal.querySelectorAll('[data-close]').forEach((a) => a.addEventListener('click', () => done(null)));
        const q = modal.querySelector('[data-plq]');
        if (q) q.oninput = () => { const s = q.value.trim().toLowerCase(); modal.querySelectorAll('.hx-pl-list li').forEach((li) => (li.hidden = !!s && !li.dataset.s.includes(s))); };
      },
    });
  }
  // one click handler for every [data-list] inside a box
  const wireLists = (box) => { if (box) box.onclick = (e) => { const t = e.target.closest('[data-list]'); if (t && !t.disabled) showList(t.dataset.list, scoped()); }; };

  /* ---------- calendar with the host's event dates ---------- */
  const CAL = { y: 0, m: 0, sel: '' };
  function calEvents(items) {
    const map = {};
    items.forEach((it) => (it.inv.events || []).forEach((e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) (map[e.date] = map[e.date] || []).push({ e, it }); }));
    Object.values(map).forEach((l) => l.sort((a, b) => (a.e.start || '').localeCompare(b.e.start || '')));
    return map;
  }
  function calendar(items) {
    const map = calEvents(items);
    if (!CAL.y) { const t = new Date(); CAL.y = t.getFullYear(); CAL.m = t.getMonth(); }
    const first = new Date(Date.UTC(CAL.y, CAL.m, 1)), days = new Date(Date.UTC(CAL.y, CAL.m + 1, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // weeks start on Monday
    const today = todayIn();
    const key = (d) => `${CAL.y}-${String(CAL.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cells = Array.from({ length: lead }, () => '<span></span>').concat(Array.from({ length: days }, (_, i) => {
      const k = key(i + 1), has = map[k];
      return `<button type="button" class="hx-cal-d ${k === today ? 'today' : ''} ${has ? 'has' : ''} ${k === CAL.sel ? 'sel' : ''}" data-cal="${k}" aria-pressed="${k === CAL.sel}" aria-label="${i + 1}${has ? `: ${has.length} ${has.length === 1 ? 'event' : 'events'}` : ''}">${i + 1}${has ? '<i></i>' : ''}</button>`;
    }));
    const month = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    // under the calendar: the chosen day's events in full, else the next three from today
    const sel = CAL.sel, dayList = sel ? map[sel] || [] : null;
    const pick = dayList || Object.keys(map).filter((k) => k >= today).sort().flatMap((k) => map[k]).slice(0, 3);
    const selLabel = sel ? new Date(sel + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';
    const head = sel ? `<div class="hx-cal-sum"><b>${esc(selLabel)}</b><span>${dayList.length ? `${dayList.length} ${dayList.length === 1 ? 'event' : 'events'}` : 'No events'}</span><button type="button" class="hx-cal-x" data-calclear>Show upcoming</button></div>` : '<div class="hx-cal-sum"><b>Coming up</b><span>Tap a date to see its events</span></div>';
    const item = ({ e, it }) => {
      const tz = it.inv.timezone, ev = it.st.events[e.id] || { heads: 0 }, pub = it.inv.status === 'published', id = esc(it.inv.id);
      return `<li><a class="hx-cal-ev" href="#/dash/${id}/overview"><span class="hx-day"><b>${esc(IX.fmtDate(e.date, tz, 'en', { day: 'numeric', timeZone: tz }))}</b><small>${esc(IX.fmtDate(e.date, tz, 'en', { weekday: 'short', timeZone: tz }))}</small></span><span class="hx-ev-t"><b>${esc(e.name || H.title(it.inv))}</b><small>${esc(H.title(it.inv))}${e.start ? ' · ' + esc(IX.fmtTime(e.date, e.start, tz, 'en')) : ''}</small></span></a>
        ${sel ? `<div class="hx-cal-more">${e.venue ? `<span>${icon('pin')}${esc([e.venue, e.city].filter(Boolean).join(', '))}</span>` : ''}<span>${icon('users')}${pub ? `${ev.heads} coming` : 'Draft'}</span>
          <span class="hx-cal-links"><a href="#/dash/${id}/guests">Guests</a>${hasVenue(e) ? `<a target="_blank" rel="noopener" href="${esc(IX.mapsDirectionsUrl(e))}">Directions</a>` : ''}</span></div>` : ''}</li>`;
    };
    return `<div class="hx-cal-h"><button type="button" class="hx-cal-nav" data-calm="-1" aria-label="Previous month">‹</button><b>${esc(month)}</b><button type="button" class="hx-cal-nav" data-calm="1" aria-label="Next month">›</button></div>
      <div class="hx-cal-g" role="group" aria-label="${esc(month)}">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<span class="hx-cal-w" aria-hidden="true">${d}</span>`).join('')}${cells.join('')}</div>
      <div aria-live="polite">${head}
      <ul class="hx-cal-list">${pick.length ? pick.map(item).join('') : `<li class="muted small">${sel ? 'Nothing planned on this day.' : 'No upcoming events.'}</li>`}</ul></div>`;
  }
  function wireCalendar(v) {
    const box = v.querySelector('.hx-cal-card');
    if (!box) return;
    box.onclick = (e) => {
      const m = e.target.closest('[data-calm]'), d = e.target.closest('[data-cal]'), x = e.target.closest('[data-calclear]');
      let focus = '';
      if (m) { CAL.m += +m.dataset.calm; if (CAL.m < 0) { CAL.m = 11; CAL.y--; } if (CAL.m > 11) { CAL.m = 0; CAL.y++; } CAL.sel = ''; focus = `[data-calm="${m.dataset.calm}"]`; }
      else if (d) { CAL.sel = CAL.sel === d.dataset.cal ? '' : d.dataset.cal; focus = `[data-cal="${d.dataset.cal}"]`; }
      else if (x) { CAL.sel = ''; }
      else return;
      box.innerHTML = calendar(S.items);
      const f = focus && box.querySelector(focus);
      if (f) f.focus();
    };
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

  /* ---------- the numbers block: tiles + funnel + charts, for the chosen scope ---------- */
  function drawStats(v) {
    const tiles = v.querySelector('#hxTiles'), charts = v.querySelector('#hxCharts');
    if (!tiles) return;
    const items = scoped(), f = total(items);
    const scopeName = S.scope === 'all' ? 'All invitations' : H.title(items[0].inv);
    const tile = (ic, label, val, sub, list, extra = '') => `<${list ? `button type="button" data-list="${list}"` : 'div'} class="hx-tile ${list ? 'click' : ''}"><span class="hx-tile-ic">${icon(ic)}</span><span class="hx-tile-l">${label}</span><b class="hx-tile-v">${val}</b><span class="hx-tile-s">${sub}</span>${extra}${list ? '<span class="hx-tile-go">See who</span>' : ''}</${list ? 'button' : 'div'}>`;
    const dReplies = weekCompare(items, () => 1), dPeople = weekCompare(items, (r) => (r.status === 'yes' ? (r.adults || 0) + (r.children || 0) : 0));
    const pend = [f.awaitingOpened ? `${f.awaitingOpened} opened the link` : '', f.notSent ? `${f.notSent} not sent yet` : ''].filter(Boolean).join(' · ');
    tiles.innerHTML = `
      ${tile('chart', 'Response rate', f.rate == null ? '–' : f.rate + '%', f.reached ? `${f.replies} of ${f.reached} who received it replied` : f.added ? 'Nobody has been sent it yet' : 'Share an invitation to start', '', deltaHtml(dReplies, f.replies === 1 ? 'reply' : 'replies'))}
      ${tile('check', 'Confirmed attendees', f.attendees, f.yes ? `from ${f.yes} “yes” ${f.yes === 1 ? 'reply' : 'replies'} · ${f.adults} adults · ${kids(f.children)}` : 'No “yes” replies yet', f.yes ? 'yes' : '', deltaHtml(dPeople, 'people'))}
      ${tile('clock', 'Pending responses', f.awaiting, f.awaiting || pend ? (pend || 'received it, no reply yet') : 'Nobody is waiting to reply', f.awaiting ? 'awaiting' : f.notSent ? 'notsent' : '')}
      ${tile('users', 'Expected attendance', f.expectedHigh > f.attendees ? `${f.attendees}–${f.expectedHigh}` : f.attendees, f.expectedHigh > f.attendees ? `${f.attendees} confirmed + up to ${f.maybeHeads} who said maybe` : f.attendees ? 'All confirmed' : 'Grows as guests say yes')}`;
    v.querySelector('#hxFunnel').innerHTML = `<ol class="hx-funnel" aria-label="From guest list to replies">
        <li><b>${f.added}</b><span>Guests added</span></li>
        <li><b>${f.shared}</b><span>Invitation shared</span>${f.notSent ? `<button type="button" data-list="notsent">${f.notSent} not sent</button>` : ''}</li>
        <li><b>${f.opened}</b><span>Opened their link</span></li>
        <li><b>${f.replies}</b><span>Replied</span>${f.general ? `<small>incl. ${f.general} by general link</small>` : ''}</li>
      </ol>`;
    wireLists(tiles); wireLists(v.querySelector('#hxFunnel'));
    const legendSum = SEG.reduce((a, [k]) => a + segN(f, k), 0);
    charts.innerHTML = `<div class="hx-panel hx-donut-card">
        <div class="hx-panel-h"><h3>RSVP status</h3><span class="tiny muted">${esc(scopeName)}</span></div>
        <div class="hx-donut-wrap">${donut(f)}
          <ul class="hx-legend">${SEG.map(([k, l]) => { const n = segN(f, k); return `<li class="${k}"><button type="button" data-list="${k}" ${n ? '' : 'disabled'} aria-label="${l}: ${n}. Show guests"><i></i><span>${l}<b>${n}</b>${k === 'yes' && f.attendees ? `<small>${f.attendees} people</small>` : ''}</span><em>${pct(n, legendSum)}</em></button></li>`; }).join('')}</ul>
        </div>
        <p class="hx-expect"><span>Expected attendees</span><b>${f.expectedHigh > f.attendees ? `${f.attendees}–${f.expectedHigh}` : f.attendees}</b><small>${f.adults} adults · ${kids(f.children)} confirmed${f.maybeHeads ? ` · up to ${f.maybeHeads} more from “maybe”` : ''}</small></p>
      </div>
      <div class="hx-panel">
        <div class="hx-panel-h"><h3>Replies by week</h3><span class="tiny muted">${esc(scopeName)} · last 8 weeks</span></div>
        ${trend(items)}
      </div>`;
    wireLists(charts);
  }

  /* ---------- home ---------- */
  H.routes.home = async (v) => {
    const invs = await H.store.listInvitations();
    S.items = await Promise.all(invs.map(async (inv) => {
      const [rsvps, guests] = await Promise.all([H.store.listRsvps(inv.id), H.store.listGuests(inv.id)]);
      return { inv, rsvps, guests, st: M.stats(rsvps, guests, inv.events), f: funnel(rsvps, guests), info: eventInfo(inv), art: await thumbArt(inv) };
    }));
    if (S.scope !== 'all' && !S.items.some((it) => it.inv.id === S.scope)) S.scope = 'all';
    S.activity = buildActivity(S.items);
    const upcoming = upcomingList();
    const next = upcoming[0];
    S.nextIdx = 0;
    const todo = attention(S.items);
    const evRows = eventRows(S.items);
    const maxHeads = Math.max(1, ...evRows.map((r) => Math.max(r.heads, r.it.f.people)));

    const recent = S.items.flatMap((it) => it.rsvps.map((r) => ({ r, it }))).sort((x, y) => (y.r.updatedAt || '').localeCompare(x.r.updatedAt || ''));
    const nav = [['dash', 'Dashboard', 'chart', '#hxTop'], ['invs', 'My invitations', 'send', '#hxListH'], ['guests', 'Guests & replies', 'users', '#hxIntelH'], ['events', 'Events', 'calendar', '#hxEvH'], ['replies', 'Recent replies', 'check', '#hxRepH'], ['activity', 'Activity', 'clock', '#hxActH']];
    const scopeOpts = [['all', `All invitations (${S.items.length})`], ...S.items.map((it) => [it.inv.id, H.title(it.inv)])];

    H.render(`<div class="hx hx3">
      <nav class="hx-rail" aria-label="Dashboard">
        <a class="btn primary hx-rail-new" href="#/new" title="Create invitation">${icon('plus')}<span>Create invitation</span></a>
        <button type="button" class="hx-rail-tg" aria-expanded="false" aria-controls="hxRailMenu">${icon('more')}<span>Sections</span></button>
        <div class="hx-rail-menu" id="hxRailMenu">
          <ul>${nav.map(([k, l, ic, href], i) => `<li><a href="${href}" data-jump title="${l}" class="${i === 0 ? 'on' : ''}">${icon(ic)}<span>${l}</span></a></li>`).join('')}</ul>
          <ul class="hx-rail-sub">${H.isAdmin && H.isAdmin() ? `<li><a href="#/admin" title="Admin">${icon('users')}<span>Admin</span></a></li>` : ''}<li><a href="#/settings" title="Settings">${icon('spark')}<span>Settings</span></a></li><li><a href="#/help" title="Help">${icon('open')}<span>Help</span></a></li></ul>
        </div>
      </nav>

      <div class="hx-center">
        <header class="hx-head" id="hxTop">
          <div>
            <p class="hx-eyebrow">${esc(greeting())}</p>
            <h1>Every occasion deserves an extraordinary invitation.</h1>
            <p class="hx-lead">${next ? `Your next event, <b>${esc(H.title(next.inv))}</b>, is ${esc(countdown(next.info.days).toLowerCase())}.` : 'Design it, write it, share it on WhatsApp, and see who is coming, all in one place.'}</p>
          </div>
          <a class="btn primary lg hx-head-cta" href="#/new">${icon('plus')}Create new invitation</a>
        </header>

        ${S.items.length ? `<section class="hx-stats" aria-labelledby="hxStatsH">
          <div class="hx-stats-h"><h2 id="hxStatsH" class="hx-h">Your numbers</h2>
            <label class="hx-scope"><span>Showing</span><select id="hxScope" class="input">${scopeOpts.map(([k, l]) => `<option value="${esc(k)}" ${k === S.scope ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
          <div class="hx-tiles" id="hxTiles"></div>
          <div id="hxFunnel"></div>
        </section>` : ''}

        <section class="hx-quick" aria-labelledby="hxQuickH">
          <h2 id="hxQuickH" class="hx-h">Start with an occasion</h2>
          <div class="hx-quick-row">
            ${QUICK.map((q) => { const c = IXT.CATEGORIES.find((x) => x.id === q.cat) || {}; const t = IXT.THEMES[c.theme] || {}; const p = (t.palettes || [{}])[0]; return `<a class="hx-occ" href="#/new/${q.cat}" style="--o-bg:${esc(p.bg || '#fff')};--o-acc:${esc(p.accent || '#c9a15a')}"><span class="hx-occ-sw" aria-hidden="true"></span>${esc(q.label)}</a>`; }).join('')}
            <a class="hx-occ more" href="#/new">All occasions</a>
          </div>
        </section>

        ${S.items.length ? `<section class="hx-intel" aria-labelledby="hxIntelH">
          <h2 id="hxIntelH" class="hx-h">Guests and replies</h2>
          <div class="hx-charts" id="hxCharts"></div>
          <div class="hx-panel">
            <div class="hx-panel-h"><h3 id="hxEvH">Event-wise tracking</h3><span class="tiny muted">People coming to each upcoming event</span></div>
            ${evRows.length ? `<ol class="hx-evs">${evRows.slice(0, 6).map((r) => `<li><a href="#/dash/${esc(r.it.inv.id)}/overview">
              <span class="hx-day"><b>${esc(IX.fmtDate(r.e.date, r.it.inv.timezone, 'en', { day: 'numeric', timeZone: r.it.inv.timezone }))}</b><small>${esc(IX.fmtDate(r.e.date, r.it.inv.timezone, 'en', { month: 'short', timeZone: r.it.inv.timezone }))}</small></span>
              <span class="hx-ev-t"><b>${esc(r.e.name || H.title(r.it.inv))}</b><small>${esc(H.title(r.it.inv))}${r.e.start ? ' · ' + esc(IX.fmtTime(r.e.date, r.e.start, r.it.inv.timezone, 'en')) : ''}${r.e.venue ? ' · ' + esc(r.e.venue) : ''}</small></span>
              <span class="hx-ev-n"><span class="hx-ev-bar"><i style="width:${Math.round((r.heads / maxHeads) * 100)}%"></i></span><b>${r.heads}</b><small>${r.it.inv.status === 'published' ? 'coming' : 'draft'}</small></span>
              <span class="hx-count ${r.days <= 7 ? 'soon' : ''}">${esc(countdown(r.days))}</span>
            </a></li>`).join('')}</ol>${evRows.length > 6 ? `<p class="tiny muted" style="margin:.5rem 0 0">${evRows.length - 6} more upcoming ${evRows.length - 6 === 1 ? 'event' : 'events'} in the calendar.</p>` : ''}` : '<p class="muted small" style="margin:0">No upcoming events. Add a date to an invitation to track it here.</p>'}
          </div>
        </section>` : ''}

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
        </section>

        ${S.items.length ? `<section class="hx-panel hx-replies" aria-labelledby="hxRepH">
          <div class="hx-panel-h"><h2 id="hxRepH" class="hx-h">Recent replies</h2>
            <label class="hx-search sm">${icon('search')}<span class="sr-only">Search replies</span><input id="hxRepQ" type="search" placeholder="Search name, event or reference" autocomplete="off"></label></div>
          <div id="hxRep"></div>
        </section>` : ''}
      </div>

      ${S.items.length ? `<aside class="hx-side" aria-label="Upcoming, attention and activity">
        <div id="hxNext"></div>
        <section class="hx-panel hx-cal-card" aria-label="Calendar">${calendar(S.items)}</section>
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
    </div>`);

    drawStats(v);
    drawNext(v);
    const sc = v.querySelector('#hxScope');
    if (sc) sc.onchange = () => { S.scope = sc.value; savePrefs(); drawStats(v); };
    // live countdown on the event panel
    const tick = setInterval(() => v.querySelectorAll('.hx-live[data-start]').forEach((p) => { p.querySelector('span').textContent = liveText(+p.dataset.start); }), 30000);
    H.cleanup.push(() => clearInterval(tick));

    // recent replies table (searchable)
    const drawRep = (q) => {
      const box = v.querySelector('#hxRep');
      if (!box) return;
      const s2 = (q || '').trim().toLowerCase();
      const rows = recent.filter(({ r, it }) => !s2 || [r.name, r.ref, H.title(it.inv)].join(' ').toLowerCase().includes(s2)).slice(0, 8);
      const word = { yes: 'Coming', no: 'Declined', maybe: 'Not sure' };
      box.innerHTML = rows.length ? `<div class="tbl-wrap"><table class="tbl hx-tbl"><thead><tr><th>Reference</th><th>Date</th><th>Guest</th><th>Invitation</th><th class="num">People</th><th>Status</th></tr></thead><tbody>
        ${rows.map(({ r, it }) => `<tr><td class="mono">${esc(r.ref || '—')}</td><td>${esc(new Date(r.updatedAt || r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}</td><td><b>${esc(r.name || '')}</b></td><td><a href="#/dash/${esc(it.inv.id)}/responses">${esc(H.title(it.inv))}</a></td><td class="num">${r.status === 'no' ? 0 : (r.adults || 0) + (r.children || 0)}</td><td><span class="pill ${r.status}">${word[r.status] || r.status}</span></td></tr>`).join('')}
        </tbody></table></div>` : `<p class="muted small" style="margin:0">${s2 ? 'No replies match.' : 'Replies from guests will appear here.'}</p>`;
    };
    drawRep('');
    const rq = v.querySelector('#hxRepQ');
    if (rq) rq.oninput = () => drawRep(rq.value);

    // left menu: icon-only on mid screens, a fold-away "Sections" bar on phones
    const rail = v.querySelector('.hx-rail'), tg = v.querySelector('.hx-rail-tg');
    const topbar = document.querySelector('.topbar');
    const setTop = () => v.querySelector('.hx3') && v.querySelector('.hx3').style.setProperty('--hx-top', (topbar ? topbar.offsetHeight : 56) + 'px');
    setTop();
    window.addEventListener('resize', setTop);
    H.cleanup.push(() => window.removeEventListener('resize', setTop));
    const fold = (open) => { rail.classList.toggle('open', open); tg.setAttribute('aria-expanded', String(open)); };
    tg.onclick = () => fold(!rail.classList.contains('open'));
    const jumps = [...v.querySelectorAll('[data-jump]')];
    const mark = (a) => jumps.forEach((x) => { x.classList.toggle('on', x === a); if (x === a) x.setAttribute('aria-current', 'location'); else x.removeAttribute('aria-current'); });
    jumps.forEach((a) => (a.onclick = (e) => {
      const t = v.querySelector(a.getAttribute('href'));
      if (!t) return;
      e.preventDefault();
      mark(a); fold(false);
      t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }));
    // highlight the section in view
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((ents) => {
        const vis = ents.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) { const a = jumps.find((j) => j.getAttribute('href') === '#' + vis.target.id); if (a) mark(a); }
      }, { rootMargin: '-15% 0px -70% 0px' });
      jumps.forEach((a) => { const t = v.querySelector(a.getAttribute('href')); if (t) io.observe(t); });
      H.cleanup.push(() => io.disconnect());
    }
    wireCalendar(v);

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

    const sr = v.querySelector('#hxSearch'), so = v.querySelector('#hxSort');
    so.value = S.sort;
    sr.value = S.q;
    let t;
    sr.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.q = sr.value; renderList(v); }, 120); };
    so.onchange = () => { S.sort = so.value; savePrefs(); renderList(v); };
    v.querySelectorAll('[data-filter]').forEach((b) => (b.onclick = () => { S.filter = b.dataset.filter; savePrefs(); renderList(v); }));
    const ss = v.querySelector('#loadSamplesSide');
    if (ss) ss.onclick = loadSamples(ss);
    const outside = (e) => { if (!e.target.closest('.hx-menu')) closeMenus(); if (!e.target.closest('.hx-rail')) fold(false); };
    const esc2 = (e) => { if (e.key === 'Escape') { closeMenus(); if (rail.classList.contains('open')) { fold(false); tg.focus(); } } };
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
    await H.applyPrefs(inv);
    await H.store.saveInvitation(inv);
    H.go('#/edit/' + inv.id + '/1');
  };
})();
