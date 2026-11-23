/* InviteX shared utilities (no dependencies). Exposed as window.IX */
(function () {
  'use strict';
  const IX = (window.IX = window.IX || {});

  /* ---------- strings & ids ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  IX.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  IX.nl2br = (s) => IX.esc(s).replace(/\n/g, '<br>');

  IX.randomToken = (len = 24) => {
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(a, (b) => abc[b % abc.length]).join('');
  };
  IX.uid = (prefix = '') => prefix + Date.now().toString(36) + IX.randomToken(8);
  IX.confirmationRef = () => {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const a = new Uint8Array(6);
    crypto.getRandomValues(a);
    return 'IVX-' + Array.from(a, (b) => abc[b % abc.length]).join('');
  };
  IX.slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  IX.validSlug = (s) => /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(s || '');

  IX.sha256 = async (text) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  };

  IX.normPhone = (p) => {
    let d = String(p || '').replace(/[^\d]/g, '');
    if (d.length === 10) d = '91' + d; // default India country code for 10-digit numbers
    if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1);
    return d;
  };
  IX.validPhone = (p) => {
    const d = IX.normPhone(p);
    return d.length >= 10 && d.length <= 15;
  };
  IX.validEmail = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  IX.maskPhone = (p) => {
    const d = String(p || '');
    return d.length > 4 ? d.slice(0, 2) + '•'.repeat(Math.max(0, d.length - 6)) + d.slice(-4) : d;
  };
  IX.clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  IX.int = (v, d = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : d;
  };
  IX.deepClone = (o) => JSON.parse(JSON.stringify(o));
  IX.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  /* ---------- HTML sanitiser for rich text ---------- */
  const ALLOWED = {
    B: [], STRONG: [], I: [], EM: [], U: [], BR: [], P: ['style'], DIV: ['style'], SPAN: ['style'],
    H2: ['style'], H3: ['style'], UL: [], OL: [], LI: [], BLOCKQUOTE: [], FONT: ['color', 'size'], A: ['href'],
    SMALL: [], SUP: [], SUB: [], HR: [],
  };
  const STYLE_OK = /^(color|text-align|font-size|font-weight|font-style|text-decoration|background-color)\s*:\s*[#(),.%\w\s-]+$/i;
  IX.sanitizeHTML = (html) => {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    const walk = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) return ch.remove();
        const tag = ch.tagName;
        if (!ALLOWED[tag]) {
          if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'svg', 'SVG', 'MATH', 'TEMPLATE'].includes(tag)) return ch.remove();
          walk(ch);
          ch.replaceWith(...ch.childNodes);
          return;
        }
        [...ch.attributes].forEach((at) => {
          const name = at.name.toLowerCase();
          if (!ALLOWED[tag].includes(name)) return ch.removeAttribute(at.name);
          if (name === 'style') {
            const kept = at.value.split(';').map((s) => s.trim()).filter((s) => s && STYLE_OK.test(s) && !/url|expression/i.test(s));
            kept.length ? ch.setAttribute('style', kept.join(';')) : ch.removeAttribute('style');
          }
          if (name === 'href' && !/^(https?:|mailto:|tel:)/i.test(at.value.trim())) ch.removeAttribute('href');
        });
        if (tag === 'A') { ch.setAttribute('target', '_blank'); ch.setAttribute('rel', 'noopener noreferrer'); }
        walk(ch);
      });
    };
    walk(tpl.content);
    return tpl.innerHTML;
  };
  IX.htmlToText = (html) => {
    const d = document.createElement('div');
    d.innerHTML = IX.sanitizeHTML(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h2|h3)>/gi, '\n');
    return d.textContent.replace(/\n{3,}/g, '\n\n').trim();
  };

  /* ---------- time zones ---------- */
  // Offset (minutes) of an IANA zone at a given UTC instant.
  IX.tzOffset = (utcMs, tz) => {
    try {
      const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const p = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
      const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
      return Math.round((asUTC - utcMs) / 60000);
    } catch (e) {
      return 0;
    }
  };
  // Convert wall-clock date ("2026-12-12") + time ("19:30") in zone tz to a UTC Date.
  IX.zonedToUtc = (date, time, tz) => {
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = (time || '00:00').split(':').map(Number);
    const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
    let off = IX.tzOffset(guess, tz);
    let utc = guess - off * 60000;
    const off2 = IX.tzOffset(utc, tz); // DST correction
    if (off2 !== off) utc = guess - off2 * 60000;
    return new Date(utc);
  };
  IX.eventRange = (ev, tz) => {
    const start = IX.zonedToUtc(ev.date, ev.start || '00:00', tz);
    let end = ev.end ? IX.zonedToUtc(ev.endDate || ev.date, ev.end, tz) : null;
    if (start && (!end || end <= start)) end = new Date(start.getTime() + (ev.end ? 24 * 3600e3 : 3 * 3600e3));
    if (start && ev.end && end && end - start > 24 * 3600e3) end = new Date(start.getTime() + 3 * 3600e3);
    return { start, end };
  };
  const LOCALES = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };
  IX.locale = (lang) => LOCALES[lang] || lang || 'en-IN';
  IX.fmtDate = (date, tz, lang = 'en', opts) => {
    if (!date) return '';
    const d = date instanceof Date ? date : IX.zonedToUtc(date, '12:00', tz);
    return new Intl.DateTimeFormat(IX.locale(lang), opts || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(d);
  };
  IX.fmtTime = (date, time, tz, lang = 'en') => {
    if (!date || !time) return '';
    const d = IX.zonedToUtc(date, time, tz);
    return new Intl.DateTimeFormat(IX.locale(lang), { hour: 'numeric', minute: '2-digit', timeZone: tz }).format(d);
  };
  IX.tzLabel = (tz, at = new Date()) => {
    try {
      const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at);
      return (p.find((x) => x.type === 'timeZoneName') || {}).value || tz;
    } catch (e) { return tz; }
  };
  IX.viewerTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  IX.timezones = () => {
    try { return Intl.supportedValuesOf('timeZone'); } catch (e) {
      return ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];
    }
  };

  /* ---------- calendar ---------- */
  const icsStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line) => {
    const out = [];
    let s = line;
    while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
    out.push(s);
    return out.join('\r\n');
  };
  IX.venueText = (ev) => [ev.venue, ev.address, [ev.city, ev.pin].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  IX.buildICS = (inv, events, url) => {
    const tz = inv.timezone || 'Asia/Kolkata';
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//InviteX//Digital Invitations//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    events.forEach((ev) => {
      const { start, end } = IX.eventRange(ev, tz);
      if (!start) return;
      lines.push('BEGIN:VEVENT',
        'UID:' + (inv.id || 'ivx') + '-' + (ev.id || 'e') + '@invitex',
        'DTSTAMP:' + icsStamp(new Date()),
        'DTSTART:' + icsStamp(start),
        'DTEND:' + icsStamp(end),
        'SUMMARY:' + icsEsc((ev.name ? ev.name + ' – ' : '') + (inv.title || 'Invitation')),
        'LOCATION:' + icsEsc(IX.venueText(ev)),
        'DESCRIPTION:' + icsEsc([inv.hostName ? 'Hosted by ' + inv.hostName : '', ev.dressCode ? 'Dress code: ' + ev.dressCode : '', url ? 'Invitation: ' + url : ''].filter(Boolean).join('\n')),
        url ? 'URL:' + url : '',
        'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.name || inv.title), 'END:VALARM',
        'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.filter(Boolean).map(fold).join('\r\n');
  };
  IX.googleCalendarUrl = (inv, ev, url) => {
    const tz = inv.timezone || 'Asia/Kolkata';
    const { start, end } = IX.eventRange(ev, tz);
    if (!start) return '#';
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: (ev.name ? ev.name + ' – ' : '') + (inv.title || 'Invitation'),
      dates: icsStamp(start) + '/' + icsStamp(end),
      details: [inv.hostName ? 'Hosted by ' + inv.hostName : '', ev.dressCode ? 'Dress code: ' + ev.dressCode : '', url ? 'Invitation & RSVP: ' + url : ''].filter(Boolean).join('\n'),
      location: IX.venueText(ev),
      ctz: tz,
    });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  };

  /* ---------- maps ---------- */
  IX.mapsDirectionsUrl = (ev) => {
    if (ev.mapUrl && /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(ev.mapUrl)) return ev.mapUrl;
    const dest = IX.venueText(ev);
    return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest);
  };
  // Proposed Maps link from venue + address + city + PIN (no API key needed)
  IX.mapsSearchUrl = (ev) => {
    const q = IX.venueText(ev);
    return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
  };
  IX.mapsEmbedUrl = (ev) => 'https://maps.google.com/maps?q=' + encodeURIComponent(IX.venueText(ev)) + '&z=15&output=embed';

  /* ---------- WhatsApp / email ---------- */
  IX.whatsappUrl = (text, phone) => {
    const p = phone ? IX.normPhone(phone) : '';
    return 'https://wa.me/' + (p || '') + '?text=' + encodeURIComponent(text);
  };
  IX.mailtoUrl = (to, subject, body) =>
    'mailto:' + encodeURIComponent(to || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

  /* ---------- CSV ---------- */
  IX.toCSV = (rows) =>
    rows.map((r) => r.map((v) => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV/formula-injection guard for Excel
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  IX.download = (filename, data, mime = 'text/plain') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  };

  /* ---------- files & images ---------- */
  IX.FILE_RULES = {
    image: { exts: ['jpg', 'jpeg', 'png', 'webp'], mimes: ['image/jpeg', 'image/png', 'image/webp'], max: 20 * 1024 * 1024 },
    audio: { exts: ['mp3'], mimes: ['audio/mpeg', 'audio/mp3'], max: 12 * 1024 * 1024 },
    video: { exts: ['mp4'], mimes: ['video/mp4'], max: 40 * 1024 * 1024 },
  };
  const sniff = async (file) => {
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    const ascii = String.fromCharCode(...b);
    if (hex.startsWith('ffd8ff')) return 'image/jpeg';
    if (hex.startsWith('89504e47')) return 'image/png';
    if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
    if (ascii.startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
    if (ascii.slice(4, 8) === 'ftyp') return 'video/mp4';
    return '';
  };
  // Returns {ok, error, kind}
  IX.validateFile = async (file, kind) => {
    const rule = IX.FILE_RULES[kind];
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!rule.exts.includes(ext)) return { ok: false, error: `"${file.name}" is not a supported ${kind} file. Allowed: ${rule.exts.join(', ').toUpperCase()}.` };
    if (file.size > rule.max) return { ok: false, error: `"${file.name}" is too large (${(file.size / 1048576).toFixed(1)} MB). Maximum is ${rule.max / 1048576} MB.` };
    const real = await sniff(file);
    if (!real || (kind === 'image' && !real.startsWith('image/')) || (kind === 'audio' && real !== 'audio/mpeg') || (kind === 'video' && real !== 'video/mp4'))
      return { ok: false, error: `"${file.name}" does not look like a valid ${ext.toUpperCase()} file.` };
    return { ok: true, mime: real };
  };
  IX.loadImage = (src) =>
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Could not read image'));
      img.src = src;
    });
  let webpOK = null;
  const canWebp = () => {
    if (webpOK === null) {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      webpOK = c.toDataURL('image/webp').startsWith('data:image/webp');
    }
    return webpOK;
  };
  IX.canvasToBlob = (canvas, quality = 0.82, keepAlpha = false) =>
    new Promise((res) => {
      const type = canWebp() ? 'image/webp' : keepAlpha ? 'image/png' : 'image/jpeg';
      canvas.toBlob((b) => res(b), type, quality);
    });
  // Downscale + re-encode. crop = {sx, sy, sw, sh} in source pixels (optional)
  IX.compressImage = async (src, { maxDim = 1600, quality = 0.82, crop = null, rotate = 0, keepAlpha = false } = {}) => {
    const url = src instanceof Blob ? URL.createObjectURL(src) : src;
    const img = await IX.loadImage(url);
    if (src instanceof Blob) URL.revokeObjectURL(url);
    const c = crop || { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
    const rot = ((rotate % 360) + 360) % 360;
    const sideways = rot === 90 || rot === 270;
    const scale = Math.min(1, maxDim / Math.max(c.sw, c.sh));
    const w = Math.round(c.sw * scale), h = Math.round(c.sh * scale);
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? h : w;
    canvas.height = sideways ? w : h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, -w / 2, -h / 2, w, h);
    const blob = await IX.canvasToBlob(canvas, quality, keepAlpha);
    return { blob, width: canvas.width, height: canvas.height };
  };
  IX.fmtBytes = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  /* ---------- QR ---------- */
  IX.qrSVG = (text, { size = 220, dark = '#111', light = '#fff', margin = 2 } = {}) => {
    if (typeof qrcode !== 'function') return '';
    const qr = qrcode(0, 'M');
    qr.addData(unescape(encodeURIComponent(text)));
    qr.make();
    const n = qr.getModuleCount();
    const total = n + margin * 2;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
  };
  IX.qrPNG = async (text, size = 600) => {
    const svg = IX.qrSVG(text, { size });
    const img = await IX.loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, 0, 0, size, size);
    return new Promise((r) => c.toBlob(r, 'image/png'));
  };

  /* ---------- clipboard & toast ---------- */
  IX.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const t = document.createElement('textarea');
      t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove(); return ok;
    }
  };
  IX.toast = (msg, type = 'info', ms = 3200) => {
    let host = document.getElementById('ix-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ix-toasts';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'ix-toast ix-toast-' + type;
    t.textContent = msg;
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  };

  /* ---------- links ---------- */
  IX.baseUrl = () => {
    const cfg = window.INVITEX_CONFIG || {};
    if (cfg.PUBLIC_BASE_URL) return cfg.PUBLIC_BASE_URL.replace(/\/?$/, '/');
    return new URL('./', location.href).href;
  };
  IX.inviteUrl = (slug, params = {}) => {
    const u = new URL('invite.html', IX.baseUrl());
    u.searchParams.set('i', slug);
    Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v));
    return u.href;
  };
})();
