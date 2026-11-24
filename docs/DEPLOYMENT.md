# Deployment & Production Setup

InviteX is a static site. Any static host works: Netlify, Vercel, Cloudflare Pages, GitHub Pages, Firebase Hosting, S3, or plain Nginx/Apache. There is no build step.

## 1. Demo / Local mode (no backend)

Upload the folder as it is. Leave `SUPABASE_URL` empty in `js/config.js`.

- Data lives in each visitor's browser (IndexedDB).
- Good for designing, previewing, printing, image/PDF export and testing the full guest journey **on the same device**.
- Guests on other phones **cannot** open the link or RSVP. The app says this clearly on the host screens, the share screen and the guest "not found" page.

Opening `index.html` straight from the file system (`file://`) is not supported because browsers restrict IndexedDB and `postMessage` there. Use any local web server, for example `python3 -m http.server`.

## 2. Production mode (Supabase)

### 2.1 Create the project
1. Create a free project at https://supabase.com.
2. **SQL Editor → New query**: paste the whole of `supabase/schema.sql` and run it. This creates:
   - tables `invitations`, `invitation_secrets`, `guests`, `rsvps`
   - **Row Level Security**: hosts can only read and change their own invitations, guests and RSVPs. Anonymous visitors have **no** table access.
   - a guest API made of `SECURITY DEFINER` functions: `get_public_invitation`, `submit_rsvp`, `get_rsvp_by_edit_token`. These check the published status, expiry, password (bcrypt), RSVP deadline, per-guest and total capacity, and duplicates, and they return only safe fields. Guest phone numbers are never returned to guests.
   - host helpers `set_invitation_password` and `slug_available`
   - the public storage bucket `invite-media` (images, MP3 and MP4 only, 40 MB limit). Hosts can only write inside their own `<user-id>/` folder.
3. **Authentication → Providers**: keep Email enabled. Optionally turn off "Confirm email" while testing.
4. **Authentication → URL configuration**: set the *Site URL* to your deployed address, for example `https://invites.example.com/`.

### 2.2 Configure the frontend
Edit `js/config.js`:
```js
SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
SUPABASE_ANON_KEY: 'eyJ...',   // Project Settings → API → "anon public"
PUBLIC_BASE_URL: 'https://invites.example.com/', // optional
```
**Never** put the `service_role` key in the frontend. The app refuses to start if it detects one. The anon key is designed to be public, and security comes from RLS and the functions above.

### 2.3 Deploy
- **Netlify / Cloudflare Pages / Vercel**: drag-and-drop the folder, or connect the repository with no build command and the root folder as the publish directory.
- **GitHub Pages**: push the folder and enable Pages on the branch.
- Serve over **HTTPS** (needed for clipboard, camera check-in and the native share sheet).

Recommended response headers:
```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; media-src 'self' blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co; frame-src https://maps.google.com https://www.google.com
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
```

### 2.4 AI card designs (optional)
The "✨ Or let AI paint your card" option in step 1 needs an image-AI key and the `generate-card-art` Edge Function. Follow [AI_DESIGNS_SETUP.md](AI_DESIGNS_SETUP.md). Without it, the rest of the app works normally and the AI option shows a short "not switched on yet" message when used.

### 2.5 How it behaves in production
- Hosts sign in (email + password, or a magic link) on `index.html`.
- Published invitations are readable by anyone with the link through `get_public_invitation`. Drafts are invisible.
- RSVPs from any device are stored in `rsvps`. The dashboard refreshes every 30 seconds and whenever the tab regains focus.
- Uploaded media go to Supabase Storage (public URLs). Deleting an invitation removes its rows (cascade) and its storage folder.

### 2.6 Hardening checklist (recommended before a large launch)
- Turn on Supabase **rate limiting / captcha (hCaptcha or Turnstile)** for `submit_rsvp`, for example by calling it through an Edge Function that verifies a captcha token. Not included.
- Turn on database **backups** (paid plans) or schedule `pg_dump`.
- Review data retention: delete invitations after the event to remove guest personal data.
- Optional: plug a cloud AI writer into the message assistant through a Supabase Edge Function that holds the AI API key server-side. The built-in assistant uses offline templates and needs no key.

## 3. Firebase alternative
The data layer is isolated in `js/store.js`. A `FirebaseStore` class with the same methods (`listInvitations`, `saveInvitation`, `publish`, `getPublic`, `submitRsvp`…) could replace `SupabaseStore`, with Cloud Functions doing the validation in `submit_rsvp`. It is not included; Supabase is the supported production backend.

## 4. Running the tests
```bash
python3 -m http.server 8765 &          # from the invitex folder
npm i playwright && node tests/e2e.js  # writes screenshots + results to tests/e2e-output
# SQL tests (local Postgres):
psql -f tests/supabase-stubs.sql && psql -d ivx -c 'create role service_role nologin' && psql -d ivx -f supabase/schema.sql && psql -d ivx -f tests/schema-test.sql && psql -d ivx -f tests/ai-credits-test.sql
# AI designs: server step and editor picker
node tests/ai-function-test.mjs && node tests/ai-design-e2e.js
```
