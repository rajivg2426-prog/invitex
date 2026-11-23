/* InviteX – guest invitation microsite.
 * URL params: i=<slug>  g=<personal guest token>  e=<RSVP edit token>
 *             lang=en|hi|pa  preview=1 (host live preview)  print=1 */
(function () {
  'use strict';
  const IX = window.IX, M = IX.model;
  const params = new URLSearchParams(location.search);
  const slug = (params.get('i') || '').toLowerCase();
  const isPreview = params.get('preview') === '1';
  const isPrint = params.get('print') === '1';
  const app = document.getElementById('app');
  const esc = IX.esc;

  const S = {
    store: null, inv: null, guest: null, lang: 'en', password: '', guestToken: params.get('g') || '',
    editToken: params.get('e') || '', existing: null, opened: isPrint, timers: [], music: null, mediaUrls: {}, lastRsvp: null,
  };
  const t = (k, v) => window.ixT(S.lang, k, v);
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } };

  /* ---------------- boot ---------------- */
  async function boot() {
    try { S.store = await window.IXStore; } catch (e) { return fatal('Could not connect to the invitation service.', e.message); }
    if (isPreview) {
      window.addEventListener('message', (ev) => {
        if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'ix-preview') return;
        S.inv = ev.data.inv;
        if (ev.data.lang) S.lang = ev.data.lang;
        if (ev.data.opened !== undefined) S.opened = ev.data.opened;
        render(true);
      });
      parent.postMessage({ type: 'ix-preview-ready' }, location.origin);
      return;
    }
    if (!slug) return fatal('Invitation not found', 'This link is incomplete. Please ask the host to share it again.');
    await load();
  }

  async function load() {
    let res;
    try { res = await S.store.getPublic(slug, { password: S.password, guestToken: S.guestToken }); } catch (e) { return fatal('Could not load invitation', e.message); }
    if (res.status === 'not_found') {
      const local = S.store.mode === 'local';
      return fatal(t('notFound'), local
        ? 'This app is running in Demo/Local mode, so invitations exist only in the browser where they were created. Open this link in that same browser, or ask the host to set up Production mode (Supabase) so guests on other devices can view and RSVP.'
        : 'The link may be mistyped, or the invitation has been unpublished or deleted by the host.');
    }
    if (res.status === 'expired') return fatal(res.title || '', t('expired'));
    if (res.status === 'password_required' || res.status === 'wrong_password') return passwordGate(res.status === 'wrong_password');
    S.inv = res.invitation;
    S.guest = res.guest;
    const remembered = lsGet('ivx-rsvp-' + slug);
    if (!S.editToken && remembered && remembered.editToken) S.editToken = remembered.editToken;
    if (S.editToken) {
      try { S.existing = await S.store.getRsvpByEditToken(slug, S.editToken); } catch (e) { S.existing = null; }
      if (!S.existing) S.editToken = '';
    }
    const want = params.get('lang') || lsGet('ivx-lang-' + slug);
    S.lang = (S.inv.languages || ['en']).includes(want) ? want : S.inv.defaultLang || 'en';
    render(false);
  }

  function fatal(title, msg) {
    document.title = title || 'Invitation';
    app.innerHTML = `<main class="ix-fatal" id="main"><div class="ix-fatal-card"><div class="ix-fatal-icon" aria-hidden="true">💌</div><h1>${esc(title)}</h1><p>${esc(msg)}</p></div></main>`;
  }

  function passwordGate(wrong) {
    app.innerHTML = `<main class="ix-fatal" id="main"><form class="ix-fatal-card" id="pwForm">
      <div class="ix-fatal-icon" aria-hidden="true">🔒</div>
      <p>${esc(t('password'))}</p>
      <label class="sr-only" for="pw">Password</label>
      <input id="pw" type="password" autocomplete="off" required class="ix-input" autofocus>
      ${wrong ? `<p class="ix-error" role="alert">${esc(t('wrongPassword'))}</p>` : ''}
      <button class="ix-btn ix-btn-primary" type="submit">${esc(t('unlock'))}</button></form></main>`;
    document.getElementById('pwForm').onsubmit = (e) => { e.preventDefault(); S.password = document.getElementById('pw').value; load(); };
  }

  /* ---------------- theme ---------------- */
  let fontsLoaded = false;
  function applyTheme(inv) {
    if (!fontsLoaded) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = IXT.FONT_URL;
      document.head.appendChild(l);
      fontsLoaded = true;
    }
    const p = M.palette(inv), d = inv.design, root = document.documentElement;
    const set = (k, v) => root.style.setProperty(k, v);
    set('--bg', p.bg); set('--bg2', p.bg2); set('--surface', p.surface); set('--text', p.text); set('--muted', p.muted);
    set('--accent', p.accent); set('--accent2', p.accent2); set('--gold', p.gold || p.accent); set('--on-accent', p.onAccent || '#fff');
    set('--paper', p.paper || '#fbf6ee'); set('--ink', p.ink || p.accent); set('--wood', p.wood || '#6b4632'); set('--wall', p.wall || '#efe6db');
    set('--f-script', IXT.fontStack(d.fonts.script, 'script')); set('--f-head', IXT.fontStack(d.fonts.head, 'head')); set('--f-body', IXT.fontStack(d.fonts.body, 'body'));
    set('--scale', d.fontScale || 1);
    set('--gap', { compact: '2.2rem', comfortable: '3.4rem', airy: '4.8rem' }[d.spacing] || '3.4rem');
    const b = document.body;
    b.className = ['ix-guest', 'layout-' + (inv.layout || 'portrait'), 'border-' + (d.border || 'thin'), 'anim-' + (d.animation || 'gentle'), 'shape-' + (d.photoShape || 'rounded'), 'motif-' + IXT.THEMES[inv.theme]?.motif, isPreview ? 'is-preview' : '', isPrint ? 'is-print' : '', 'lang-' + S.lang].join(' ');
    document.querySelector('meta[name=theme-color]').setAttribute('content', p.bg);
    document.documentElement.lang = S.lang;
  }

  async function resolveAll(inv) {
    const refs = M.mediaRefs(inv);
    await Promise.all(refs.map(async (r) => { if (!(r in S.mediaUrls)) S.mediaUrls[r] = await S.store.resolveMedia(r).catch(() => ''); }));
  }
  const url = (ref) => (ref ? S.mediaUrls[ref] || '' : '');

  /* ---------------- render ---------------- */
  async function render(keepScroll) {
    const inv = S.inv;
    const scrollY = window.scrollY;
    await resolveAll(inv);
    applyTheme(inv);
    S.timers.forEach(clearInterval); S.timers = [];
    const title = M.txt(inv, S.lang, 'title') || 'Invitation';
    document.title = title;
    const pal = M.palette(inv);
    const motif = IXT.motif(IXT.THEMES[inv.theme]?.motif || 'minimal', pal);
    const order = inv.design.sectionOrder.filter((id) => inv.design.sections[id]);
    const ctx = { inv, motif, pal, title };
    const html = order.map((id) => (SECTIONS[id] ? SECTIONS[id](ctx) : '')).filter(Boolean).join('');
    const bg = url(inv.media.background);
    app.innerHTML = `
      ${topBar(inv)}
      ${bg ? `<div class="ix-bgimg" style="background-image:url('${esc(bg)}')" aria-hidden="true"></div>` : ''}
      ${motif.top ? `<div class="ix-toran" aria-hidden="true">${motif.top}</div>` : ''}
      <main id="main" class="ix-page ${S.opened ? 'opened' : ''}">${html}
        <footer class="ix-foot">${S.store && S.store.mode === 'local' && !isPreview ? `<p class="ix-demo">${esc(t('demoNote'))}</p>` : ''}<p>Made with InviteX</p></footer>
      </main>
      ${S.opened || !inv.design.sections.opening || isPrint ? '' : openerOverlay(inv)}
      <div class="ix-lightbox" id="lightbox" hidden role="dialog" aria-modal="true" aria-label="Photo viewer"></div>`;
    wire(ctx);
    if (keepScroll) window.scrollTo(0, scrollY);
    if (isPrint) setTimeout(() => window.print(), 900);
  }

  function topBar(inv) {
    const langs = inv.languages || ['en'];
    const hasMusic = !!url(inv.media.music);
    if (isPrint) return '';
    return `<div class="ix-topbar">
      ${langs.length > 1 ? `<div class="ix-langs" role="group" aria-label="Language">${langs.map((l) => `<button type="button" class="ix-lang ${l === S.lang ? 'on' : ''}" data-lang="${l}" aria-pressed="${l === S.lang}" lang="${l}">${esc(window.IX_LANGS[l] || l)}</button>`).join('')}</div>` : '<span></span>'}
      ${hasMusic ? `<button type="button" class="ix-music" id="musicBtn" aria-pressed="false" aria-label="${esc(t('music'))}: play"><span class="ix-eq" aria-hidden="true"><i></i><i></i><i></i></span><span class="ix-music-ic" aria-hidden="true">♪</span></button>` : ''}
    </div>`;
  }

  function openerOverlay(inv) {
    const th = IXT.THEMES[inv.theme] || {};
    const greet = S.guest ? `<p class="ix-op-greet">${esc(t('dear'))} ${esc(S.guest.name)},</p>` : '';
    return `<div class="ix-opener op-${th.opener || 'fade'}" id="opener">
      <div class="ix-op-left" aria-hidden="true"></div><div class="ix-op-right" aria-hidden="true"></div>
      <div class="ix-op-center">
        ${greet}
        <div class="ix-seal" aria-hidden="true">${esc((M.txt(inv, S.lang, 'title') || 'I').trim().charAt(0))}</div>
        <button type="button" class="ix-btn ix-btn-primary ix-op-btn" id="openBtn">${esc(t('openInvite'))}</button>
        <p class="ix-op-hint">${esc(t('tapToOpen'))}</p>
      </div></div>`;
  }

  const firstEvent = (inv) => (inv.events || []).find((e) => e.id === inv.mainEventId && e.date) || (inv.events || []).filter((e) => e.date).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  const deco = (ctx) => (ctx.inv.design.decorations && ctx.motif.corner ? `<div class="ix-corner tl" aria-hidden="true">${ctx.motif.corner}</div><div class="ix-corner tr" aria-hidden="true">${ctx.motif.corner}</div>` : '');
  const decoB = (ctx) => (ctx.inv.design.decorations && ctx.motif.corner ? `<div class="ix-corner bl" aria-hidden="true">${ctx.motif.corner}</div><div class="ix-corner br" aria-hidden="true">${ctx.motif.corner}</div>` : '');
  const divider = (ctx) => `<div class="ix-divider" aria-hidden="true">${ctx.motif.divider}</div>`;
  const sec = (id, inner, cls = '') => `<section class="ix-sec ix-sec-${id} reveal ${cls}" id="sec-${id}" aria-labelledby="h-${id}">${inner}</section>`;
  const h2 = (id, text) => `<h2 class="ix-h2" id="h-${id}">${esc(text)}</h2>`;

  // "Framed Keepsake": split hero – coloured panel with serif text, and a cream card in a wooden shadow-box frame
  function framedHero(ctx, ev, sub, host, cover) {
    const { inv, motif } = ctx, tz = inv.timezone;
    const welcome = M.txt(inv, S.lang, 'welcome');
    const short = welcome.length > 200 ? welcome.slice(0, 197).replace(/\s+\S*$/, '') + '…' : welcome;
    const cat = IXT.CATEGORIES.find((c) => c.id === inv.category) || {};
    const eyebrow = (cat.occasion && (cat.occasion[S.lang] || cat.occasion.en)) || t('invitation');
    // heading: subtitle with its last word in italics, as in a printed card
    const words = (sub || ctx.title).trim().split(/\s+/);
    const last = words.length > 1 ? words.pop() : '';
    const heading = `${esc(words.join(' '))}${last ? ` <em>${esc(last)}</em>` : ''}`;
    let date = '', time = '';
    if (ev) {
      const d = IX.zonedToUtc(ev.date, ev.start || '12:00', tz);
      date = new Intl.DateTimeFormat(IX.locale(S.lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(d);
      time = ev.start ? IX.fmtTime(ev.date, ev.start, tz, S.lang) : '';
    }
    const rsvpOn = inv.design.sections.rsvp && !isPrint;
    const sparkles = Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 53 + 11) % 100}%;--d:${(i % 5) * 0.7}s;--s:${3 + (i % 3) * 2}px"></i>`).join('');
    return `<section class="ix-hero ix-hero-framed" id="sec-opening" aria-label="${esc(ctx.title)}">
      <div class="kf-panel">
        <p class="kf-eyebrow"><span aria-hidden="true"></span>${esc(eyebrow)}</p>
        ${S.guest ? `<p class="kf-greet">${esc(t('dear'))} ${esc(S.guest.name)},</p>` : ''}
        <p class="kf-heading">${heading}</p>
        <span class="kf-rule" aria-hidden="true"></span>
        ${short ? `<p class="kf-text">${esc(short)}</p>` : ''}
        ${ev && ev.venue ? `<p class="kf-venue">${esc(ev.venue)}${ev.city ? ` · ${esc(ev.city)}` : ''}</p>` : ''}
        ${url(inv.media.voice) && !isPrint ? `<button type="button" class="ix-btn ix-btn-ghost ix-voice-btn" data-voice>▶ ${esc(t('playVoice'))}</button>` : ''}
      </div>
      <div class="kf-wall">
        <div class="kf-frame">
          <div class="kf-box">
            <div class="kf-sparkles" aria-hidden="true">${sparkles}</div>
            <div class="kf-card">
              <div class="kf-ring" aria-hidden="true">${motif.framed.ring}</div>
              ${cover ? `<div class="kf-photo"><img src="${esc(cover)}" alt="" loading="eager" data-fb="parent"></div>` : `<div class="kf-bouquet" aria-hidden="true">${motif.framed.bouquet}</div>`}
              <h1 class="kf-names">${esc(ctx.title)}</h1>
              ${host ? `<p class="kf-line">${esc(host)}</p>` : ''}
              ${date ? `<p class="kf-date">${esc(date)}${time ? ` · ${esc(time)}` : ''}</p>` : ''}
              ${rsvpOn ? `<a class="kf-pill" href="#sec-rsvp">${esc(t('rsvp'))}</a>` : ''}
            </div>
          </div>
        </div>
      </div>
    </section>`;
  }

  const SECTIONS = {
    opening(ctx) {
      const { inv, motif } = ctx;
      const ev = firstEvent(inv);
      const tz = inv.timezone;
      const sub = M.txt(inv, S.lang, 'subtitle');
      const host = M.txt(inv, S.lang, 'familyName');
      const cover = url(inv.media.cover);
      const logo = url(inv.media.logo);
      const dateBlock = ev ? (() => {
        const d = IX.zonedToUtc(ev.date, ev.start || '12:00', tz);
        const f = (o) => new Intl.DateTimeFormat(IX.locale(S.lang), { ...o, timeZone: tz }).format(d);
        return `<div class="ix-datebar"><span>${esc(f({ weekday: 'long' }))}</span><span class="ix-datebig"><small>${esc(f({ month: 'short' }))}</small><b>${esc(f({ day: 'numeric' }))}</b><small>${esc(f({ year: 'numeric' }))}</small></span><span>${esc(ev.start ? IX.fmtTime(ev.date, ev.start, tz, S.lang) : '')}</span></div>`;
      })() : '';
      if (motif.framed) return framedHero(ctx, ev, sub, host, cover);
      return `<section class="ix-hero" id="sec-opening" aria-label="${esc(ctx.title)}">
        ${deco(ctx)}
        ${motif.hero && !cover ? `<div class="ix-hero-art" aria-hidden="true">${motif.hero}</div>` : ''}
        ${cover ? `<div class="ix-hero-photo"><img src="${esc(cover)}" alt="" loading="eager" data-fb="parent"></div>` : ''}
        <div class="ix-hero-text">
          ${logo ? `<img class="ix-logo" src="${esc(logo)}" alt="" data-fb="self">` : ''}
          ${S.guest ? `<p class="ix-greet">${esc(t('dear'))} ${esc(S.guest.name)},</p>` : ''}
          ${host ? `<p class="ix-kicker">${esc(host)}</p>` : ''}
          <h1 class="ix-title">${esc(ctx.title)}</h1>
          ${sub ? `<p class="ix-sub">${esc(sub)}</p>` : ''}
          ${dateBlock}
          ${ev && ev.venue ? `<p class="ix-hero-venue">${esc(ev.venue)}${ev.city ? `<br><small>${esc(ev.city)}</small>` : ''}</p>` : ''}
          ${url(inv.media.voice) && !isPrint ? `<button type="button" class="ix-btn ix-btn-ghost ix-voice-btn" data-voice>▶ ${esc(t('playVoice'))}</button>` : ''}
        </div>
        ${decoB(ctx)}
        ${isPrint ? '' : `<a href="#sec-${(inv.design.sectionOrder.find((x) => x !== 'opening' && inv.design.sections[x])) || 'rsvp'}" class="ix-scroll" aria-label="Scroll down"><span aria-hidden="true">⌄</span></a>`}
      </section>`;
    },
    welcome(ctx) {
      const w = M.txt(ctx.inv, S.lang, 'welcome');
      if (!w) return '';
      return sec('welcome', `${h2('welcome', t('welcome'))}${divider(ctx)}<p class="ix-lead">${IX.nl2br(w)}</p>`);
    },
    hosts(ctx) {
      const { inv } = ctx;
      const list = (inv.hostsList || []).filter((h) => url(h.ref) || h.name);
      const hn = M.txt(inv, S.lang, 'hostName'), fam = M.txt(inv, S.lang, 'familyName');
      if (!list.length && !hn) return '';
      return sec('hosts', `${h2('hosts', t('hosts'))}${divider(ctx)}
        ${list.length ? `<div class="ix-people n${Math.min(list.length, 4)}">${list.map((h) => `<figure class="ix-person">${url(h.ref) ? `<div class="ix-photo"><img src="${esc(url(h.ref))}" alt="${esc(h.name || '')}" loading="lazy" data-fb="missing"></div>` : `<div class="ix-photo missing" aria-hidden="true"></div>`}<figcaption><b>${esc(h.name || '')}</b>${h.role ? `<span>${esc(h.role)}</span>` : ''}</figcaption></figure>`).join('')}</div>` : ''}
        ${hn ? `<p class="ix-hostname">${esc(hn)}</p>` : ''}${fam ? `<p class="ix-muted">${esc(fam)}</p>` : ''}`);
    },
    message(ctx) {
      const m = M.txt(ctx.inv, S.lang, 'message');
      if (!m) return '';
      return sec('message', `${h2('message', t('invitation'))}${divider(ctx)}<div class="ix-rich">${IX.sanitizeHTML(m)}</div>`, 'ix-card');
    },
    countdown(ctx) {
      const ev = firstEvent(ctx.inv);
      if (!ev) return '';
      const tz = ctx.inv.timezone;
      return sec('countdown', `${h2('countdown', t('countdown'))}
        <p class="ix-bigdate">${esc(IX.fmtDate(ev.date, tz, S.lang))}</p>
        ${ev.start ? `<p class="ix-muted">${esc(IX.fmtTime(ev.date, ev.start, tz, S.lang))}${ev.end ? ' – ' + esc(IX.fmtTime(ev.endDate || ev.date, ev.end, tz, S.lang)) : ''} · ${esc(IX.tzLabel(tz, IX.zonedToUtc(ev.date, ev.start, tz)))}</p>` : ''}
        <div class="ix-countdown" data-target="${IX.zonedToUtc(ev.date, ev.start || '00:00', tz).getTime()}" role="timer" aria-live="off">
          ${['days', 'hours', 'minutes', 'seconds'].map((k) => `<div><b data-k="${k}">00</b><span>${esc(t(k))}</span></div>`).join('')}
        </div>`);
    },
    schedule(ctx) {
      const { inv } = ctx;
      const evs = (inv.events || []).filter((e) => e.name || e.date);
      if (!evs.length) return '';
      const tz = inv.timezone, vtz = IX.viewerTz();
      const link = isPreview ? '' : location.href.split('#')[0];
      return sec('schedule', `${h2('schedule', t('schedule'))}${divider(ctx)}
        <ol class="ix-events">${evs.map((ev, i) => {
          const local = ev.date && ev.start && vtz !== tz ? new Intl.DateTimeFormat(IX.locale(S.lang), { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: vtz }).format(IX.zonedToUtc(ev.date, ev.start, tz)) : '';
          return `<li class="ix-event">
            <div class="ix-event-dot" aria-hidden="true">${i + 1}</div>
            <div class="ix-event-body">
              <h3>${esc(ev.name || t('invitation'))}</h3>
              ${ev.date ? `<p class="ix-when"><b>${esc(IX.fmtDate(ev.date, tz, S.lang, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }))}</b>${ev.start ? ` · ${esc(IX.fmtTime(ev.date, ev.start, tz, S.lang))}${ev.end ? ' – ' + esc(IX.fmtTime(ev.endDate || ev.date, ev.end, tz, S.lang)) : ''}` : ''}</p>` : ''}
              ${local ? `<p class="ix-small">${esc(t('yourTime'))}: ${esc(local)} (${esc(IX.tzLabel(vtz))})</p>` : ''}
              ${ev.venue || ev.address ? `<p class="ix-where">📍 ${esc(IX.venueText(ev))}</p>` : ''}
              ${ev.dressCode ? `<p class="ix-small">👗 ${esc(t('dressCode'))}: ${esc(ev.dressCode)}</p>` : ''}
              ${ev.notes ? `<p class="ix-small">${esc(ev.notes)}</p>` : ''}
              ${isPrint ? '' : `<div class="ix-actions">
                ${ev.date ? `<a class="ix-chip" target="_blank" rel="noopener" href="${esc(IX.googleCalendarUrl(inv, ev, link))}">📅 ${esc(t('googleCal'))}</a><button type="button" class="ix-chip" data-ics="${esc(ev.id)}">⬇ ${esc(t('icsFile'))}</button>` : ''}
                ${ev.venue || ev.address || ev.mapUrl ? `<a class="ix-chip" target="_blank" rel="noopener" href="${esc(IX.mapsDirectionsUrl(ev))}">🧭 ${esc(t('directions'))}</a>` : ''}
              </div>`}
            </div></li>`;
        }).join('')}</ol>
        ${evs.length > 1 && !isPrint ? `<button type="button" class="ix-btn ix-btn-ghost" data-ics="all">📅 ${esc(t('addCalendar'))} (${evs.length})</button>` : ''}`);
    },
    venue(ctx) {
      const { inv } = ctx;
      const ev = firstEvent(inv) || (inv.events || [])[0];
      if (!ev || !(ev.venue || ev.address)) return '';
      const embed = inv.settings.mapEmbed && !isPrint && navigator.onLine !== false;
      return sec('venue', `${h2('venue', t('venue'))}${divider(ctx)}
        <p class="ix-venue-name">${esc(ev.venue)}</p>
        <p class="ix-muted">${esc([ev.address, [ev.city, ev.pin].filter(Boolean).join(' – ')].filter(Boolean).join(', '))}</p>
        ${embed ? `<div class="ix-map"><iframe title="Map: ${esc(ev.venue)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${esc(IX.mapsEmbedUrl(ev))}"></iframe></div>` : ''}
        ${isPrint ? '' : `<div class="ix-actions center"><a class="ix-btn ix-btn-primary" id="directionsBtn" target="_blank" rel="noopener" href="${esc(IX.mapsDirectionsUrl(ev))}">🧭 ${esc(t('directions'))}</a>
        ${ev.date ? `<a class="ix-btn ix-btn-ghost" target="_blank" rel="noopener" id="gcalBtn" href="${esc(IX.googleCalendarUrl(inv, ev, isPreview ? '' : location.href.split('#')[0]))}">📅 ${esc(t('addCalendar'))}</a>` : ''}</div>`}`, 'ix-card');
    },
    highlights(ctx) {
      const list = (ctx.inv.highlights || []).filter((h) => h.title);
      if (!list.length) return '';
      return sec('highlights', `${h2('highlights', ctx.inv.highlightsTitle || t('highlights'))}${divider(ctx)}
        <div class="ix-highlights">${list.map((h) => `<div class="ix-hl"><span class="ix-hl-ic" aria-hidden="true">${esc(h.icon || '✦')}</span><b>${esc(h.title)}</b>${h.desc ? `<span>${esc(h.desc)}</span>` : ''}</div>`).join('')}</div>`);
    },
    gallery(ctx) {
      const g = (ctx.inv.media.gallery || []).filter((x) => url(x.ref));
      if (!g.length) return '';
      return sec('gallery', `${h2('gallery', t('gallery'))}${divider(ctx)}
        <div class="ix-gallery">${g.map((x, i) => `<button type="button" class="ix-gitem" data-lb="${i}" aria-label="Open photo ${i + 1}${x.caption ? ': ' + esc(x.caption) : ''}"><img src="${esc(url(x.ref))}" alt="${esc(x.caption || '')}" loading="lazy" data-fb="parent"></button>`).join('')}</div>`);
    },
    media(ctx) {
      const v = url(ctx.inv.media.video), a = url(ctx.inv.media.voice);
      if (!v && !a) return '';
      return sec('media', `${h2('media', t('message'))}${divider(ctx)}
        ${v ? `<div class="ix-video"><video controls playsinline preload="metadata" src="${esc(v)}"></video></div>` : ''}
        ${a ? `<div class="ix-audio"><p>${esc(t('playVoice'))}</p><audio controls preload="none" src="${esc(a)}" data-voice-audio></audio></div>` : ''}`, 'ix-card');
    },
    rsvp(ctx) {
      const { inv } = ctx;
      if (!inv.settings.rsvpEnabled || isPrint) return '';
      return sec('rsvp', `${h2('rsvp', t('rsvp'))}${divider(ctx)}<div id="rsvpBox">${rsvpInner(inv)}</div>`, 'ix-card');
    },
    instructions(ctx) {
      const { inv } = ctx;
      const ins = M.txt(inv, S.lang, 'instructions'), extra = M.txt(inv, S.lang, 'extraInfo');
      const dress = inv.dressCode || '';
      const c = inv.contact || {};
      if (!ins && !extra && !dress && !c.name && !c.phone) return '';
      return sec('instructions', `${h2('instructions', t('instructions'))}${divider(ctx)}
        ${dress ? `<p><b>${esc(t('dressCode'))}:</b> ${esc(dress)}</p>` : ''}
        ${ins ? `<p>${IX.nl2br(ins)}</p>` : ''}${extra ? `<p class="ix-muted">${IX.nl2br(extra)}</p>` : ''}
        ${c.name || c.phone ? `<div class="ix-contact"><span>${esc(t('contact'))}: <b>${esc(c.name || '')}</b></span>${c.phone && !isPrint ? `<a class="ix-chip" href="tel:${esc(IX.normPhone(c.phone) ? '+' + IX.normPhone(c.phone) : '')}">📞 ${esc(t('call'))}</a><a class="ix-chip" target="_blank" rel="noopener" href="${esc(IX.whatsappUrl('', c.phone))}">💬 WhatsApp</a>` : ''}</div>` : ''}`);
    },
    thankyou(ctx) {
      const msg = M.txt(ctx.inv, S.lang, 'thankyou') || t('thankyouMsg');
      return `<section class="ix-closing reveal" id="sec-thankyou" aria-labelledby="h-thankyou">${deco(ctx)}<h2 class="ix-title small" id="h-thankyou">${esc(t('thankyou'))}</h2>${divider(ctx)}<p class="ix-lead">${IX.nl2br(msg)}</p>
        ${M.txt(ctx.inv, S.lang, 'hostName') ? `<p class="ix-hostname">— ${esc(M.txt(ctx.inv, S.lang, 'hostName'))}</p>` : ''}${decoB(ctx)}</section>`;
    },
  };

  /* ---------------- RSVP ---------------- */
  function rsvpInner(inv) {
    const s = inv.settings;
    if (s.rsvpDeadline && new Date(s.rsvpDeadline + 'T23:59:59') < new Date()) return `<p class="ix-notice">${esc(t('rsvpClosed'))}</p>`;
    if (S.lastRsvp) return thanksHTML(S.lastRsvp);
    const ex = S.existing || {};
    const g = S.guest || {};
    // Prefill order: the guest's own earlier RSVP > host's guest list (personal link) > details saved on this phone
    const me = lsGet('ivx-me') || {};
    const pre = { name: g.name || me.name || '', phone: g.phone || me.phone || '', email: g.email || me.email || '' };
    const limit = (S.guest && S.guest.allowed) || s.maxPerInvite || 0;
    const evs = (inv.events || []).filter((e) => e.name);
    const v = (k, d = '') => esc(ex[k] != null ? ex[k] : d);
    const status = ex.status || '';
    return `
      ${s.rsvpDeadline ? `<p class="ix-muted center">${esc(t('rsvpBy'))}: <b>${esc(IX.fmtDate(s.rsvpDeadline, inv.timezone, S.lang))}</b></p>` : ''}
      ${S.existing ? `<p class="ix-notice">✔ ${esc(t('ref'))}: <b>${esc(ex.ref)}</b> — ${esc(t(status))}</p>` : ''}
      <form class="ix-form" id="rsvpForm" novalidate autocomplete="on">
        <div class="ix-field"><label for="r-name">${esc(t('name'))} *</label><input class="ix-input" id="r-name" name="name" autocomplete="name" required maxlength="120" enterkeyhint="next" value="${v('name', pre.name)}"></div>
        <div class="ix-field"><label for="r-phone">${esc(t('mobile'))} *</label><input class="ix-input" id="r-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="20" placeholder="+91 98765 43210" enterkeyhint="next" value="${v('phone', pre.phone)}"></div>
        <div class="ix-field"><label for="r-email">${esc(t('email'))}</label><input class="ix-input" id="r-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="160" value="${v('email', pre.email)}"></div>
        <label class="ix-check ix-remember"><input type="checkbox" name="rememberMe" ${me.name || !lsGet('ivx-me-off') ? 'checked' : ''}> <span>${esc(t('rememberMe'))}</span></label>
        <fieldset class="ix-field ix-choice"><legend>${esc(t('attend'))} *</legend>
          ${['yes', 'no', 'maybe'].map((k) => `<label class="ix-radio"><input type="radio" name="status" value="${k}" ${status === k ? 'checked' : ''} required><span>${esc(t(k))}</span></label>`).join('')}
        </fieldset>
        <div class="ix-when-yes" ${status && status !== 'no' ? '' : 'hidden'}>
          <div class="ix-counts">
            ${counter('adults', t('adults'), ex.adults != null ? ex.adults : 1)}
            ${s.askChildren ? counter('children', t('children'), ex.children || 0) : ''}
            <div class="ix-total"><span>${esc(t('total'))}</span><b id="r-total">0</b>${limit ? `<small>${esc(t('maxParty', { n: limit }))}</small>` : ''}</div>
          </div>
          ${s.askEvents && evs.length > 1 ? `<fieldset class="ix-field"><legend>${esc(t('whichEvents'))}</legend><div class="ix-evpick">${evs.map((e) => `<label class="ix-check"><input type="checkbox" name="eventIds" value="${esc(e.id)}" ${!ex.eventIds || !ex.eventIds.length || ex.eventIds.includes(e.id) ? 'checked' : ''}><span>${esc(e.name)}</span></label>`).join('')}</div></fieldset>` : ''}
          <div class="ix-field"><label for="r-extra">${esc(t('extraNames'))}</label><input class="ix-input" id="r-extra" name="extraNames" maxlength="500" value="${v('extraNames')}"></div>
          ${s.askFood ? `<div class="ix-field"><label for="r-food">${esc(t('food'))}</label><select class="ix-input" id="r-food" name="food">${Object.entries(t('foodOpts')).map(([k, l]) => `<option value="${k}" ${ex.food === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
          <div class="ix-field"><label for="r-req">${esc(t('requirements'))}</label><input class="ix-input" id="r-req" name="requirements" maxlength="500" value="${v('requirements')}"></div>
        </div>
        <div class="ix-field"><label for="r-msg">${esc(t('note'))}</label><textarea class="ix-input" id="r-msg" name="message" rows="3" maxlength="1000">${v('message')}</textarea></div>
        <label class="ix-check ix-consent"><input type="checkbox" name="consent" ${S.existing ? 'checked' : ''} required><span>${esc(t('consent'))}</span></label>
        <p class="ix-error" id="rsvpErr" role="alert" hidden></p>
        <button class="ix-btn ix-btn-primary ix-submit" type="submit" ${isPreview ? 'disabled title="RSVP is disabled in preview"' : ''}>${esc(S.existing ? t('update') : t('submit'))}</button>
        ${isPreview ? '<p class="ix-small center">Preview – RSVP submission is disabled here.</p>' : ''}
      </form>`;
  }
  const counter = (name, label, val) => `<div class="ix-counter"><span id="lbl-${name}">${esc(label)}</span><div class="ix-stepper" role="group" aria-labelledby="lbl-${name}"><button type="button" data-step="${name}" data-d="-1" aria-label="${esc(label)} −">−</button><input class="ix-input" type="number" inputmode="numeric" min="0" max="50" name="${name}" value="${esc(val)}" aria-labelledby="lbl-${name}"><button type="button" data-step="${name}" data-d="1" aria-label="${esc(label)} +">+</button></div></div>`;

  function thanksHTML(r) {
    const msg = r.status === 'yes' ? t('thanksYes') : r.status === 'no' ? t('thanksNo') : t('thanksMaybe');
    const editUrl = IX.inviteUrl(slug, { e: r.editToken, lang: S.lang });
    const c = S.inv.contact || {};
    const host = S.inv.settings.whatsappToHost && c.phone
      ? `<a class="ix-btn ix-btn-ghost" target="_blank" rel="noopener" href="${esc(IX.whatsappUrl(`RSVP – ${M.txt(S.inv, 'en', 'title')}\nName: ${r.name}\nResponse: ${r.status.toUpperCase()}\nAttendees: ${r.adults + r.children} (${r.adults} adults, ${r.children} children)\nRef: ${r.ref}`, c.phone))}">💬 ${esc(t('sendToHost'))}</a>` : '';
    return `<div class="ix-thanks" tabindex="-1" id="thanks">
      <div class="ix-thanks-ic" aria-hidden="true">${r.status === 'yes' ? '🎉' : r.status === 'no' ? '🙏' : '⏳'}</div>
      <p class="ix-lead"><b>${esc(r.name)}</b>, ${esc(msg)}</p>
      ${r.status === 'yes' ? `<p>${esc(t('total'))}: <b>${r.adults + r.children}</b> (${esc(t('adults'))} ${r.adults}${S.inv.settings.askChildren ? `, ${esc(t('children'))} ${r.children}` : ''})</p>` : ''}
      <p class="ix-ref">${esc(t('ref'))}<br><b data-ref>${esc(r.ref)}</b></p>
      ${r.status === 'yes' ? `<div class="ix-qr">${IX.qrSVG('IVX:' + slug + ':' + r.ref, { size: 168, dark: '#111', light: '#fff' })}<p class="ix-small">${esc(t('showQR'))}</p></div>` : ''}
      ${r.editToken ? `<div class="ix-editlink"><p class="ix-small">${esc(t('editLink'))}</p><div class="ix-copyrow"><input class="ix-input" readonly value="${esc(editUrl)}" aria-label="Private edit link"><button type="button" class="ix-btn ix-btn-ghost" data-copy="${esc(editUrl)}">${esc(t('copy'))}</button></div></div>` : ''}
      <div class="ix-actions center">${host}<button type="button" class="ix-btn ix-btn-ghost" id="changeBtn">${esc(t('editResponse'))}</button></div>
    </div>`;
  }

  function readForm(f) {
    const fd = new FormData(f);
    return {
      name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'), status: fd.get('status') || '',
      adults: IX.int(fd.get('adults'), 0), children: IX.int(fd.get('children'), 0), extraNames: fd.get('extraNames') || '',
      food: fd.get('food') || '', requirements: fd.get('requirements') || '', message: fd.get('message') || '',
      eventIds: fd.getAll('eventIds'), consent: !!fd.get('consent'), lang: S.lang,
    };
  }

  function wireRsvp() {
    const f = document.getElementById('rsvpForm');
    const box = document.getElementById('rsvpBox');
    if (!box) return;
    const ch = document.getElementById('changeBtn');
    if (ch) ch.onclick = async () => {
      S.existing = S.lastRsvp ? { ...S.lastRsvp } : S.existing;
      S.lastRsvp = null;
      box.innerHTML = rsvpInner(S.inv);
      wireRsvp();
      document.getElementById('r-name')?.focus();
    };
    box.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = async () => { await IX.copy(b.dataset.copy); b.textContent = t('copied'); }));
    if (!f) return;
    const total = () => {
      const a = IX.int(f.adults?.value, 0), c = IX.int(f.children?.value, 0);
      const el = document.getElementById('r-total');
      if (el) el.textContent = a + c;
    };
    total();
    f.addEventListener('input', total);
    f.querySelectorAll('[data-step]').forEach((b) => (b.onclick = () => {
      const inp = f.elements[b.dataset.step];
      inp.value = IX.clamp(IX.int(inp.value, 0) + IX.int(b.dataset.d), 0, 50);
      total();
    }));
    f.querySelectorAll('input[name=status]').forEach((r) => (r.onchange = () => {
      f.querySelector('.ix-when-yes').hidden = r.value === 'no';
    }));
    let busy = false;
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (busy || isPreview) return; // guard against double taps
      const err = document.getElementById('rsvpErr');
      const showErr = (m, field) => { err.textContent = m; err.hidden = false; if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); } };
      f.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
      err.hidden = true;
      const p = readForm(f);
      const limit = (S.guest && S.guest.allowed) || S.inv.settings.maxPerInvite || 0;
      if (!p.name || p.name.trim().length < 2) return showErr(t('required'), f.name);
      if (!IX.validPhone(p.phone)) return showErr(t('invalidPhone'), f.phone);
      if (!IX.validEmail(p.email)) return showErr(t('invalidEmail'), f.email);
      if (!p.status) return showErr(t('required') + ' — ' + t('attend'), f.querySelector('input[name=status]'));
      if (p.status !== 'no' && p.adults + p.children < 1 && p.status === 'yes') return showErr(t('needPeople'), f.adults);
      if (p.status !== 'no' && limit && p.adults + p.children > limit) return showErr(t('maxParty', { n: limit }), f.adults);
      if (!p.consent) return showErr(t('needConsent'), f.consent);
      busy = true;
      const btn = f.querySelector('.ix-submit');
      btn.disabled = true; btn.textContent = t('sending');
      let res;
      try { res = await S.store.submitRsvp(slug, p, { password: S.password, guestToken: S.guestToken, editToken: S.editToken }); } catch (ex) { res = { status: 'error', message: ex.message }; }
      busy = false;
      if (res.status !== 'ok') {
        btn.disabled = false; btn.textContent = S.existing ? t('update') : t('submit');
        return showErr(res.code ? t(res.code, { n: res.n }) : res.message || 'Something went wrong. Please try again.');
      }
      S.editToken = res.editToken;
      lsSet('ivx-rsvp-' + slug, { editToken: res.editToken, ref: res.ref });
      // Remember name/phone/email on THIS phone only (never sent anywhere else), if the guest left the box ticked
      if (f.rememberMe && f.rememberMe.checked) { lsSet('ivx-me', { name: p.name.trim(), phone: (p.phone || '').trim(), email: (p.email || '').trim() }); lsSet('ivx-me-off', false); }
      else { try { localStorage.removeItem('ivx-me'); } catch (e2) { /* ignore */ } lsSet('ivx-me-off', true); }
      const clean = M.cleanRsvp(p);
      S.lastRsvp = { ...clean, ref: res.ref, editToken: res.editToken };
      S.existing = { ...clean, ref: res.ref };
      box.innerHTML = rsvpInner(S.inv);
      wireRsvp();
      document.getElementById('thanks')?.focus();
    };
  }

  /* ---------------- interactions ---------------- */
  function wire(ctx) {
    const { inv } = ctx;
    // graceful handling of missing images (no inline handlers, CSP friendly)
    document.querySelectorAll('img[data-fb]').forEach((img) => {
      const fail = () => { const m = img.dataset.fb; if (m === 'parent') img.parentNode.remove(); else if (m === 'missing') { img.parentNode.classList.add('missing'); img.remove(); } else img.remove(); };
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail(); else img.addEventListener('error', fail, { once: true });
    });
    // language
    document.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => {
      S.lang = b.dataset.lang;
      lsSet('ivx-lang-' + slug, S.lang);
      if (isPreview) parent.postMessage({ type: 'ix-preview-lang', lang: S.lang }, location.origin);
      render(true);
    }));
    // music
    const mUrl = url(inv.media.music);
    const btn = document.getElementById('musicBtn');
    if (mUrl) {
      if (!S.music || S.music.dataset.src !== mUrl) {
        if (S.music) S.music.pause();
        S.music = new Audio(mUrl);
        S.music.dataset.src = mUrl;
        S.music.loop = true;
        S.music.volume = 0.55;
        S.music.onerror = () => { if (btn) btn.hidden = true; };
      }
      const sync = () => { if (!btn) return; const on = !S.music.paused; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on); btn.setAttribute('aria-label', t('music') + ': ' + (on ? 'pause' : 'play')); };
      S.music.onplay = sync; S.music.onpause = sync; sync();
      if (btn) btn.onclick = () => (S.music.paused ? S.music.play().catch(() => {}) : S.music.pause());
    }
    // voice buttons pause music
    document.querySelectorAll('[data-voice]').forEach((b) => (b.onclick = () => {
      const a = document.querySelector('[data-voice-audio]') || new Audio(url(inv.media.voice));
      if (S.music) S.music.pause();
      a.play().catch(() => {});
      if (a.isConnected) a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    document.querySelectorAll('audio[data-voice-audio], video').forEach((a) => a.addEventListener('play', () => S.music && S.music.pause()));
    // opener
    const op = document.getElementById('opener');
    if (op) {
      document.body.classList.add('locked');
      const ob = document.getElementById('openBtn');
      ob.focus({ preventScroll: true });
      ob.onclick = () => {
        S.opened = true;
        op.classList.add('opening');
        document.body.classList.remove('locked');
        document.querySelector('.ix-page').classList.add('opened');
        if (S.music && inv.design.musicAutoplay && !isPreview) S.music.play().catch(() => {});
        if (isPreview) parent.postMessage({ type: 'ix-preview-opened' }, location.origin);
        setTimeout(() => op.remove(), 1300);
      };
    } else document.body.classList.remove('locked');
    // ICS
    document.querySelectorAll('[data-ics]').forEach((b) => (b.onclick = () => {
      const evs = b.dataset.ics === 'all' ? inv.events.filter((e) => e.date) : inv.events.filter((e) => e.id === b.dataset.ics);
      const name = IX.slugify(M.txt(inv, 'en', 'title') || 'invitation') || 'invitation';
      IX.download(name + '.ics', IX.buildICS(inv, evs, isPreview ? '' : location.href.split('#')[0]), 'text/calendar;charset=utf-8');
    }));
    // countdown
    const cd = document.querySelector('.ix-countdown');
    if (cd) {
      const target = +cd.dataset.target;
      const tick = () => {
        let s = Math.floor((target - Date.now()) / 1000);
        if (s <= 0) { cd.innerHTML = `<p class="ix-lead">${esc(t('started'))}</p>`; return false; }
        const v = { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
        Object.entries(v).forEach(([k, n]) => { const el = cd.querySelector(`[data-k=${k}]`); if (el) el.textContent = String(n).padStart(2, '0'); });
        return true;
      };
      if (tick()) S.timers.push(setInterval(tick, 1000));
    }
    // gallery lightbox
    const g = (inv.media.gallery || []).filter((x) => url(x.ref));
    const lb = document.getElementById('lightbox');
    let idx = 0, lastFocus = null;
    const show = (i) => {
      idx = (i + g.length) % g.length;
      lb.innerHTML = `<button type="button" class="lb-close" aria-label="Close">×</button>${g.length > 1 ? '<button type="button" class="lb-prev" aria-label="Previous">‹</button><button type="button" class="lb-next" aria-label="Next">›</button>' : ''}<figure><img src="${esc(url(g[idx].ref))}" alt="${esc(g[idx].caption || '')}">${g[idx].caption ? `<figcaption>${esc(g[idx].caption)}</figcaption>` : ''}<p class="lb-count">${idx + 1} / ${g.length}</p></figure>`;
      lb.hidden = false;
      lb.querySelector('.lb-close').onclick = close;
      lb.querySelector('.lb-prev') && (lb.querySelector('.lb-prev').onclick = () => show(idx - 1));
      lb.querySelector('.lb-next') && (lb.querySelector('.lb-next').onclick = () => show(idx + 1));
      lb.querySelector('.lb-close').focus();
    };
    const close = () => { lb.hidden = true; lb.innerHTML = ''; lastFocus && lastFocus.focus(); };
    document.querySelectorAll('[data-lb]').forEach((b) => (b.onclick = () => { lastFocus = b; show(+b.dataset.lb); }));
    lb.onclick = (e) => { if (e.target === lb) close(); };
    let sx = 0;
    lb.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
    lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); });
    document.onkeydown = (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    };
    // reveal on scroll
    const els = document.querySelectorAll('.reveal');
    if (inv.design.animation === 'none' || isPrint || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) els.forEach((e) => e.classList.add('in'));
    else {
      const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.12 });
      els.forEach((e) => io.observe(e));
    }
    wireRsvp();
  }

  boot();
})();
