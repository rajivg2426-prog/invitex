/* InviteX data layer.
 *  - LocalStore: IndexedDB, used in Demo/Local mode (no backend).
 *  - SupabaseStore: production backend (Postgres + RLS + Storage + Auth).
 * Both implement the same async API so the UI does not care which is active.
 * Exposed as window.IXStore (a promise resolving to the active store) and IX.model. */
(function () {
  'use strict';
  const IX = window.IX;
  const CFG = window.INVITEX_CONFIG || {};

  /* ======================= Model ======================= */
  const model = {};
  model.newEvent = (name = 'Main Event') => ({
    id: IX.uid('ev_'), name, date: '', start: '18:00', end: '22:00', venue: '', address: '', city: '', pin: '', mapUrl: '', dressCode: '', notes: '',
  });
  model.newInvitation = (categoryId = 'custom', themeId) => {
    const cat = IXT.CATEGORIES.find((c) => c.id === categoryId) || IXT.CATEGORIES[IXT.CATEGORIES.length - 1];
    const theme = themeId || cat.theme;
    const t = IXT.THEMES[theme];
    const sections = {};
    IXT.SECTIONS.forEach((s) => (sections[s.id] = !['highlights', 'media'].includes(s.id)));
    return {
      id: IX.uid('inv_'),
      slug: '',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: null,
      published: null, // snapshot that guests see
      category: cat.id,
      theme,
      paletteIndex: 0,
      layout: 'portrait',
      timezone: CFG.DEFAULT_TIMEZONE || 'Asia/Kolkata',
      languages: ['en'],
      defaultLang: 'en',
      text: { en: { title: '', subtitle: '', hostName: '', familyName: '', welcome: '', message: '', instructions: '', extraInfo: '', thankyou: '' } },
      contact: { name: '', phone: '' },
      dressCode: '',
      highlightsTitle: '',
      events: [model.newEvent(cat.main || cat.events[0])],
      highlights: [],
      hostsList: [], // [{ref, name, role}]
      media: { cover: '', background: '', logo: '', decor: '', gallery: [], music: '', voice: '', video: '' },
      design: {
        fonts: { ...t.fonts },
        fontScale: 1,
        textColor: '', bgColor: '', accentColor: '',
        border: 'ornate', // none | thin | double | ornate
        animation: 'gentle', // none | gentle | lively
        spacing: 'comfortable', // compact | comfortable | airy
        photoShape: 'arch', // arch | circle | rounded | square
        decorations: true,
        sectionOrder: IXT.SECTIONS.map((s) => s.id),
        sections,
        musicAutoplay: true,
      },
      settings: {
        rsvpEnabled: true,
        rsvpDeadline: '',
        maxGuestsTotal: 0,
        maxPerInvite: 6,
        askChildren: true,
        askFood: true,
        askEvents: true,
        expiresAt: '',
        passwordProtected: false,
        passwordHash: '',
        whatsappToHost: false,
        questions: [], // host's own RSVP questions: [{id, label, type: 'text'|'choice', options: 'A, B', required}]
      },
    };
  };
  /* Host's own RSVP questions, cleaned: at most 5, each with a label. */
  model.MAX_QUESTIONS = 5;
  model.rsvpQuestions = (inv) => ((inv && inv.settings && inv.settings.questions) || [])
    .filter((q) => q && q.id && String(q.label || '').trim())
    .slice(0, model.MAX_QUESTIONS)
    .map((q) => ({ id: String(q.id), label: String(q.label).trim().slice(0, 160), type: q.type === 'choice' ? 'choice' : 'text', required: !!q.required,
      options: q.type === 'choice' ? String(q.options || '').split(',').map((o) => o.trim()).filter(Boolean).slice(0, 12) : [] }));
  /* The first missing required answer, or null. "No" replies never need answers. */
  model.missingAnswer = (inv, p) => (p.status === 'no' ? null
    : model.rsvpQuestions(inv).find((q) => q.required && !String((p.answers || {})[q.id] || '').trim()) || null);
  /* Snapshot for (re)publishing. A republish carries a "last updated" notice for guests
   * unless the host switched it off; the note is the host's own words, shown as written. */
  model.snapshotForPublish = (inv) => {
    const prev = inv.published;
    const snap = model.publicSnapshot(inv);
    const now = new Date().toISOString();
    snap.publishedVersionAt = now;
    const u = inv.updateNotice || {};
    if (prev && u.show !== false) snap.lastUpdate = { at: now, note: String(u.note || '').trim().slice(0, 200) };
    else if (prev && prev.lastUpdate) snap.lastUpdate = prev.lastUpdate; // quiet update: the earlier notice stays as it was
    return snap;
  };
  // Text for a language with fallback to default language.
  model.txt = (inv, lang, key) => {
    const t = inv.text || {};
    return (t[lang] && t[lang][key]) || (t[inv.defaultLang] && t[inv.defaultLang][key]) || (t.en && t.en[key]) || '';
  };
  model.palette = (inv) => {
    const th = IXT.THEMES[inv.theme] || IXT.THEMES['minimal-ivory'];
    const p = { ...(th.palettes[inv.paletteIndex] || th.palettes[0]) };
    const d = inv.design || {};
    if (d.textColor) p.text = d.textColor;
    if (d.bgColor) { p.bg = d.bgColor; p.bg2 = d.bgColor; }
    if (d.accentColor) p.accent = d.accentColor;
    return p;
  };
  // Public snapshot – strips host-only fields.
  model.publicSnapshot = (inv) => {
    const s = IX.deepClone(inv);
    delete s.published;
    delete s.copy; // writing-studio notes (history, personal note) are for the host only
    delete s.updateNotice; // the host's draft "what changed" note; published as lastUpdate
    if (s.settings) delete s.settings.passwordHash;
    return s;
  };
  model.stats = (rsvps, guests = [], events = []) => {
    const st = { invited: guests.length, responses: rsvps.length, yes: 0, no: 0, maybe: 0, attendees: 0, adults: 0, children: 0, maybeHeads: 0, food: {}, events: {}, checkedIn: 0, checkedInHeads: 0 };
    events.forEach((e) => (st.events[e.id] = { name: e.name, yes: 0, heads: 0 }));
    rsvps.forEach((r) => {
      st[r.status] = (st[r.status] || 0) + 1;
      if (r.status === 'yes') {
        st.adults += r.adults || 0;
        st.children += r.children || 0;
        st.attendees += (r.adults || 0) + (r.children || 0);
        if (r.food) st.food[r.food] = (st.food[r.food] || 0) + (r.adults || 0) + (r.children || 0);
        const evIds = r.eventIds && r.eventIds.length ? r.eventIds : events.map((e) => e.id);
        evIds.forEach((id) => { if (st.events[id]) { st.events[id].yes++; st.events[id].heads += (r.adults || 0) + (r.children || 0); } });
        if (r.checkedInAt) { st.checkedIn++; st.checkedInHeads += (r.adults || 0) + (r.children || 0); }
      }
      if (r.status === 'maybe') st.maybeHeads += (r.adults || 0) + (r.children || 0);
    });
    const respondedGuestIds = new Set(rsvps.map((r) => r.guestId).filter(Boolean));
    st.pending = Math.max(0, guests.filter((g) => !respondedGuestIds.has(g.id)).length);
    const base = Math.max(st.invited, st.responses);
    st.responseRate = base ? Math.round((st.responses / base) * 100) : 0;
    st.attendanceRate = st.responses ? Math.round((st.yes / st.responses) * 100) : 0;
    return st;
  };
  // Shared server-side style validation of an RSVP payload. Returns error key or ''.
  model.validateRsvp = (p) => {
    if (!p.name || p.name.trim().length < 2 || p.name.length > 120) return 'required';
    if (!IX.validPhone(p.phone)) return 'invalidPhone';
    if (p.email && !IX.validEmail(p.email)) return 'invalidEmail';
    if (!['yes', 'no', 'maybe'].includes(p.status)) return 'required';
    if (!p.consent) return 'needConsent';
    if (p.status === 'yes' && (p.adults || 0) + (p.children || 0) < 1) return 'needPeople';
    return '';
  };
  // Answers to the host's own questions: {questionId: text}, at most 5, short values.
  const cleanAnswers = (a) => {
    const out = {};
    if (!a || typeof a !== 'object' || Array.isArray(a)) return out;
    Object.keys(a).slice(0, 5).forEach((k) => { const v = String(a[k] == null ? '' : a[k]).trim().slice(0, 300); if (/^[\w-]{1,40}$/.test(k) && v) out[k] = v; });
    return out;
  };
  model.cleanAnswers = cleanAnswers;
  const cleanRsvp = (p) => ({
    name: String(p.name || '').trim().slice(0, 120),
    phone: String(p.phone || '').trim().slice(0, 20),
    email: String(p.email || '').trim().slice(0, 160),
    status: p.status,
    adults: p.status === 'no' ? 0 : IX.clamp(IX.int(p.adults, 0), 0, 50),
    children: p.status === 'no' ? 0 : IX.clamp(IX.int(p.children, 0), 0, 50),
    extraNames: String(p.extraNames || '').slice(0, 500),
    food: ['', 'veg', 'nonveg', 'jain', 'vegan', 'other'].includes(p.food) ? p.food : '',
    requirements: String(p.requirements || '').slice(0, 500),
    message: String(p.message || '').slice(0, 1000),
    eventIds: Array.isArray(p.eventIds) ? p.eventIds.slice(0, 20).map(String) : [],
    consent: !!p.consent,
    lang: ['en', 'hi', 'pa'].includes(p.lang) ? p.lang : 'en',
    answers: cleanAnswers(p.answers),
  });
  model.cleanRsvp = cleanRsvp;

  /* ======================= Local (IndexedDB) ======================= */
  const DB_NAME = 'invitex-local';
  const openDB = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        const inv = db.createObjectStore('invitations', { keyPath: 'id' });
        inv.createIndex('slug', 'slug', { unique: false });
        db.createObjectStore('guests', { keyPath: 'id' }).createIndex('invitationId', 'invitationId');
        db.createObjectStore('rsvps', { keyPath: 'id' }).createIndex('invitationId', 'invitationId');
        db.createObjectStore('media', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const PREFS_KEY = 'ivx-prefs';
  function readPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; } }
  function writePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p || {})); } catch (e) { /* storage blocked */ } }
  model.prefs = readPrefs; // quick, synchronous read of the last saved preferences

  class LocalStore {
    constructor() { this.mode = 'local'; this.dbp = openDB(); this.urlCache = new Map(); }
    // Host preferences (Settings page). Kept in this browser, like the rest of Demo/Local data.
    async getPrefs() { return readPrefs(); }
    async savePrefs(p) { writePrefs(p); return p; }
    async tx(store, mode = 'readonly') { const db = await this.dbp; return db.transaction(store, mode).objectStore(store); }
    async all(store, index, key) { const s = await this.tx(store); return reqP(index ? s.index(index).getAll(key) : s.getAll()); }
    async get(store, id) { const s = await this.tx(store); return reqP(s.get(id)); }
    // resolve only when the transaction has committed, so other tabs see the change immediately
    async write(store, fn) {
      const db = await this.dbp;
      return new Promise((res, rej) => { const tx = db.transaction(store, 'readwrite'); fn(tx.objectStore(store)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Storage write aborted (is the disk full?)')); });
    }
    async put(store, obj) { await this.write(store, (s) => s.put(obj)); return obj; }
    async del(store, id) { return this.write(store, (s) => s.delete(id)); }

    /* auth – local mode has a single device owner */
    async getUser() { return { id: 'local', email: 'This device' }; }
    // roles and the Admin page need Production mode (Supabase); this device's owner is a plain host
    async myAccount() { return { role: 'host', status: 'active', setup: false, local: true }; }

    /* invitations */
    async listInvitations() { return (await this.all('invitations')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
    getInvitation(id) { return this.get('invitations', id); }
    async slugAvailable(slug, exceptId) {
      const hits = await this.all('invitations', 'slug', slug);
      return !hits.some((h) => h.id !== exceptId);
    }
    async saveInvitation(inv) {
      if (inv.slug && !(await this.slugAvailable(inv.slug, inv.id))) throw new Error('That link name is already used by another invitation.');
      inv.updatedAt = new Date().toISOString();
      return this.put('invitations', IX.deepClone(inv));
    }
    async setPassword(inv, pw) {
      inv.settings.passwordProtected = !!pw;
      inv.settings.passwordHash = pw ? await IX.sha256(inv.id + ':' + pw) : '';
      return inv;
    }
    async publish(inv) {
      if (!inv.slug) throw new Error('Choose a link name first.');
      inv.status = 'published';
      inv.publishedAt = inv.publishedAt || new Date().toISOString();
      inv.published = model.snapshotForPublish(inv);
      inv.updateNotice = { show: true, note: '' }; // the note is for this update only
      return this.saveInvitation(inv);
    }
    async unpublish(inv) { inv.status = 'draft'; inv.published = null; return this.saveInvitation(inv); }
    async deleteInvitation(id) {
      const inv = await this.get('invitations', id);
      for (const g of await this.all('guests', 'invitationId', id)) await this.del('guests', g.id);
      for (const r of await this.all('rsvps', 'invitationId', id)) await this.del('rsvps', r.id);
      if (inv) for (const ref of model.mediaRefs(inv)) if (ref.startsWith('idb:')) await this.del('media', ref.slice(4));
      await this.del('invitations', id);
    }
    async duplicateInvitation(id) {
      const src = await this.get('invitations', id);
      const copy = IX.deepClone(src);
      copy.id = IX.uid('inv_');
      copy.slug = '';
      copy.status = 'draft';
      copy.published = null;
      copy.publishedAt = null;
      copy.createdAt = new Date().toISOString();
      Object.values(copy.text).forEach((t) => t.title && (t.title = t.title + ' (copy)'));
      return this.saveInvitation(copy);
    }

    /* media */
    async putMedia(blob, meta = {}) {
      const id = IX.uid('m_');
      await this.put('media', { id, blob, type: blob.type, size: blob.size, name: meta.name || '', createdAt: Date.now() });
      return 'idb:' + id;
    }
    async resolveMedia(ref) {
      if (!ref) return '';
      if (!ref.startsWith('idb:')) return ref;
      if (this.urlCache.has(ref)) return this.urlCache.get(ref);
      const rec = await this.get('media', ref.slice(4));
      if (!rec) return '';
      const url = URL.createObjectURL(rec.blob);
      this.urlCache.set(ref, url);
      return url;
    }
    async deleteMedia(ref) { if (ref && ref.startsWith('idb:')) { await this.del('media', ref.slice(4)); this.urlCache.delete(ref); } }

    /* guests (host's invite list) */
    async listGuests(invId) { return (await this.all('guests', 'invitationId', invId)).sort((a, b) => a.name.localeCompare(b.name)); }
    async saveGuest(g) {
      if (!g.id) { g.id = IX.uid('g_'); g.token = IX.randomToken(16); g.createdAt = new Date().toISOString(); }
      return this.put('guests', g);
    }
    async saveGuests(list) { for (const g of list) await this.saveGuest(g); }
    deleteGuest(id) { return this.del('guests', id); }

    /* RSVPs – host side */
    async listRsvps(invId) { return (await this.all('rsvps', 'invitationId', invId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
    async hostSaveRsvp(r) {
      r.updatedAt = new Date().toISOString();
      if (!r.id) { r.id = IX.uid('r_'); r.ref = IX.confirmationRef(); r.createdAt = r.updatedAt; r.source = 'host'; }
      r.total = (r.adults || 0) + (r.children || 0);
      delete r.clearAnswers;
      return this.put('rsvps', r);
    }
    deleteRsvp(id) { return this.del('rsvps', id); }
    async checkIn(invId, refOrCode, undo = false) {
      const ref = String(refOrCode || '').trim().toUpperCase().split(':').pop();
      const r = (await this.all('rsvps', 'invitationId', invId)).find((x) => x.ref === ref);
      if (!r) return { ok: false, error: 'No RSVP with reference ' + ref + ' for this invitation.' };
      if (!undo && r.checkedInAt) return { ok: true, already: true, rsvp: r };
      r.checkedInAt = undo ? null : new Date().toISOString();
      await this.put('rsvps', r);
      return { ok: true, rsvp: r };
    }

    /* Guest (public) side – mirrors the logic of the SQL functions */
    async _bySlug(slug) { return (await this.all('invitations', 'slug', slug)).find((i) => i.status === 'published' && i.published); }
    async getPublic(slug, { password, guestToken } = {}) {
      const inv = await this._bySlug(slug);
      if (!inv) return { status: 'not_found' };
      const pub = inv.published;
      if (pub.settings.expiresAt && new Date(pub.settings.expiresAt) < new Date()) return { status: 'expired', title: model.txt(pub, pub.defaultLang, 'title') };
      if (inv.settings.passwordProtected) {
        if (!password) return { status: 'password_required' };
        if ((await IX.sha256(inv.id + ':' + password)) !== inv.settings.passwordHash) return { status: 'wrong_password' };
      }
      let guest = null;
      if (guestToken) {
        const g = (await this.all('guests', 'invitationId', inv.id)).find((x) => x.token === guestToken);
        if (g) {
          guest = { name: g.name, phone: g.phone || '', email: g.email || '', allowed: g.allowed || 0 };
          if (!g.openedAt) { g.openedAt = new Date().toISOString(); await this.put('guests', g); }
        }
      }
      return { status: 'ok', invitation: pub, guest };
    }
    async getRsvpByEditToken(slug, editToken) {
      const inv = await this._bySlug(slug);
      if (!inv || !editToken) return null;
      const h = await IX.sha256(editToken);
      const r = (await this.all('rsvps', 'invitationId', inv.id)).find((x) => x.editTokenHash === h);
      return r ? { ...cleanRsvp(r), ref: r.ref, status: r.status } : null;
    }
    async submitRsvp(slug, payload, { password, guestToken, editToken } = {}) {
      const inv = await this._bySlug(slug);
      if (!inv) return { status: 'error', code: 'notFound' };
      const pub = inv.published, s = pub.settings;
      if (inv.settings.passwordProtected && (await IX.sha256(inv.id + ':' + (password || ''))) !== inv.settings.passwordHash) return { status: 'error', code: 'wrongPassword' };
      if (!s.rsvpEnabled) return { status: 'error', code: 'rsvpClosed' };
      if (s.rsvpDeadline && new Date(s.rsvpDeadline + 'T23:59:59') < new Date()) return { status: 'error', code: 'rsvpClosed' };
      if (s.expiresAt && new Date(s.expiresAt) < new Date()) return { status: 'error', code: 'expired' };
      const p = cleanRsvp(payload);
      const vErr = model.validateRsvp(p);
      if (vErr) return { status: 'error', code: vErr };
      if (model.missingAnswer(pub, p)) return { status: 'error', code: 'needAnswer' };
      const all = await this.all('rsvps', 'invitationId', inv.id);
      const guests = await this.all('guests', 'invitationId', inv.id);
      const guest = guestToken ? guests.find((g) => g.token === guestToken) : null;
      let existing = null;
      if (editToken) {
        const h = await IX.sha256(editToken);
        existing = all.find((x) => x.editTokenHash === h);
        if (!existing) return { status: 'error', code: 'notFound' };
      } else {
        const phone = IX.normPhone(p.phone);
        const dup = all.find((x) => (guest && x.guestId === guest.id) || x.phoneNorm === phone);
        if (dup) return { status: 'error', code: 'duplicate' };
      }
      const limit = (guest && guest.allowed) || s.maxPerInvite || 0;
      const heads = p.adults + p.children;
      if (p.status !== 'no' && limit && heads > limit) return { status: 'error', code: 'maxParty', n: limit };
      if (p.status === 'yes' && s.maxGuestsTotal) {
        const used = all.filter((x) => x.status === 'yes' && (!existing || x.id !== existing.id)).reduce((a, x) => a + x.adults + x.children, 0);
        if (used + heads > s.maxGuestsTotal) return { status: 'error', code: 'capacity', n: Math.max(0, s.maxGuestsTotal - used) };
      }
      const now = new Date().toISOString();
      let token = null;
      const rec = existing || { id: IX.uid('r_'), invitationId: inv.id, ref: IX.confirmationRef(), createdAt: now, source: 'guest', guestId: guest ? guest.id : null };
      Object.assign(rec, p, { phoneNorm: IX.normPhone(p.phone), total: p.adults + p.children, updatedAt: now });
      if (!existing) { token = IX.randomToken(24); rec.editTokenHash = await IX.sha256(token); }
      await this.put('rsvps', rec);
      return { status: 'ok', ref: rec.ref, editToken: token || editToken, updated: !!existing };
    }

    /* backup */
    async exportAll() {
      const media = await this.all('media');
      const mediaOut = [];
      for (const m of media) mediaOut.push({ ...m, blob: undefined, dataUrl: await blobToDataURL(m.blob) });
      return { app: 'InviteX', version: 1, exportedAt: new Date().toISOString(), invitations: await this.all('invitations'), guests: await this.all('guests'), rsvps: await this.all('rsvps'), media: mediaOut };
    }
    async importAll(data) {
      if (!data || data.app !== 'InviteX') throw new Error('This is not an InviteX backup file.');
      for (const m of data.media || []) { const blob = await (await fetch(m.dataUrl)).blob(); await this.put('media', { ...m, dataUrl: undefined, blob }); }
      for (const x of data.invitations || []) await this.put('invitations', x);
      for (const x of data.guests || []) await this.put('guests', x);
      for (const x of data.rsvps || []) await this.put('rsvps', x);
    }
    get aiAvailable() { return false; } // AI designs need the online (Supabase) version
    /* Paid sharing campaigns exist only in Production mode. Here sharing is always open and free. */
    async campaignState() { return { billing: false, campaign: { id: 'demo', status: 'sharing', can_share: true, demo: true }, quote: { payment_required: false, free_reason: 'demo' } }; }
    async campaignStart() { return (await this.campaignState()).campaign; }
    async campaignMarkShared() { return null; }
    async campaignAction() { return (await this.campaignState()).campaign; }
    async myCampaigns() { return []; }
    async myPayments() { return []; }
    async sharingQuote() { return null; }
    async payment() { return { status: 'unlocked' }; }
    get aiWriteAvailable() { return false; } // the AI writer needs the online version; the built-in writer is used here
    get aiWriteNote() { return 'AI writing works in the online version. These versions are from InviteX\u2019s built-in writer.'; }
    async wipe() { const db = await this.dbp; db.close(); await reqP(indexedDB.deleteDatabase(DB_NAME)); }
  }
  const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

  model.mediaRefs = (inv) => {
    const m = inv.media || {};
    return [m.cover, m.background, m.logo, m.decor, m.music, m.voice, m.video, ...(m.gallery || []).map((g) => g.ref), ...(inv.hostsList || []).map((h) => h.ref)].filter(Boolean);
  };

  /* ======================= Supabase (production) =======================
   * Requires supabase/schema.sql to be applied. Uses only the public anon key;
   * all authorisation is enforced by Postgres RLS + SECURITY DEFINER RPCs. */
  class SupabaseStore {
    constructor(client) { this.mode = 'supabase'; this.sb = client; this.bucket = CFG.MEDIA_BUCKET || 'invite-media'; }
    _check({ data, error }) { if (error) throw new Error(error.message); return data; }
    // Host preferences are saved on the host's own sign-in account (user metadata), so no table changes are needed.
    async getPrefs() { const { data } = await this.sb.auth.getUser(); const p = (data.user && data.user.user_metadata && data.user.user_metadata.invitex_prefs) || readPrefs(); writePrefs(p); return p; }
    async savePrefs(p) { this._check(await this.sb.auth.updateUser({ data: { invitex_prefs: p } })); writePrefs(p); return p; }
    async getUser() { const { data } = await this.sb.auth.getUser(); return data.user || null; }
    async signIn(email, password) { return this._check(await this.sb.auth.signInWithPassword({ email, password })); }
    async signUp(email, password) { return this._check(await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } })); }
    async magicLink(email) { return this._check(await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } })); }
    async signOut() { await this.sb.auth.signOut(); }

    /* roles + admin (supabase/admin.sql). Every admin_* function checks, inside the
     * database, that the caller is an active admin; the browser cannot skip that. */
    async myAccount() {
      const { data, error } = await this.sb.rpc('my_account');
      if (error) return { role: 'host', status: 'active', setup: !/my_account|PGRST202|does not exist|not find/i.test((error.code || '') + ' ' + error.message), error: error.message };
      return Object.assign({ role: 'host', status: 'active' }, data, { setup: true });
    }
    async admin(fn, args = {}) { return this._check(await this.sb.rpc('admin_' + fn, args)); }
    async call(fn, args = {}) { return this._check(await this.sb.rpc(fn, args)); } // signed-in RPCs (designer marketplace)
    async adminDeleteInvitation(id, ownerId, reason = '') {
      // remove its uploaded photos first (admins may delete any invitation's files), then the invitation
      const dir = `${ownerId}/${id}`;
      const { data: files } = await this.sb.storage.from(this.bucket).list(dir, { limit: 1000 });
      if (files && files.length) await this.sb.storage.from(this.bucket).remove(files.map((f) => `${dir}/${f.name}`));
      return this.admin('delete_invitation', { p_id: id, p_reason: reason });
    }

    _fromRow(row) { return row ? { ...row.data, id: row.id, slug: row.slug || '', status: row.status, published: row.published, publishedAt: row.published_at, updatedAt: row.updated_at, createdAt: row.created_at } : null; }
    async listInvitations() { return this._check(await this.sb.from('invitations').select('*').order('updated_at', { ascending: false })).map((r) => this._fromRow(r)); }
    async getInvitation(id) { return this._fromRow(this._check(await this.sb.from('invitations').select('*').eq('id', id).maybeSingle())); }
    async slugAvailable(slug, exceptId) { return !!this._check(await this.sb.rpc('slug_available', { p_slug: slug, p_except: exceptId && exceptId.length === 36 ? exceptId : null })); }
    async saveInvitation(inv) {
      const user = await this.getUser();
      if (!user) throw new Error('Please sign in.');
      if (!inv.id || inv.id.length !== 36) inv.id = crypto.randomUUID();
      const data = IX.deepClone(inv);
      ['published', 'status', 'slug', 'publishedAt', 'updatedAt', 'createdAt'].forEach((k) => delete data[k]);
      delete data.settings.passwordHash;
      const row = {
        id: inv.id, owner_id: user.id, slug: inv.slug || null, status: inv.status, data, published: inv.published || null, published_at: inv.publishedAt || null,
        rsvp_enabled: inv.settings.rsvpEnabled, rsvp_deadline: inv.settings.rsvpDeadline || null, expires_at: inv.settings.expiresAt || null,
        max_total: inv.settings.maxGuestsTotal || 0, max_per_invite: inv.settings.maxPerInvite || 0,
      };
      const res = await this.sb.from('invitations').upsert(row).select('*').single();
      if (res.error && /duplicate key.*slug/i.test(res.error.message)) throw new Error('That link name is already used by another invitation.');
      return this._fromRow(this._check(res));
    }
    async setPassword(inv, pw) {
      inv.settings.passwordProtected = !!pw;
      if (inv.id && inv.id.length === 36) this._check(await this.sb.rpc('set_invitation_password', { p_id: inv.id, p_password: pw || null }));
      return inv;
    }
    async publish(inv) {
      inv.status = 'published';
      inv.publishedAt = inv.publishedAt || new Date().toISOString();
      inv.published = model.snapshotForPublish(inv);
      inv.updateNotice = { show: true, note: '' }; // the note is for this update only
      return this.saveInvitation(inv);
    }
    async unpublish(inv) { inv.status = 'draft'; inv.published = null; return this.saveInvitation(inv); }
    async deleteInvitation(id) {
      const user = await this.getUser();
      const list = this._check(await this.sb.storage.from(this.bucket).list(`${user.id}/${id}`));
      if (list && list.length) await this.sb.storage.from(this.bucket).remove(list.map((f) => `${user.id}/${id}/${f.name}`));
      this._check(await this.sb.from('invitations').delete().eq('id', id)); // guests & rsvps cascade
    }
    async duplicateInvitation(id) {
      const src = await this.getInvitation(id);
      const copy = IX.deepClone(src);
      copy.id = crypto.randomUUID(); copy.slug = ''; copy.status = 'draft'; copy.published = null; copy.publishedAt = null;
      Object.values(copy.text).forEach((t) => t.title && (t.title += ' (copy)'));
      return this.saveInvitation(copy);
    }
    async putMedia(blob, meta = {}) {
      const user = await this.getUser();
      const ext = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'audio/mpeg': 'mp3', 'video/mp4': 'mp4' }[blob.type] || 'bin';
      const path = `${user.id}/${meta.invitationId || 'misc'}/${IX.uid('m_')}.${ext}`;
      this._check(await this.sb.storage.from(this.bucket).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' }));
      return this.sb.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
    }
    async resolveMedia(ref) { return ref || ''; }
    async deleteMedia(ref) {
      const m = String(ref || '').match(/\/object\/public\/[^/]+\/(.+)$/);
      if (m) await this.sb.storage.from(this.bucket).remove([decodeURIComponent(m[1])]);
    }
    _g(r) { return { id: r.id, invitationId: r.invitation_id, name: r.name, phone: r.phone || '', email: r.email || '', allowed: r.allowed || 0, token: r.token, sentAt: r.sent_at, remindedAt: r.reminded_at, openedAt: r.opened_at, notes: r.notes || '', group: r.group_name || '' }; }
    async listGuests(invId) { return this._check(await this.sb.from('guests').select('*').eq('invitation_id', invId).order('name')).map((r) => this._g(r)); }
    async saveGuest(g) {
      const row = { invitation_id: g.invitationId, name: g.name, phone: g.phone || null, email: g.email || null, allowed: g.allowed || 0, sent_at: g.sentAt || null, reminded_at: g.remindedAt || null, notes: g.notes || '', group_name: g.group || '' };
      if (g.id) row.id = g.id;
      return this._g(this._check(await this.sb.from('guests').upsert(row).select('*').single()));
    }
    async saveGuests(list) {
      const rows = list.map((g) => ({ invitation_id: g.invitationId, name: g.name, phone: g.phone || null, email: g.email || null, allowed: g.allowed || 0 }));
      for (let i = 0; i < rows.length; i += 200) this._check(await this.sb.from('guests').insert(rows.slice(i, i + 200)));
    }
    async deleteGuest(id) { this._check(await this.sb.from('guests').delete().eq('id', id)); }
    _r(r) { return { id: r.id, invitationId: r.invitation_id, guestId: r.guest_id, ref: r.ref, name: r.name, phone: r.phone, email: r.email || '', status: r.status, adults: r.adults, children: r.children, total: r.adults + r.children, extraNames: r.extra_names || '', food: r.food || '', requirements: r.requirements || '', message: r.message || '', eventIds: r.event_ids || [], consent: r.consent, lang: r.lang, checkedInAt: r.checked_in_at, createdAt: r.created_at, updatedAt: r.updated_at, source: r.source, answers: r.answers || {} }; }
    async listRsvps(invId) { return this._check(await this.sb.from('rsvps').select('*').eq('invitation_id', invId).order('updated_at', { ascending: false })).map((r) => this._r(r)); }
    async hostSaveRsvp(r) {
      const row = { invitation_id: r.invitationId, guest_id: r.guestId || null, name: r.name, phone: r.phone, email: r.email || null, status: r.status, adults: r.adults || 0, children: r.children || 0, extra_names: r.extraNames, food: r.food, requirements: r.requirements, message: r.message, event_ids: r.eventIds || [], consent: true, source: r.source || 'host' };
      // answers column: supabase/schema.sql (v2.4). Sent only when there is something to save or clear,
      // so host edits keep working on a database that has not been updated yet.
      if (r.answers && (Object.keys(r.answers).length || r.clearAnswers)) row.answers = r.answers;
      if (r.id) row.id = r.id; else row.ref = IX.confirmationRef(); // ref is required for new rows
      return this._r(this._check(await this.sb.from('rsvps').upsert(row).select('*').single()));
    }
    async deleteRsvp(id) { this._check(await this.sb.from('rsvps').delete().eq('id', id)); }
    async checkIn(invId, refOrCode, undo = false) {
      const ref = String(refOrCode || '').trim().toUpperCase().split(':').pop();
      const rows = this._check(await this.sb.from('rsvps').select('*').eq('invitation_id', invId).eq('ref', ref));
      if (!rows.length) return { ok: false, error: 'No RSVP with reference ' + ref + ' for this invitation.' };
      const r = this._r(rows[0]);
      if (!undo && r.checkedInAt) return { ok: true, already: true, rsvp: r };
      const upd = this._check(await this.sb.from('rsvps').update({ checked_in_at: undo ? null : new Date().toISOString() }).eq('id', r.id).select('*').single());
      return { ok: true, rsvp: this._r(upd) };
    }
    async getPublic(slug, { password, guestToken } = {}) {
      return this._check(await this.sb.rpc('get_public_invitation', { p_slug: slug, p_password: password || null, p_guest_token: guestToken || null }));
    }
    async getRsvpByEditToken(slug, editToken) {
      return this._check(await this.sb.rpc('get_rsvp_by_edit_token', { p_slug: slug, p_edit_token: editToken }));
    }
    async submitRsvp(slug, payload, { password, guestToken, editToken } = {}) {
      const p = cleanRsvp(payload);
      const vErr = model.validateRsvp(p);
      if (vErr) return { status: 'error', code: vErr };
      return this._check(await this.sb.rpc('submit_rsvp', { p_slug: slug, p_payload: p, p_password: password || null, p_guest_token: guestToken || null, p_edit_token: editToken || null }));
    }
    async checkConnection() {
      const { error } = await this.sb.rpc('slug_available', { p_slug: 'connection-check', p_except: null });
      if (error && /function .* does not exist|Could not find the function/i.test(error.message)) return { ok: false, msg: 'Connected to Supabase, but the database setup (supabase/schema.sql) has not been run yet.' };
      if (error) return { ok: false, msg: error.message };
      return { ok: true, msg: 'Connected. The database is set up correctly.' };
    }
    async exportAll() { throw new Error('Use the Supabase dashboard (Database > Backups) to back up production data.'); }

    /* AI card designs (server step: supabase/functions/generate-card-art) */
    get aiAvailable() { return true; }

    /* Paid sharing campaigns (supabase/billing.sql + functions/sharing-campaign). The database decides
     * who pays and what; these only ask. Before billing.sql is installed, sharing stays open. */
    _noBilling(error) { return error && /campaign_state|my_sharing_quote|PGRST202|does not exist|Could not find the function/i.test((error.code || '') + ' ' + error.message); }
    async campaignState(invitationId) {
      const { data, error } = await this.sb.rpc('campaign_state', { p_invitation: invitationId });
      if (error && this._noBilling(error)) return { billing: false, campaign: { id: 'none', status: 'sharing', can_share: true }, quote: { payment_required: false, free_reason: 'not_installed' } };
      if (error) throw new Error(error.message);
      return Object.assign({ billing: true }, data);
    }
    async campaignStart(invitationId, requestId) { return this._check(await this.sb.rpc('campaign_start', { p_invitation: invitationId, p_request_id: requestId || null })); }
    async campaignMarkShared(campaignId, guestId, channel, action = 'share') {
      const { data, error } = await this.sb.rpc('campaign_mark_shared', { p_campaign: campaignId, p_guest: guestId || null, p_channel: channel, p_action: action });
      if (error) console.warn('share not recorded:', error.message);
      return error ? null : data;
    }
    // action: complete | reopen | cancel
    async campaignAction(action, campaignId) { return this._check(await this.sb.rpc('campaign_' + action, { p_campaign: campaignId })); }
    async myCampaigns() { const { data, error } = await this.sb.rpc('my_campaigns', { p_invitation: null }); if (error && this._noBilling(error)) return []; return this._check({ data, error }); }
    async myPayments() { const { data, error } = await this.sb.rpc('my_payments'); if (error && this._noBilling(error)) return []; return this._check({ data, error }); }
    async sharingQuote() { const { data, error } = await this.sb.rpc('my_sharing_quote'); if (error && this._noBilling(error)) return null; return this._check({ data, error }); }
    // the payment server step: order | verify | status. Throws with .code.
    async payment(action, body = {}) {
      const { data } = await this.sb.auth.getSession();
      const token = data.session && data.session.access_token;
      if (!token) throw Object.assign(new Error('Please sign in again.'), { code: 'auth' });
      let res;
      try {
        res = await fetch(`${CFG.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/sharing-campaign`, {
          method: 'POST', headers: { 'content-type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
          body: JSON.stringify(Object.assign({ action }, body)),
        });
      } catch (e) { throw Object.assign(new Error('Could not reach the payment server. Check your internet connection and try again.'), { code: 'network' }); }
      const j = await res.json().catch(() => ({}));
      if (res.status === 404 && !j.error) throw Object.assign(new Error('Payments are not switched on yet.'), { code: 'not_configured' });
      if (!res.ok) throw Object.assign(new Error(j.error || 'The payment step had a problem. Please try again.'), { code: j.code || 'error' });
      return j;
    }
    async aiCredits() { return this._check(await this.sb.rpc('my_ai_credits')); }
    async aiGenerate({ style, colors, category, words }) {
      const { data } = await this.sb.auth.getSession();
      const token = data.session && data.session.access_token;
      if (!token) throw Object.assign(new Error('Please sign in again to use AI designs.'), { code: 'auth' });
      let res;
      try {
        res = await fetch(`${CFG.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/generate-card-art`, {
          method: 'POST', headers: { 'content-type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
          body: JSON.stringify({ style, colors, category, words }),
        });
      } catch (e) { throw Object.assign(new Error('Could not reach the AI designer. Check your internet connection and try again.'), { code: 'network' }); }
      const j = await res.json().catch(() => ({}));
      if (res.status === 404) throw Object.assign(new Error('The AI designer is not switched on yet (the server step has not been deployed).'), { code: 'not_configured' });
      if (!res.ok) throw Object.assign(new Error(j.error || 'The AI designer had a problem. Please try again.'), { code: j.code || 'error', used: j.used, limit: j.limit });
      return j;
    }
    /* AI invitation writer (server step: supabase/functions/write-invitation-copy).
     * Throws with .code: auth | limit | not_configured | network | timeout | error. The studio then uses the built-in writer. */
    get aiWriteAvailable() { return !this._aiWriteOff; }
    async aiWrite(payload) {
      const { data } = await this.sb.auth.getSession();
      const token = data.session && data.session.access_token;
      if (!token) throw Object.assign(new Error('Please sign in again to use the AI writer.'), { code: 'auth' });
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 60000);
      let res;
      try {
        res = await fetch(`${CFG.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/write-invitation-copy`, {
          method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', apikey: CFG.SUPABASE_ANON_KEY, authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } catch (e) { throw Object.assign(new Error(e.name === 'AbortError' ? 'The AI writer took too long.' : 'Could not reach the AI writer.'), { code: e.name === 'AbortError' ? 'timeout' : 'network' }); }
      finally { clearTimeout(timer); }
      const j = await res.json().catch(() => ({}));
      if (res.status === 404 || j.code === 'not_configured') { this._aiWriteOff = true; throw Object.assign(new Error('The AI writer is not switched on yet.'), { code: 'not_configured' }); }
      if (!res.ok) throw Object.assign(new Error(j.error || 'The AI writer had a problem.'), { code: j.code || 'error', left: j.left, limit: j.limit });
      return j;
    }
    // the user's earlier AI designs (newest first), so paid-for paintings are never lost
    async aiRecent(limit = 12) {
      const user = await this.getUser();
      const { data, error } = await this.sb.storage.from(this.bucket).list(`${user.id}/ai`, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
      if (error || !data) return [];
      return data.filter((f) => /\.(png|jpe?g|webp)$/i.test(f.name)).slice(0, limit)
        .map((f) => this.sb.storage.from(this.bucket).getPublicUrl(`${user.id}/ai/${f.name}`).data.publicUrl);
    }
  }

  /* ======================= Bootstrap ======================= */
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src)); document.head.appendChild(s); });
  IX.model = model;
  IX.isProduction = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  window.IXStore = (async () => {
    if (!IX.isProduction) return new LocalStore();
    if (/service_role/.test(atobSafe(CFG.SUPABASE_ANON_KEY.split('.')[1] || ''))) {
      alert('Security error: a Supabase service_role key was placed in js/config.js. Remove it immediately and use the anon public key.');
      throw new Error('service_role key in frontend');
    }
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
    return new SupabaseStore(window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY));
  })();
  function atobSafe(s) { try { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); } catch (e) { return ''; } }
})();
