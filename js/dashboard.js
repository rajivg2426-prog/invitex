/* InviteX host RSVP dashboard, guest list, sharing, reminders, check-in. */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model, esc = IX.esc, H = window.H;
  const TABS = [['overview', 'Overview'], ['responses', 'Responses'], ['guests', 'Guests & reminders'], ['share', 'Share'], ['checkin', 'Check-in']];
  const STATUS = { yes: 'Attending', no: 'Declined', maybe: 'Maybe' };
  const FOOD = { veg: 'Vegetarian', nonveg: 'Non-vegetarian', jain: 'Jain', vegan: 'Vegan', other: 'Other' };
  const DEFAULT_TPL = 'Dear {name},\nWe are delighted to invite you to {event}.\nDate: {date}\nTime: {time}\nVenue: {venue}\nPlease visit our digital invitation and confirm your attendance.\n{link}\nLooking forward to celebrating with you!';
  const DEFAULT_REM = 'Dear {name},\nA gentle reminder to confirm your attendance for {event} on {date}.\nPlease reply here: {link}\nThank you!';
  // Hand-written message templates for Hindi and Punjabi invitations (not translated by a machine).
  const LANG_TPL = {
    hi: {
      invite: 'प्रिय {name},\n{event}\nइस अवसर पर आप सादर आमंत्रित हैं।\nतिथि: {date}\nसमय: {time}\nस्थान: {venue}\nकृपया हमारा डिजिटल निमंत्रण देखें और अपने आने की पुष्टि करें।\n{link}\nआपकी प्रतीक्षा रहेगी!',
      remind: 'प्रिय {name},\n{event} – {date}\nकृपया अपने आने की पुष्टि करना न भूलें।\nयहाँ जवाब दें: {link}\nधन्यवाद!',
      friend: 'मित्र',
    },
    pa: {
      invite: 'ਪਿਆਰੇ {name},\n{event}\nਇਸ ਮੌਕੇ ਤੇ ਤੁਹਾਨੂੰ ਨਿੱਘਾ ਸੱਦਾ ਹੈ।\nਮਿਤੀ: {date}\nਸਮਾਂ: {time}\nਥਾਂ: {venue}\nਕਿਰਪਾ ਕਰਕੇ ਸਾਡਾ ਡਿਜੀਟਲ ਸੱਦਾ ਵੇਖੋ ਅਤੇ ਆਪਣੇ ਆਉਣ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ।\n{link}\nਤੁਹਾਡੀ ਉਡੀਕ ਰਹੇਗੀ!',
      remind: 'ਪਿਆਰੇ {name},\n{event} – {date}\nਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਆਉਣ ਦੀ ਪੁਸ਼ਟੀ ਕਰਨਾ ਨਾ ਭੁੱਲਣਾ।\nਇੱਥੇ ਜਵਾਬ ਦਿਓ: {link}\nਧੰਨਵਾਦ!',
      friend: 'ਦੋਸਤ',
    },
  };
  // Short message that goes with the card image (the WhatsApp format): a greeting line used only in
  // personal invites, then one classy line, the event and date, and the RSVP link.
  const CARD_TPL = {
    en: { hello: 'Dear {name},', body: "You're warmly invited to celebrate with us.\n{event} · {date}\nRSVP here: {link}", scan: 'Scan to RSVP' },
    hi: { hello: 'प्रिय {name},', body: 'आप सादर आमंत्रित हैं।\n{event} · {date}\nयहाँ जवाब दें: {link}', scan: 'जवाब देने के लिए स्कैन करें' },
    pa: { hello: 'ਪਿਆਰੇ {name},', body: 'ਤੁਹਾਨੂੰ ਨਿੱਘਾ ਸੱਦਾ ਹੈ।\n{event} · {date}\nਇੱਥੇ ਜਵਾਬ ਦਿਓ: {link}', scan: 'ਜਵਾਬ ਦੇਣ ਲਈ ਸਕੈਨ ਕਰੋ' },
  };
  let D = null;

  H.routes.dash = async (v, id, tab, sub) => {
    const inv = await H.store.getInvitation(id);
    if (!inv) return H.render('<div class="card"><h2>Invitation not found</h2><a class="btn" href="#/">Back</a></div>');
    D = { inv, tab: TABS.some((t) => t[0] === tab) ? tab : 'overview', filter: '', q: '' };
    // deep links from the home dashboard: #/dash/<id>/responses/yes, #/dash/<id>/guests/pending
    if (D.tab === 'responses' && ['yes', 'no', 'maybe'].includes(sub)) D.filter = sub;
    if (D.tab === 'guests' && ['new', 'pending', 'opened', 'responded'].includes(sub)) D.gf = sub;
    await reload();
    const refresh = async () => { if (D && D.inv.id === inv.id) { await reload(); renderTab(); } };
    window.addEventListener('focus', refresh);
    const iv = IX.isProduction ? setInterval(refresh, 30000) : null;
    H.cleanup.push(() => { window.removeEventListener('focus', refresh); iv && clearInterval(iv); });
    H.render(`
      <div class="dash-head">
        <div><h1 style="margin:0">${esc(H.title(inv))}</h1>
          <div class="row small muted"><span class="pill ${inv.status}">${inv.status === 'published' ? '● Published' : 'Draft – not visible to guests'}</span>${inv.slug ? `<a target="_blank" rel="noopener" href="${esc(IX.inviteUrl(inv.slug))}">${esc(IX.inviteUrl(inv.slug))}</a>` : ''}</div></div>
        <div class="row no-print"><button class="btn sm" id="refresh">Refresh</button><a class="btn sm" href="#/edit/${esc(inv.id)}/1">Edit invitation</a>${inv.calligraphy && inv.calligraphy.active !== false && window.IXC && IXC.exporter ? `<a class="btn sm" id="callDl" href="#/calligraphy/${esc(inv.id)}/download" title="PNG, JPG and PDF of your calligraphy card">✒ Download calligraphy card</a>` : ''}<button class="btn sm danger" id="delInv">Delete</button></div>
      </div>
      ${inv.status !== 'published' ? `<div class="notice warn" style="margin-bottom:1rem">This invitation is a draft. <a href="#/edit/${esc(inv.id)}/share">Publish it</a> to get a shareable link.</div>` : ''}
      ${IX.isProduction ? '' : '<div class="notice warn no-print" style="margin-bottom:1rem"><b>Demo/Local mode:</b> this dashboard only shows RSVPs submitted in <b>this browser</b>. Responses from guests on other phones are not collected until Production mode is configured.</div>'}
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button class="tab ${k === D.tab ? 'on' : ''}" role="tab" aria-selected="${k === D.tab}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="tabBody"></div>`);
    v.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
      D.tab = b.dataset.tab;
      history.replaceState(null, '', `#/dash/${inv.id}/${D.tab}`);
      v.querySelectorAll('[data-tab]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      renderTab();
    }));
    v.querySelector('#refresh').onclick = async () => { await reload(); renderTab(); IX.toast('Updated', 'ok', 1200); };
    v.querySelector('#delInv').onclick = () => H.deleteInvitation(inv.id);
    renderTab();
  };

  async function reload() {
    D.inv = await H.store.getInvitation(D.inv.id) || D.inv;
    [D.rsvps, D.guests] = await Promise.all([H.store.listRsvps(D.inv.id), H.store.listGuests(D.inv.id), window.IXCampaign && D.inv.status === 'published' ? IXCampaign.load(D.inv) : null]);
    D.stats = M.stats(D.rsvps, D.guests, D.inv.events);
  }
  function renderTab() {
    const body = document.getElementById('tabBody');
    if (!body) return;
    ({ overview, responses, guests, share, checkin })[D.tab](body);
  }

  /* ---------- message helpers ---------- */
  // The language of WhatsApp / email messages. Only languages the invitation itself has are offered.
  const msgLangs = () => (D.inv.languages || ['en']).filter((l) => l === 'en' || LANG_TPL[l]);
  const msgLang = () => (msgLangs().includes(D.inv.shareLang) ? D.inv.shareLang : msgLangs().includes(D.inv.defaultLang) ? D.inv.defaultLang : 'en');
  function fill(tpl, guest) {
    const inv = D.inv, ev = (inv.events || []).find((e) => e.date) || inv.events[0] || {};
    const tz = inv.timezone, l = msgLang();
    const extra = l === (inv.defaultLang || 'en') ? {} : { lang: l };
    const link = guest && guest.token ? IX.inviteUrl(inv.slug, { g: guest.token, ...extra }) : IX.inviteUrl(inv.slug, extra);
    return tpl
      .replace(/\{name\}/g, guest ? guest.name : l === 'en' ? 'friend' : LANG_TPL[l].friend)
      .replace(/\{event\}/g, M.txt(inv, l, 'title') || M.txt(inv, 'en', 'title') || M.txt(inv, inv.defaultLang, 'title'))
      .replace(/\{date\}/g, ev.date ? IX.fmtDate(ev.date, tz, l) : '')
      .replace(/\{time\}/g, ev.start ? IX.fmtTime(ev.date, ev.start, tz, l) + (ev.end ? ' – ' + IX.fmtTime(ev.date, ev.end, tz, l) : '') : '')
      .replace(/\{venue\}/g, IX.venueText(ev))
      .replace(/\{link\}/g, link)
      .replace(/ · $/gm, '');
  }
  // 'card' = short message sent with the card image; 'full' = the longer message with time and venue.
  // Hosts who already wrote their own long message keep it until they switch.
  const msgStyle = () => D.inv.msgStyle || (D.inv.shareTemplate || D.inv.shareTemplates ? 'full' : 'card');
  const cardTpl = () => { const l = msgLang(), c = CARD_TPL[l] || CARD_TPL.en; return (D.inv.cardTemplates || {})[l] || c.hello + '\n' + c.body; };
  const tpl = () => { if (msgStyle() === 'card') return cardTpl(); const l = msgLang(); return l === 'en' ? D.inv.shareTemplate || DEFAULT_TPL : (D.inv.shareTemplates || {})[l] || LANG_TPL[l].invite; };
  // The general (not personal) message: the short format drops its greeting line, which needs a name.
  const generalMsg = () => { const t = tpl(); return fill(msgStyle() === 'card' ? t.split('\n').filter((x) => !/\{name\}/.test(x)).join('\n') : t, null); };
  const remTpl = () => { const l = msgLang(); return l === 'en' ? D.inv.reminderTemplate || DEFAULT_REM : (D.inv.reminderTemplates || {})[l] || LANG_TPL[l].remind; };
  async function setTpl(kind, value) {
    const l = msgLang(), inv = D.inv;
    if (kind !== 'remind' && msgStyle() === 'card') inv.cardTemplates = Object.assign({}, inv.cardTemplates, { [l]: value });
    else if (l === 'en') inv[kind === 'remind' ? 'reminderTemplate' : 'shareTemplate'] = value;
    else { const k = kind === 'remind' ? 'reminderTemplates' : 'shareTemplates'; inv[k] = Object.assign({}, inv[k], { [l]: value }); }
    await saveInv();
  }
  function langPicker() {
    const ls = msgLangs();
    if (ls.length < 2) return '';
    return `<div class="field"><span class="lbl">Message language</span><div class="seg" role="group" aria-label="Message language">${ls.map((l) => `<label><input type="radio" name="msgLang" value="${l}" ${l === msgLang() ? 'checked' : ''}>${esc(window.IX_LANGS[l] || l)}</label>`).join('')}</div>
      <span class="hint">Guests open the invitation in this language.</span></div>`;
  }
  function stylePicker() {
    const st = msgStyle(), o = (v, l) => `<label><input type="radio" name="msgStyle" value="${v}" ${v === st ? 'checked' : ''}>${l}</label>`;
    return `<div class="field"><span class="lbl">Message style</span><div class="seg" role="group" aria-label="Message style">${o('card', 'Short, with card image')}${o('full', 'Full details')}</div>
      <span class="hint">${st === 'card' ? 'The card shows the date and venue, so the message stays short: one line, the event and the RSVP link.' : 'A longer message with date, time and venue, for sending without the card.'}</span></div>`;
  }
  function wireLangPicker(body, redraw) {
    body.querySelectorAll('[name=msgLang]').forEach((r) => (r.onchange = async () => { D.inv.shareLang = r.value; await saveInv(); redraw(); }));
    body.querySelectorAll('[name=msgStyle]').forEach((r) => (r.onchange = async () => { D.inv.msgStyle = r.value; await saveInv(); redraw(); }));
  }
  async function saveInv() { await H.store.saveInvitation(D.inv); }

  /* ---------- Overview ---------- */
  function overview(body) {
    const s = D.stats, inv = D.inv;
    const sent = D.guests.filter((g) => g.sentAt).length;
    const cap = inv.settings.maxGuestsTotal;
    const kpi = (v, l, sub = '', hl = false) => `<div class="kpi ${hl ? 'hl' : ''}"><div class="v">${v}</div><div class="l">${esc(l)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
    const total = s.yes + s.no + s.maybe;
    const seg = [['yes', s.yes, '#1f8a5b'], ['maybe', s.maybe, '#e0a000'], ['no', s.no, '#c2373f'], ['pending', s.pending, '#c9c1cf']];
    const sum = seg.reduce((a, x) => a + x[1], 0);
    let off = 0;
    const donut = `<svg viewBox="0 0 42 42" width="150" height="150" role="img" aria-label="Response breakdown: ${s.yes} attending, ${s.maybe} maybe, ${s.no} declined, ${s.pending} pending">
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#f1ecf3" stroke-width="6"/>
      ${sum ? seg.filter((x) => x[1]).map(([, n, c]) => { const pct = (n / sum) * 100; const el = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${c}" stroke-width="6" stroke-dasharray="${pct} ${100 - pct}" stroke-dashoffset="${25 - off}"/>`; off += pct; return el; }).join('') : ''}
      <text x="21" y="20" text-anchor="middle" font-size="8" font-weight="700" fill="#1f1424">${s.attendees}</text><text x="21" y="26" text-anchor="middle" font-size="3.2" fill="#7a6d82">attending</text></svg>`;
    const evs = Object.entries(s.events);
    const maxEv = Math.max(1, ...evs.map(([, e]) => e.heads));
    const foods = Object.entries(s.food);
    const maxFood = Math.max(1, ...foods.map(([, n]) => n));
    body.innerHTML = `
      <div class="kpis">
        ${kpi(s.attendees, 'Confirmed attendees', `${s.adults} adults · ${s.children} children`, true)}
        ${kpi(s.invited, 'Guests on invite list', `${sent} sent via WhatsApp/email`)}
        ${kpi(s.responses, 'Total responses', `${s.responseRate}% response rate`)}
        ${kpi(s.yes, 'Attending (Yes)')}
        ${kpi(s.no, 'Declined')}
        ${kpi(s.maybe, 'Maybe', s.maybeHeads ? `${s.maybeHeads} people tentative` : '')}
        ${kpi(s.pending, 'Pending responses', 'Invited guests yet to reply')}
        ${kpi(s.adults, 'Adults')}
        ${kpi(s.children, 'Children')}
        ${kpi(s.attendanceRate + '%', 'Attendance rate', 'Yes ÷ all responses')}
        ${cap ? kpi(Math.max(0, cap - s.attendees), 'Places remaining', `of ${cap} maximum`) : ''}
      </div>
      <div class="charts">
        <div class="card"><h2>Responses</h2><div class="donut-wrap">${donut}<div class="legend">${seg.map(([k, n, c]) => `<span><i style="background:${c}"></i>${k === 'pending' ? 'Pending' : STATUS[k]}: <b>${n}</b></span>`).join('')}</div></div>
          ${total === 0 ? '<p class="small muted">No responses yet. Share the invitation to start collecting RSVPs.</p>' : ''}</div>
        <div class="card"><h2>Event-wise attendance</h2><div class="bars">${evs.length ? evs.map(([, e]) => `<div class="bar-row"><span>${esc(e.name || 'Event')}</span><div class="bar-track" role="img" aria-label="${e.heads} attending"><div class="bar-fill" style="width:${(e.heads / maxEv) * 100}%"></div></div><b>${e.heads}</b></div>`).join('') : '<p class="muted small">No events.</p>'}</div>
          <p class="tiny muted">People attending each event (adults + children) from “Yes” replies.</p></div>
        <div class="card"><h2>Food preferences</h2><div class="bars">${foods.length ? foods.map(([k, n]) => `<div class="bar-row"><span>${esc(FOOD[k] || k)}</span><div class="bar-track"><div class="bar-fill" style="width:${(n / maxFood) * 100}%;background:linear-gradient(90deg,#c9a15a,#a8823d)"></div></div><b>${n}</b></div>`).join('') : '<p class="muted small">No dietary preferences recorded yet.</p>'}</div></div>
      </div>
      <div class="card" style="margin-top:1rem"><div class="row between"><h2 style="margin:0">Latest responses</h2><button class="btn sm" data-goto="responses">View all</button></div>
        ${D.rsvps.length ? `<div class="tbl-wrap" style="margin-top:.6rem">${table(D.rsvps.slice(0, 5), false)}</div>` : '<p class="muted small">Nothing yet.</p>'}</div>`;
    body.querySelector('[data-goto]').onclick = () => document.querySelector('[data-tab=responses]').click();
  }

  /* ---------- Responses ---------- */
  function table(rows, actions = true) {
    const evName = (id) => (D.inv.events.find((e) => e.id === id) || {}).name || '';
    const gName = (id) => (D.guests.find((g) => g.id === id) || {}).name;
    return `<table class="tbl"><thead><tr><th>Guest</th><th>Status</th><th class="num">Adults</th><th class="num">Children</th><th class="num">Total</th><th>Events</th><th>Food</th><th>Contact</th><th>Notes</th><th>Ref</th>${actions ? '<th class="no-print">Actions</th>' : ''}</tr></thead><tbody>
      ${rows.map((r) => `<tr>
        <td><b>${esc(r.name)}</b>${r.extraNames ? `<div class="tiny muted">+ ${esc(r.extraNames)}</div>` : ''}${r.guestId && gName(r.guestId) ? `<div class="tiny muted">Personal invite: ${esc(gName(r.guestId))}</div>` : ''}</td>
        <td><span class="pill ${r.status}">${STATUS[r.status]}</span>${r.checkedInAt ? '<div class="tiny" style="color:var(--ok)">✔ Checked in</div>' : ''}</td>
        <td class="num">${r.status === 'no' ? 0 : r.adults}</td><td class="num">${r.status === 'no' ? 0 : r.children}</td><td class="num"><b>${r.status === 'no' ? 0 : r.adults + r.children}</b></td>
        <td class="small">${r.status === 'no' ? '—' : (r.eventIds && r.eventIds.length ? r.eventIds.map(evName).filter(Boolean).map(esc).join(', ') : 'All')}</td>
        <td class="small">${esc(FOOD[r.food] || '')}</td>
        <td class="small"><span class="phone" data-full="${esc(r.phone)}">${esc(IX.maskPhone(r.phone))}</span>${r.email ? `<div class="tiny">${esc(r.email)}</div>` : ''}</td>
        <td class="small" style="max-width:220px">${r.requirements ? `<div><b>Needs:</b> ${esc(r.requirements)}</div>` : ''}${r.message ? `<div class="muted">“${esc(r.message)}”</div>` : ''}</td>
        <td class="tiny"><code>${esc(r.ref)}</code><div class="muted">${esc(new Date(r.updatedAt).toLocaleString())}</div></td>
        ${actions ? `<td class="acts no-print"><button class="btn sm" data-edit="${esc(r.id)}">Edit</button> <button class="btn sm danger ghost" data-delr="${esc(r.id)}" aria-label="Delete response">✕</button></td>` : ''}
      </tr>`).join('')}</tbody></table>`;
  }
  function responses(body) {
    const q = D.q.toLowerCase();
    const rows = D.rsvps.filter((r) => (!D.filter || r.status === D.filter) && (!q || r.name.toLowerCase().includes(q) || (r.extraNames || '').toLowerCase().includes(q) || r.ref.toLowerCase().includes(q)));
    const s = D.stats;
    body.innerHTML = `
      <div class="filters no-print">
        <input class="input" type="search" id="q" placeholder="Search by guest name or reference…" value="${esc(D.q)}" aria-label="Search guests">
        <select class="input" id="flt" style="flex:0 1 200px" aria-label="Filter by status"><option value="">All responses (${s.responses})</option><option value="yes">Attending (${s.yes})</option><option value="no">Declined (${s.no})</option><option value="maybe">Maybe (${s.maybe})</option></select>
        <label class="check small"><input type="checkbox" id="showPh"> Show full phone numbers</label>
      </div>
      <div class="row no-print" style="margin-bottom:.8rem">
        <button class="btn sm primary" id="csv">Export CSV / Excel</button>
        <button class="btn sm" id="print">Print list</button>
        <button class="btn sm" id="addR">+ Add response manually</button>
      </div>
      <p class="small"><b>${rows.length}</b> shown · <b>${rows.filter((r) => r.status === 'yes').reduce((a, r) => a + r.adults + r.children, 0)}</b> attending in this view</p>
      ${rows.length ? `<div class="tbl-wrap">${table(rows)}</div>` : '<div class="empty card"><p>No responses match.</p></div>'}`;
    const qi = body.querySelector('#q');
    qi.oninput = IX.debounce(() => { D.q = qi.value; responses(body); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250);
    body.querySelector('#flt').value = D.filter;
    body.querySelector('#flt').onchange = (e) => { D.filter = e.target.value; responses(body); };
    body.querySelector('#showPh').onchange = (e) => body.querySelectorAll('.phone').forEach((p) => (p.textContent = e.target.checked ? p.dataset.full : IX.maskPhone(p.dataset.full)));
    body.querySelector('#csv').onclick = exportCSV;
    body.querySelector('#print').onclick = () => { body.querySelectorAll('.phone').forEach((p) => (p.textContent = p.dataset.full)); window.print(); };
    body.querySelector('#addR').onclick = () => editRsvp(null);
    body.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => editRsvp(D.rsvps.find((r) => r.id === b.dataset.edit))));
    body.querySelectorAll('[data-delr]').forEach((b) => (b.onclick = async () => {
      if (!(await H.confirm('Delete this response?', 'The guest will be able to respond again.', 'Delete', true))) return;
      await H.store.deleteRsvp(b.dataset.delr); await reload(); renderTab();
    }));
  }
  function exportCSV() {
    const evName = (id) => (D.inv.events.find((e) => e.id === id) || {}).name || '';
    const gName = (id) => (D.guests.find((g) => g.id === id) || {}).name || '';
    const rows = [['Reference', 'Guest name', 'Mobile', 'Email', 'Response', 'Adults', 'Children', 'Total attendees', 'Events', 'Food preference', 'Additional guests', 'Special requirements', 'Message to host', 'Checked in', 'Personal invite', 'Language', 'First response', 'Last updated']];
    D.rsvps.forEach((r) => {
      const n = r.status === 'no';
      rows.push([r.ref, r.name, r.phone, r.email, STATUS[r.status], n ? 0 : r.adults, n ? 0 : r.children, n ? 0 : r.adults + r.children, n ? '' : (r.eventIds && r.eventIds.length ? r.eventIds.map(evName).join('; ') : 'All'), FOOD[r.food] || '', r.extraNames, r.requirements, r.message, r.checkedInAt ? new Date(r.checkedInAt).toLocaleString() : '', gName(r.guestId), r.lang || '', new Date(r.createdAt).toLocaleString(), new Date(r.updatedAt).toLocaleString()]);
    });
    const s = D.stats;
    rows.push([], ['TOTALS', '', '', '', `Yes ${s.yes} / No ${s.no} / Maybe ${s.maybe}`, s.adults, s.children, s.attendees]);
    const name = (IX.slugify(H.title(D.inv)) || 'invitation') + '-rsvps-' + new Date().toISOString().slice(0, 10) + '.csv';
    IX.download(name, '﻿' + IX.toCSV(rows), 'text/csv;charset=utf-8'); // BOM so Excel reads Hindi/Punjabi correctly
    IX.toast('CSV downloaded – opens in Excel, Google Sheets or Numbers', 'ok');
  }
  async function editRsvp(r) {
    const inv = D.inv;
    const x = r || { invitationId: inv.id, name: '', phone: '', email: '', status: 'yes', adults: 1, children: 0, food: '', extraNames: '', requirements: '', message: '', eventIds: [] };
    await H.modal({
      title: r ? 'Edit response' : 'Add response',
      body: `<form class="stack" id="ef">
        <div class="f2 stack-sm"><div class="field"><label for="e-n">Name *</label><input class="input" id="e-n" name="name" required value="${esc(x.name)}"></div>
        <div class="field"><label for="e-p">Mobile *</label><input class="input" id="e-p" name="phone" type="tel" required value="${esc(x.phone)}"></div></div>
        <div class="field"><label for="e-e">Email</label><input class="input" id="e-e" name="email" type="email" value="${esc(x.email)}"></div>
        <div class="field"><span class="lbl">Response</span><div class="seg">${Object.entries(STATUS).map(([k, l]) => `<label><input type="radio" name="status" value="${k}" ${x.status === k ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
        <div class="f3"><div class="field"><label for="e-a">Adults</label><input class="input" id="e-a" name="adults" type="number" min="0" max="50" value="${x.adults}"></div>
        <div class="field"><label for="e-c">Children</label><input class="input" id="e-c" name="children" type="number" min="0" max="50" value="${x.children}"></div>
        <div class="field"><label for="e-f">Food</label><select class="input" id="e-f" name="food"><option value="">—</option>${Object.entries(FOOD).map(([k, l]) => `<option value="${k}" ${x.food === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
        ${inv.events.length > 1 ? `<div class="field"><span class="lbl">Events attending</span><div class="row">${inv.events.map((e) => `<label class="check"><input type="checkbox" name="eventIds" value="${esc(e.id)}" ${!x.eventIds.length || x.eventIds.includes(e.id) ? 'checked' : ''}>${esc(e.name)}</label>`).join('')}</div></div>` : ''}
        <div class="field"><label for="e-x">Additional guest names</label><input class="input" id="e-x" name="extraNames" value="${esc(x.extraNames)}"></div>
        <div class="field"><label for="e-r">Special requirements</label><input class="input" id="e-r" name="requirements" value="${esc(x.requirements)}"></div>
        <div class="field"><label for="e-m">Message</label><textarea class="input" id="e-m" name="message">${esc(x.message)}</textarea></div>
        <p class="err" id="e-err" hidden></p></form>`,
      actions: [{ label: 'Cancel', value: null }, {
        label: 'Save', cls: 'primary', onClick: async (m) => {
          const fd = new FormData(m.querySelector('#ef'));
          const p = { name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), status: fd.get('status'), adults: IX.int(fd.get('adults')), children: IX.int(fd.get('children')), food: fd.get('food'), extraNames: fd.get('extraNames'), requirements: fd.get('requirements'), message: fd.get('message'), eventIds: fd.getAll('eventIds'), consent: true };
          const err = M.validateRsvp(p);
          if (err) { const e = m.querySelector('#e-err'); e.textContent = window.ixT('en', err); e.hidden = false; return false; }
          const c = M.cleanRsvp(p);
          await H.store.hostSaveRsvp({ ...x, ...c, phoneNorm: IX.normPhone(c.phone) });
          await reload(); renderTab(); IX.toast('Response saved', 'ok');
        },
      }],
    });
  }

  /* ---------- Guests & reminders ---------- */
  function guestState(g) {
    const r = D.rsvps.find((x) => x.guestId === g.id);
    if (r) return [`<span class="pill ${r.status}">${STATUS[r.status]}${r.status !== 'no' ? ' · ' + (r.adults + r.children) : ''}</span>`, 'responded'];
    if (g.openedAt) return ['<span class="pill pending">Opened link</span>', 'opened'];
    if (g.remindedAt) return [`<span class="pill maybe">Reminder: WhatsApp opened ${esc(new Date(g.remindedAt).toLocaleDateString())}</span>`, 'pending'];
    if (g.sentAt) return [`<span class="pill pending">WhatsApp/email opened ${esc(new Date(g.sentAt).toLocaleDateString())}</span>`, 'pending'];
    return ['<span class="pill">Not sent</span>', 'new'];
  }
  // Search and quick filters for the invite list. Rows are only shown or hidden,
  // so buttons inside the table keep working and nothing is re-drawn while typing.
  const GF = [['', 'All'], ['new', 'Not sent yet'], ['pending', 'Sent, no reply'], ['opened', 'Opened, no reply'], ['responded', 'Replied']];
  function guestFilters() {
    const n = (k) => D.guests.filter((g) => !k || guestState(g)[1] === k).length;
    D.gf = D.gf || '';
    return `<div class="filters gfilters no-print">
      <input class="input" type="search" id="gq" placeholder="Search guests by name, number or email…" aria-label="Search guests" value="${esc(D.gq || '')}">
      <div class="chips" role="group" aria-label="Show guests">${GF.map(([k, l]) => `<button type="button" class="chip ${D.gf === k ? 'on' : ''}" data-gf="${k}" aria-pressed="${D.gf === k}">${l} <b>${n(k)}</b></button>`).join('')}</div>
      <p class="tiny muted" id="gCount" aria-live="polite"></p></div>`;
  }
  function wireGuestFilters(body) {
    const q = body.querySelector('#gq');
    if (!q) return;
    const apply = () => {
      const s = (D.gq || '').trim().toLowerCase(), digits = s.replace(/\D/g, '');
      let shown = 0;
      body.querySelectorAll('tr[data-kind]').forEach((tr) => {
        const hit = (!D.gf || tr.dataset.kind === D.gf) && (!s || tr.dataset.s.includes(s) || (digits.length >= 3 && tr.dataset.s.includes(digits)));
        tr.hidden = !hit; if (hit) shown++;
      });
      body.querySelector('#gCount').textContent = shown === D.guests.length ? '' : `${shown} of ${D.guests.length} shown`;
    };
    q.oninput = () => { D.gq = q.value; apply(); };
    body.querySelectorAll('[data-gf]').forEach((b) => (b.onclick = () => {
      D.gf = b.dataset.gf;
      body.querySelectorAll('[data-gf]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
      apply();
    }));
    apply();
  }
  function guests(body) {
    const published = D.inv.status === 'published';
    // sending is open once the sharing campaign is started (free or paid once); adding guests is always free
    const locked = published && window.IXCampaign && !IXCampaign.canShare();
    const pub = published && !locked;
    const pending = D.guests.filter((g) => !D.rsvps.some((r) => r.guestId === g.id));
    body.innerHTML = `
      ${published ? '' : '<div class="notice warn">Publish the invitation first to send personal links.</div>'}
      ${locked ? IXCampaign.lockedNote(D.inv) : ''}
      <div class="grid2" style="margin-bottom:1rem">
        <form class="card stack" id="gf"><h2>Add a guest</h2>
          <div class="f2 stack-sm"><div class="field"><label for="g-n">Name *</label><input class="input" id="g-n" name="name" required placeholder="e.g. Sharma Ji"></div>
          <div class="field"><label for="g-p">WhatsApp number</label><input class="input" id="g-p" name="phone" type="tel" placeholder="+91 98765 43210"></div></div>
          <div class="f2 stack-sm"><div class="field"><label for="g-e">Email</label><input class="input" id="g-e" name="email" type="email"></div>
          <div class="field"><label for="g-a">Max people for this guest</label><input class="input" id="g-a" name="allowed" type="number" min="0" max="50" placeholder="${D.inv.settings.maxPerInvite || 'no limit'}"></div></div>
          <p class="err" id="g-err" hidden></p>
          <button class="btn primary" type="submit">+ Add guest</button></form>
        <div class="card stack"><h2>Import guest list</h2>
          <p class="tiny muted">Upload an Excel (.xlsx) or CSV file with columns <b>Name, WhatsApp number, Email, Max people</b>. Only Name is required. You'll see a preview before anything is added.</p>
          <div class="row"><label class="btn primary" for="impFile">Upload Excel / CSV</label><input type="file" id="impFile" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
            <button class="btn sm ghost" id="impTpl">Sample template</button></div>
          ${'contacts' in navigator && 'select' in navigator.contacts ? '<button class="btn wa" id="pickContacts">Pick from phone contacts</button><p class="tiny muted" style="margin:0">Names and numbers come straight from your phone, so each guest gets a personal link and can reply with one tap.</p>' : ''}
          <details><summary class="small">Or paste names</summary>
            <p class="tiny muted">One guest per line: <code>Name, phone, max people</code> (phone and max optional). You can paste straight from Excel.</p>
            <textarea class="input" id="bulk" rows="5" placeholder="Rakesh Kumar, 9876543210, 4&#10;Meena Aunty, +91 91234 56789"></textarea>
            <button class="btn" id="bulkAdd">Preview &amp; add</button></details></div>
      </div>
      <div class="card stack">
        <div class="row between"><h2 style="margin:0">Invite list (${D.guests.length})</h2>
          <div class="row"><button class="btn sm" id="dlGuests">Download guest list</button><button class="btn sm gold" id="remAll" ${pending.length && pub ? '' : 'disabled'}>Send reminders (${pending.length} pending)</button></div></div>
        ${langPicker()}
        <details><summary class="small">Edit WhatsApp message templates</summary>
          <div class="grid2" style="margin-top:.6rem"><div class="field"><label for="tpl">Invitation message</label><textarea class="input" id="tpl" rows="8">${esc(tpl())}</textarea></div>
          <div class="field"><label for="rtpl">Reminder message</label><textarea class="input" id="rtpl" rows="8">${esc(remTpl())}</textarea></div></div>
          <p class="tiny muted">Placeholders: {name} {event} {date} {time} {venue} {link}</p></details>
        <p class="tiny muted">${msgStyle() === 'card' ? 'Personal messages use the short style. The card image cannot ride along in a personal WhatsApp link, so send the card from <b>Share</b> or attach the saved image. ' : ''}WhatsApp buttons open WhatsApp with your message ready – you press Send. We record that WhatsApp was opened, not that the message was delivered.</p>
        ${D.guests.length ? guestFilters() : ''}
        ${D.guests.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guest</th><th>Status</th><th>Max</th><th>Personal link & sending</th><th></th></tr></thead><tbody>
          ${D.guests.map((g) => { const [st, kind] = guestState(g); const link = IX.inviteUrl(D.inv.slug, { g: g.token }); return `<tr data-kind="${kind}" data-s="${esc([g.name, g.phone, IX.normPhone(g.phone), g.email].join(' ').toLowerCase())}">
            <td><b>${esc(g.name)}</b><div class="tiny muted">${esc(IX.maskPhone(g.phone))}${g.email ? ' · ' + esc(g.email) : ''}</div></td>
            <td>${st}</td><td class="num">${g.allowed || '—'}</td>
            <td class="acts">${pub ? `<button class="btn sm wa" data-wa="${esc(g.id)}" ${g.phone ? '' : 'title="No number – WhatsApp will ask you to pick a contact"'}>${kind === 'new' ? 'WhatsApp' : 'Resend'}</button>
              ${kind !== 'responded' && g.sentAt ? `<button class="btn sm" data-rem="${esc(g.id)}">Remind</button>` : ''}
              ${g.email ? `<a class="btn sm" data-mail="${esc(g.id)}" href="${esc(IX.mailtoUrl(g.email, 'Invitation: ' + H.title(D.inv), fill(tpl(), g)))}">Email</a>` : ''}
              <button class="btn sm ghost" data-cp="${esc(link)}">Copy link</button>` : locked ? `<a class="btn sm" href="#/dash/${esc(D.inv.id)}/share">Start sharing</a>` : '—'}</td>
            <td><button class="btn sm ghost" data-eg="${esc(g.id)}">Edit</button><button class="btn sm ghost danger" data-dg="${esc(g.id)}" aria-label="Remove guest">✕</button></td></tr>`; }).join('')}
          </tbody></table></div>` : '<p class="muted small">No guests added yet. You can also share one general link from the Share tab – anyone with it can RSVP.</p>'}
      </div>`;
    wireGuestFilters(body);
    const err = body.querySelector('#g-err');
    body.querySelector('#gf').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const g = { invitationId: D.inv.id, name: String(fd.get('name')).trim(), phone: String(fd.get('phone')).trim(), email: String(fd.get('email')).trim(), allowed: IX.int(fd.get('allowed'), 0) };
      if (g.name.length < 2) { err.textContent = 'Enter the guest name.'; err.hidden = false; return; }
      if (g.phone && !IX.validPhone(g.phone)) { err.textContent = 'That WhatsApp number does not look valid.'; err.hidden = false; return; }
      if (!IX.validEmail(g.email)) { err.textContent = 'That email does not look valid.'; err.hidden = false; return; }
      await H.store.saveGuest(g); await reload(); guests(body); document.getElementById('g-n').focus();
    };
    // ---- import (Excel / CSV / paste) with a preview before anything is saved ----
    const previewImport = async (list) => {
      const key = (g) => (g.phone ? 'p' + IX.normPhone(g.phone) : 'n' + g.name.toLowerCase());
      const seen = new Set(D.guests.map(key));
      const rows = list.map((g) => {
        let why = '';
        if (!g.name || g.name.length < 2) why = 'No name';
        else if (g.phone && !IX.validPhone(g.phone)) why = 'Number not valid';
        else if (g.email && !IX.validEmail(g.email)) { g.email = ''; }
        if (!why && seen.has(key(g))) why = 'Already in list';
        if (!why) seen.add(key(g));
        return { g, why };
      });
      const good = rows.filter((r) => !r.why);
      if (!rows.length) return IX.toast('No guests found in that file', 'warn');
      const ok = await H.modal({
        title: `Import ${good.length} of ${rows.length} guests`, wide: true,
        body: `<p class="small">Check the list below. Rows marked in red will be skipped. Nothing is added until you press Import.</p>
          <div class="tbl-wrap" style="max-height:50vh;overflow:auto"><table class="tbl" id="impTbl"><thead><tr><th>Name</th><th>WhatsApp number</th><th>Email</th><th>Max</th></tr></thead><tbody>
          ${rows.map((r) => `<tr class="${r.why ? 'is-skip' : ''}"><td><span class="nm">${r.why ? '' : '<span class="good">✓</span> '}${esc(r.g.name || '—')}</span>${r.why ? `<div class="tiny bad">✕ Skipped: ${esc(r.why)}</div>` : ''}</td><td>${esc(r.g.phone || '—')}</td><td>${esc(r.g.email || '')}</td><td class="num">${r.g.allowed || '—'}</td></tr>`).join('')}
          </tbody></table></div>`,
        actions: [{ label: 'Cancel', value: false }, { label: `Import ${good.length} guests`, value: true, cls: 'primary' }],
      });
      if (!ok || !good.length) return;
      try { await H.store.saveGuests(good.map((r) => ({ invitationId: D.inv.id, name: r.g.name, phone: r.g.phone, email: r.g.email, allowed: Math.min(50, Math.max(0, r.g.allowed || 0)) }))); }
      catch (ex) { return IX.toast('Import failed: ' + ex.message, 'bad'); }
      await reload(); guests(body); IX.toast(`${good.length} guests added. Each has a personal link.`, 'ok');
    };
    body.querySelector('#impTpl').onclick = () => IX.download('invitex-guest-list-template.csv', IXImport.templateCSV(), 'text/csv;charset=utf-8');
    body.querySelector('#impFile').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) return IX.toast('File is too large (max 5 MB)', 'bad');
      try { await previewImport(IXImport.toGuests(await IXImport.readFile(f))); } catch (ex) { IX.toast(ex.message, 'bad'); }
    };
    const pick = body.querySelector('#pickContacts');
    if (pick) pick.onclick = async () => {
      let list;
      try { list = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true }); } catch (ex) { return IX.toast('Could not open your contacts', 'warn'); }
      if (!list || !list.length) return;
      previewImport(list.map((c) => ({ name: String((c.name || [])[0] || '').trim(), phone: String((c.tel || [])[0] || '').trim(), email: String((c.email || [])[0] || '').trim(), allowed: 0 })));
    };
    body.querySelector('#bulkAdd').onclick = () => {
      const txt = body.querySelector('#bulk').value;
      const rows = txt.includes('\t') ? txt.split(/\r?\n/).map((l) => l.split('\t')) : txt.split(/\r?\n/).map((l) => l.split(','));
      previewImport(IXImport.toGuests(rows));
    };
    body.querySelector('#tpl').onchange = async (e) => { await setTpl('invite', e.target.value); IX.toast('Template saved', 'ok'); };
    body.querySelector('#rtpl').onchange = async (e) => { await setTpl('remind', e.target.value); IX.toast('Template saved', 'ok'); };
    wireLangPicker(body, () => guests(body));
    const mark = async (id, field) => { const g = D.guests.find((x) => x.id === id); g[field] = new Date().toISOString(); await H.store.saveGuest(g); await reload(); guests(body); };
    const track = (gid, ch, action) => window.IXCampaign && IXCampaign.markShared(gid, ch, action);
    body.querySelectorAll('[data-wa]').forEach((b) => (b.onclick = () => { const g = D.guests.find((x) => x.id === b.dataset.wa); window.open(IX.whatsappUrl(fill(tpl(), g), g.phone), '_blank', 'noopener'); track(g.id, 'whatsapp'); mark(g.id, 'sentAt'); }));
    body.querySelectorAll('[data-rem]').forEach((b) => (b.onclick = () => { const g = D.guests.find((x) => x.id === b.dataset.rem); window.open(IX.whatsappUrl(fill(remTpl(), g), g.phone), '_blank', 'noopener'); track(g.id, 'whatsapp'); mark(g.id, 'remindedAt'); }));
    body.querySelectorAll('[data-mail]').forEach((a) => a.addEventListener('click', () => { track(a.dataset.mail, 'email'); mark(a.dataset.mail, 'sentAt'); }));
    body.querySelectorAll('[data-cp]').forEach((b) => (b.onclick = async () => { await IX.copy(b.dataset.cp); IX.toast('Personal link copied', 'ok'); const g = D.guests.find((x) => b.dataset.cp.includes(x.token)); if (g) track(g.id, 'copy', 'link'); }));
    body.querySelectorAll('[data-dg]').forEach((b) => (b.onclick = async () => {
      if (!(await H.confirm('Remove guest?', 'Their personal link will stop identifying them. Any RSVP they already sent is kept.', 'Remove', true))) return;
      await H.store.deleteGuest(b.dataset.dg); await reload(); guests(body);
    }));
    body.querySelectorAll('[data-eg]').forEach((b) => (b.onclick = async () => {
      const g = D.guests.find((x) => x.id === b.dataset.eg);
      await H.modal({
        title: 'Edit guest', body: `<div class="stack"><div class="field"><label for="eg-n">Name</label><input class="input" id="eg-n" value="${esc(g.name)}"></div><div class="field"><label for="eg-p">WhatsApp number</label><input class="input" id="eg-p" value="${esc(g.phone)}"></div><div class="field"><label for="eg-e">Email</label><input class="input" id="eg-e" value="${esc(g.email)}"></div><div class="field"><label for="eg-a">Max people</label><input class="input" id="eg-a" type="number" min="0" value="${g.allowed || 0}"></div></div>`,
        actions: [{ label: 'Cancel' }, { label: 'Save', cls: 'primary', onClick: async (m) => {
          const ph = m.querySelector('#eg-p').value.trim();
          if (ph && !IX.validPhone(ph)) { IX.toast('Invalid number', 'bad'); return false; }
          Object.assign(g, { name: m.querySelector('#eg-n').value.trim() || g.name, phone: ph, email: m.querySelector('#eg-e').value.trim(), allowed: IX.int(m.querySelector('#eg-a').value, 0) });
          await H.store.saveGuest(g); await reload(); guests(body);
        } }],
      });
    }));
    body.querySelector('#dlGuests').onclick = () => {
      const rows = [['Name', 'Mobile', 'Email', 'Max people', 'Status', 'Attendees', 'Invitation sent (WhatsApp opened)', 'Reminder sent', 'Personal link']];
      D.guests.forEach((g) => { const r = D.rsvps.find((x) => x.guestId === g.id); rows.push([g.name, g.phone, g.email, g.allowed || '', r ? STATUS[r.status] : 'Pending', r && r.status !== 'no' ? r.adults + r.children : '', g.sentAt ? new Date(g.sentAt).toLocaleString() : '', g.remindedAt ? new Date(g.remindedAt).toLocaleString() : '', IX.inviteUrl(D.inv.slug, { g: g.token })]); });
      IX.download((IX.slugify(H.title(D.inv)) || 'invitation') + '-guest-list.csv', '﻿' + IX.toCSV(rows), 'text/csv;charset=utf-8');
    };
    body.querySelector('#remAll').onclick = () => {
      H.modal({
        title: `Send reminders (${pending.length})`, wide: true,
        body: `<p class="small">Browsers can only open one WhatsApp chat at a time, so tap each guest below. WhatsApp opens with the reminder ready – press Send there, then come back for the next.</p>
          <div class="stack">${pending.map((g) => `<div class="row between" style="border-bottom:1px solid var(--line);padding:.4rem 0"><span><b>${esc(g.name)}</b> <span class="tiny muted">${esc(IX.maskPhone(g.phone))}</span></span><span class="row">${g.remindedAt ? '<span class="pill maybe">reminded</span>' : ''}<a class="btn sm wa" target="_blank" rel="noopener" data-r1="${esc(g.id)}" href="${esc(IX.whatsappUrl(fill(remTpl(), g), g.phone))}">Remind</a></span></div>`).join('')}</div>`,
        actions: [{ label: 'Done', cls: 'primary' }],
        onOpen: (m) => m.querySelectorAll('[data-r1]').forEach((a) => a.addEventListener('click', async () => {
          if (window.IXCampaign) IXCampaign.markShared(a.dataset.r1, 'whatsapp');
          const g = D.guests.find((x) => x.id === a.dataset.r1); g.remindedAt = new Date().toISOString(); await H.store.saveGuest(g);
          a.textContent = '✔ Opened'; a.classList.remove('wa');
        })),
      }).then(async () => { await reload(); guests(body); });
    };
  }

  /* ---------- Share (sharing centre) ---------- */
  // What InviteX can honestly know: when the host opened WhatsApp or email for a guest,
  // when a guest opened their personal link, and when they replied. Never "delivered".
  function shareStatus() {
    const gs = D.guests, has = (g) => D.rsvps.some((r) => r.guestId === g.id);
    const n = { invited: gs.length, sent: gs.filter((g) => g.sentAt).length, opened: gs.filter((g) => g.openedAt || has(g)).length, replied: gs.filter(has).length };
    n.notSent = gs.filter((g) => !g.sentAt && !has(g)).length;
    const general = D.rsvps.filter((r) => !r.guestId).length;
    const step = (v, l, sub) => `<div class="sx-step"><b>${v}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    return `<div class="card sx-status">
      <div class="row between"><h2 style="margin:0">Sharing status</h2><button class="btn sm" data-goto="guests">Personal invites${n.notSent ? ` · ${n.notSent} not sent` : ''}</button></div>
      ${n.invited ? `<div class="sx-steps">
        ${step(n.invited, 'On your guest list')}
        ${step(n.sent, 'WhatsApp or email opened', 'by you, to send')}
        ${step(n.opened, 'Opened their link')}
        ${step(n.replied, 'Replied')}
      </div>` : `<p class="small muted" style="margin:.4rem 0 0">No guest list yet. Add guests in <b>Guests &amp; reminders</b> to send each one a personal link with their name, or share the general link below.</p>`}
      ${general ? `<p class="tiny muted" style="margin:.6rem 0 0">${general} ${general === 1 ? 'reply' : 'replies'} came through the general link.</p>` : ''}
      <p class="tiny muted" style="margin:.6rem 0 0">InviteX can see when <i>you</i> opened WhatsApp or email to send, and when a guest opened their personal link or replied. It cannot see whether a WhatsApp message was delivered or read.</p>
    </div>`;
  }
  // Share tab = the sharing campaign step (start / pay / status) on top, then the sharing tools once it is open.
  function share(body) {
    const inv = D.inv;
    if (inv.status !== 'published') { body.innerHTML = `<div class="card"><p>Publish the invitation to share it.</p><a class="btn primary" href="#/edit/${esc(inv.id)}/share">Go to Publish</a></div>`; return; }
    if (!window.IXCampaign) return shareTools(body);
    body.innerHTML = '<div id="cmBox"><div class="page-loading"><div class="spinner"></div></div></div><div id="shareBox"></div>';
    const box = body.querySelector('#shareBox');
    IXCampaign.render(body.querySelector('#cmBox'), inv, () => shareTools(box));
  }
  function shareTools(body) {
    const inv = D.inv;
    const track = (ch, action) => window.IXCampaign && IXCampaign.markShared(null, ch, action);
    const l = msgLang();
    const link = IX.inviteUrl(inv.slug, l === (inv.defaultLang || 'en') ? {} : { lang: l });
    const msg = generalMsg();
    body.innerHTML = `
      ${IX.isProduction ? '' : '<div class="notice warn" style="margin-bottom:1rem"><b>Demo/Local mode:</b> this link opens only in this browser. Guests on other phones will see “Invitation not found” until Production mode is set up. Use it to test the full guest journey here.</div>'}
      ${shareStatus()}
      <div class="share-grid">
        <div class="card stack"><h2>Share the invitation</h2>
          ${langPicker()}
          ${stylePicker()}
          <div class="copyrow"><input class="input" readonly value="${esc(link)}" aria-label="Invitation link" id="lnk"><button class="btn" id="cpy">Copy link</button></div>
          <div class="wa-prev" aria-label="How it looks in WhatsApp">
            <div class="wa-bubble"><img id="waImg" alt="Your invitation card" width="1080" height="1350"><div id="waText" class="wa-text"></div><span class="wa-time">now</span></div>
          </div>
          <div class="sx-actions">
            <button class="btn wa" id="waCard">Send card on WhatsApp</button>
            <a class="btn" target="_blank" rel="noopener" id="waAll" href="${esc(IX.whatsappUrl(msg))}">WhatsApp, text only</a>
            <a class="btn" id="mailAll" href="${esc(IX.mailtoUrl('', 'Invitation: ' + H.title(inv), msg))}">Email</a>
            ${navigator.share ? '<button class="btn" id="nshare">More apps…</button>' : ''}
            <a class="btn ghost" target="_blank" rel="noopener" href="${esc(link)}">Open as a guest</a></div>
          <div class="field"><label for="msgPrev">Message</label><textarea class="input" id="msgPrev" rows="${msgStyle() === 'card' ? 4 : 9}">${esc(msg)}</textarea><span class="hint">Edit before sharing. This general message greets everyone the same way; for a message with each guest's name and their own link, use <b>Personal invites</b>.</span></div>
        </div>
        <div class="card stack" style="text-align:center"><h2>QR code</h2>
          <div class="qr-box" id="qr">${IX.qrSVG(link, { size: 220 })}</div>
          <p class="tiny muted">Print it on physical cards or show it at the venue. Scanning opens the invitation.</p>
          <div class="row" style="justify-content:center"><button class="btn" id="qrPng">Download QR (PNG)</button></div>
        </div>
        <div class="card stack"><h2>Image &amp; print</h2>
          <p class="small muted">A ready-to-share image card (1080×1350, right for WhatsApp status and Instagram), or a print-friendly page you can save as PDF.</p>
          <canvas id="cardCanvas" width="1080" height="1350" style="width:100%;max-width:300px;border-radius:12px;box-shadow:var(--sh);display:block;margin:0 auto"></canvas>
          <div class="row" style="justify-content:center"><button class="btn primary" id="dlImg">Download image</button>
          <a class="btn" target="_blank" rel="noopener" href="${esc(IX.inviteUrl(inv.slug, { print: '1', lang: l === (inv.defaultLang || 'en') ? '' : l }))}">Print / Save as PDF</a></div>
          <p class="tiny muted">In the print dialog choose “Save as PDF”. Turn on “Background graphics” for full colours.</p>
        </div>
      </div>`;
    body.querySelector('[data-goto=guests]').onclick = () => document.querySelector('[data-tab=guests]').click();
    wireLangPicker(body, () => shareTools(body));
    body.querySelector('#cpy').onclick = async () => { await IX.copy(link); IX.toast('Link copied', 'ok'); track('copy', 'share'); };
    body.querySelector('#waAll').addEventListener('click', () => track('whatsapp'));
    body.querySelector('#mailAll').addEventListener('click', () => track('email'));
    const mp = body.querySelector('#msgPrev');
    const waText = body.querySelector('#waText');
    const showText = () => { waText.innerHTML = esc(mp.value).replace(/https?:\/\/\S+/g, (u) => `<span class="wa-link">${u}</span>`).replace(/\n/g, '<br>'); };
    mp.oninput = () => { body.querySelector('#waAll').href = IX.whatsappUrl(mp.value); body.querySelector('#mailAll').href = IX.mailtoUrl('', 'Invitation: ' + H.title(inv), mp.value); showText(); };
    showText();
    const ns = body.querySelector('#nshare');
    if (ns) ns.onclick = () => { track('native'); navigator.share({ title: H.title(inv), text: mp.value.replace(link, '').trim(), url: link }).catch(() => {}); };
    body.querySelector('#qrPng').onclick = async () => { track('qr', 'link'); IX.download((inv.slug || 'invite') + '-qr.png', await IX.qrPNG(link, 800)); };
    const cv = body.querySelector('#cardCanvas');
    drawCard(cv, inv, link).then(() => { body.querySelector('#waImg').src = cv.toDataURL('image/jpeg', 0.85); }).catch((e) => console.warn(e));
    // Card image + message. Phones: the share sheet sends both together (pick WhatsApp, then the chat).
    // Computers can't attach a file through a link, so the image is saved and WhatsApp opens with the message ready.
    body.querySelector('#waCard').onclick = async () => {
      track('whatsapp');
      const name = (inv.slug || 'invitation') + '.png';
      const blob = dataUrlBlob(cv.toDataURL('image/png'));
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], text: mp.value }); } catch (e) { /* closed the share sheet */ }
        return;
      }
      window.open(IX.whatsappUrl(mp.value), '_blank', 'noopener');
      IX.download(name, blob);
      IX.toast('Card image saved. In WhatsApp, attach it with the clip button. The message is already typed.', 'ok', 7000);
    };
    body.querySelector('#dlImg').onclick = async () => {
      await drawCard(cv, inv, link);
      cv.toBlob((b) => IX.download((inv.slug || 'invitation') + '.png', b), 'image/png');
    };
  }

  function dataUrlBlob(u) {
    const [head, b64] = u.split(','), bin = atob(b64), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: head.slice(5).split(';')[0] });
  }

  async function drawCard(cv, inv, link) {
    if (!document.getElementById('ixThemeFonts')) {
      const l = document.createElement('link'); l.id = 'ixThemeFonts'; l.rel = 'stylesheet'; l.href = IXT.FONT_URL; document.head.appendChild(l);
    }
    const f = inv.design.fonts;
    try { await Promise.all([`64px "${f.script}"`, `40px "${f.head}"`, '40px "Noto Sans Devanagari"', '40px "Noto Sans Gurmukhi"'].map((x) => document.fonts.load(x))); } catch (e) { /* fonts optional */ }
    const p = M.palette(inv), c = cv.getContext('2d'), W = cv.width, Hh = cv.height, L = D && D.inv === inv ? msgLang() : inv.defaultLang;
    const g = c.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, p.bg); g.addColorStop(1, p.bg2);
    c.fillStyle = g; c.fillRect(0, 0, W, Hh);
    const loadSvg = (svg) => IX.loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', '<svg width="440" height="440" ')));
    const motif = IXT.motif(IXT.THEMES[inv.theme].motif, p);
    if (motif.hero && !inv.media.cover) { try { const im = await loadSvg(motif.hero.replace('<svg ', '<svg preserveAspectRatio="xMidYMax slice" ')); c.globalAlpha = 0.9; c.drawImage(im, 0, Hh - 560, W, 560); c.globalAlpha = 1; } catch (e) { /* skip */ } }
    if (motif.corner && inv.design.decorations) {
      try {
        const im = await loadSvg(motif.corner);
        const s = 300;
        c.drawImage(im, 0, 0, s, s);
        c.save(); c.translate(W, 0); c.scale(-1, 1); c.drawImage(im, 0, 0, s, s); c.restore();
        c.save(); c.translate(0, Hh); c.scale(1, -1); c.drawImage(im, 0, 0, s, s); c.restore();
        c.save(); c.translate(W, Hh); c.scale(-1, -1); c.drawImage(im, 0, 0, s, s); c.restore();
      } catch (e) { /* skip */ }
    }
    c.strokeStyle = p.accent; c.lineWidth = 3; c.strokeRect(40, 40, W - 80, Hh - 80); c.lineWidth = 1; c.strokeRect(56, 56, W - 112, Hh - 112);
    let y = 150;
    const coverUrl = await H.store.resolveMedia(inv.media.cover);
    if (coverUrl) {
      try {
        const im = await IX.loadImage(coverUrl);
        const w = 420, h = 520, x = (W - w) / 2;
        c.save(); c.beginPath(); c.moveTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.closePath(); c.clip();
        const sc = Math.max(w / im.width, h / im.height);
        c.drawImage(im, x + (w - im.width * sc) / 2, y + (h - im.height * sc) / 2, im.width * sc, im.height * sc);
        c.restore(); c.strokeStyle = p.accent; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 10, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2 + 10, Math.PI, 0); c.lineTo(x + w + 10, y + h + 10); c.lineTo(x - 10, y + h + 10); c.closePath(); c.stroke();
        y += h + 60;
      } catch (e) { y = 260; }
    } else y = 300;
    c.textAlign = 'center'; c.fillStyle = p.text;
    const fam = M.txt(inv, L, 'familyName');
    if (fam) { c.font = `600 30px "${f.head}", "Noto Sans Devanagari", "Noto Sans Gurmukhi", serif`; c.fillText(fam.toUpperCase(), W / 2, y); y += 70; }
    const title = M.txt(inv, L, 'title');
    c.fillStyle = p.accent;
    let size = L === 'en' ? 110 : 84;
    c.font = `${size}px "${L === 'en' ? f.script : f.head}", "Noto Sans Devanagari", "Noto Sans Gurmukhi", serif`;
    while (c.measureText(title).width > W - 200 && size > 50) { size -= 6; c.font = `${size}px "${L === 'en' ? f.script : f.head}", "Noto Sans Devanagari", "Noto Sans Gurmukhi", serif`; }
    c.fillText(title, W / 2, y + size * 0.4); y += size + 30;
    const sub = M.txt(inv, L, 'subtitle');
    c.fillStyle = p.text;
    if (sub) { c.font = `500 32px "${f.head}", "Noto Sans Devanagari", "Noto Sans Gurmukhi", serif`; c.fillText(sub, W / 2, y); y += 70; }
    const ev = (inv.events || []).find((e) => e.date);
    if (ev) {
      c.font = `600 40px "${f.head}", "Noto Sans Devanagari", "Noto Sans Gurmukhi", serif`; c.fillStyle = p.accent;
      c.fillText(IX.fmtDate(ev.date, inv.timezone, L, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: inv.timezone }), W / 2, y); y += 54;
      c.fillStyle = p.text; c.font = `500 32px "${f.head}", serif`;
      if (ev.start) { c.fillText(IX.fmtTime(ev.date, ev.start, inv.timezone, L), W / 2, y); y += 50; }
      if (ev.venue) { c.font = `600 34px "${f.head}", serif`; c.fillStyle = p.accent; c.fillText(ev.venue.toUpperCase(), W / 2, y); y += 46; }
      if (ev.city) { c.font = `500 28px "${f.head}", serif`; c.fillStyle = p.text; c.fillText(ev.city, W / 2, y); y += 40; }
    }
    try {
      const q = await IX.loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(IX.qrSVG(link, { size: 180 })));
      const qs = 150, qx = W - 320, qy = Hh - 330;
      c.fillStyle = '#fff'; c.fillRect(qx - 10, qy - 10, qs + 20, qs + 20); c.drawImage(q, qx, qy, qs, qs);
      c.fillStyle = p.text; c.font = '500 22px system-ui, sans-serif'; c.font = '500 22px system-ui, "Noto Sans Devanagari", "Noto Sans Gurmukhi", sans-serif'; c.fillText((CARD_TPL[L] || CARD_TPL.en).scan, qx + qs / 2, qy + qs + 38);
    } catch (e) { /* skip */ }
  }

  /* ---------- Check-in ---------- */
  function checkin(body) {
    const yes = D.rsvps.filter((r) => r.status === 'yes');
    const s = D.stats;
    body.innerHTML = `
      <div class="kpis"><div class="kpi hl"><div class="v">${s.checkedInHeads} / ${s.attendees}</div><div class="l">People checked in</div></div><div class="kpi"><div class="v">${s.checkedIn} / ${s.yes}</div><div class="l">Parties checked in</div></div></div>
      <div class="grid2"><form class="card stack" id="cf"><h2>Verify a guest</h2>
        <p class="small muted">Scan the QR code on the guest's confirmation screen, or type their reference (e.g. IVX-7K2M9Q).</p>
        <div class="copyrow"><input class="input" id="cref" placeholder="IVX-XXXXXX" autocapitalize="characters" aria-label="Confirmation reference"><button class="btn primary" type="submit">Check in</button></div>
        ${'BarcodeDetector' in window ? '<button type="button" class="btn" id="scan">Scan QR with camera</button><video id="scanV" class="scan-video" hidden playsinline muted></video>' : '<p class="tiny muted">Camera scanning is available in Chrome/Edge on Android and desktop. Elsewhere, type the reference.</p>'}
        <div id="cres" aria-live="polite"></div></form>
      <div class="card"><h2>Confirmed guests</h2>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Guest</th><th class="num">People</th><th>Ref</th><th></th></tr></thead><tbody>
        ${yes.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td class="num">${r.adults + r.children}</td><td><code>${esc(r.ref)}</code></td><td>${r.checkedInAt ? `<span class="pill ok">✔ ${esc(new Date(r.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span> <button class="btn sm ghost" data-undo="${esc(r.ref)}">Undo</button>` : `<button class="btn sm" data-ci="${esc(r.ref)}">Check in</button>`}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No confirmed guests yet.</td></tr>'}
        </tbody></table></div></div></div>`;
    const res = body.querySelector('#cres');
    const doCheck = async (code, undo = false) => {
      const r = await H.store.checkIn(D.inv.id, code, undo);
      if (!r.ok) res.innerHTML = `<div class="notice bad">✕ ${esc(r.error)}</div>`;
      else if (r.rsvp.status !== 'yes') res.innerHTML = `<div class="notice warn">⚠ ${esc(r.rsvp.name)} replied “${STATUS[r.rsvp.status]}”. Checked in anyway.</div>`;
      else res.innerHTML = `<div class="notice ${r.already ? 'warn' : 'ok'}">${r.already ? '⚠ Already checked in' : '✔ Welcome'}: <b>${esc(r.rsvp.name)}</b> – ${r.rsvp.adults + r.rsvp.children} people</div>`;
      await reload();
      const keep = res.innerHTML;
      checkin(body);
      body.querySelector('#cres').innerHTML = keep;
    };
    body.querySelector('#cf').onsubmit = (e) => { e.preventDefault(); const v = body.querySelector('#cref').value.trim(); if (v) doCheck(v); };
    body.querySelectorAll('[data-ci]').forEach((b) => (b.onclick = () => doCheck(b.dataset.ci)));
    body.querySelectorAll('[data-undo]').forEach((b) => (b.onclick = () => doCheck(b.dataset.undo, true)));
    const sc = body.querySelector('#scan');
    if (sc) sc.onclick = async () => {
      const v = body.querySelector('#scanV');
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); } catch (e) { return IX.toast('Camera not available: ' + e.message, 'bad'); }
      v.srcObject = stream; v.hidden = false; await v.play();
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stop = () => { stream.getTracks().forEach((t) => t.stop()); v.hidden = true; };
      H.cleanup.push(stop);
      const loop = async () => {
        if (v.hidden) return;
        try { const codes = await det.detect(v); if (codes.length && /^IVX:/.test(codes[0].rawValue)) { stop(); return doCheck(codes[0].rawValue); } } catch (e) { /* keep trying */ }
        requestAnimationFrame(loop);
      };
      loop();
    };
  }
})();
