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
   - Then, for the in-app **Admin page**, run `supabase/admin.sql` the same way and make yourself admin. The steps are in the user manual, Part 3.1.
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

### WhatsApp link previews (Cloudflare Pages)
When a host shares `invite.html?i=<link name>` on WhatsApp (or Facebook, Telegram, X, Slack, LinkedIn), the preview shows that invitation's own title, occasion, date, time, venue and card picture, instead of a general "You're Invited". This is done by `functions/_middleware.js`, a Cloudflare Pages Function that only answers those preview robots. Guests opening the link get the page exactly as before.

- Nothing to set up. It reads the Supabase address and publishable key from `js/config.js`. To use other values, add `SUPABASE_URL` and `SUPABASE_ANON_KEY` under Cloudflare → your Pages project → **Settings → Variables and Secrets**.
- `_routes.json` limits the function to `/invite` and `/invite.html`, so other pages don't use up the free function allowance.
- The site must be deployed **from the Git repository** (Cloudflare → Workers & Pages → your project → connected to GitHub), with no build command and the root folder as the output. The dashboard's drag-and-drop upload does not run the `functions` folder.
- Password-protected invitations, and invitations not shared yet, show a general preview with no details. Calligraphy cards and cards with no picture use `img/og-invite.jpg`.
- To check one: open `https://<your site>/invite.html?i=<link name>&og=1` and use **View page source**, or paste the link into https://developers.facebook.com/tools/debug/ . WhatsApp remembers a preview for a while, so a link shared before this change can show the old preview. Adding `&v=2` to the link gives a fresh one.
- Other hosts (Netlify, Vercel) would need their own version of this function. GitHub Pages cannot do it.

Recommended response headers:
```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co; media-src 'self' blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co; frame-src https://maps.google.com https://www.google.com
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
```

### 2.4 AI card designs (optional)
The "✨ Or let AI paint your card" option in step 1 needs an image-AI key and the `generate-card-art` Edge Function. Follow [AI_DESIGNS_SETUP.md](AI_DESIGNS_SETUP.md). Without it, the rest of the app works normally and the AI option shows a short "not switched on yet" message when used.

### 2.4b Paid sharing (Razorpay UPI)
Hosts can be asked to pay once by UPI before sharing an invitation. Setup in test mode: [PAYMENTS_SETUP.md](PAYMENTS_SETUP.md) (`supabase/billing.sql`, two Edge Functions, Razorpay test keys as Supabase secrets, webhook). Real money: [PAYMENTS_GO_LIVE.md](PAYMENTS_GO_LIVE.md). Run order for the SQL files: `schema.sql`, `admin.sql`, `ai-designs.sql`, `billing.sql`; re-run `billing.sql` after re-running either of the first two. The CSP above needs `https://checkout.razorpay.com` in `script-src` and `frame-src`, and `https://api.razorpay.com` in `connect-src`, when payments are on.

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

### Designer marketplace (pilot, India only)
Run `supabase/marketplace.sql` after `billing.sql`. It adds designer applications, designs and their review, template licences, the earnings ledger and payouts, and three storage buckets (`designer-previews`, `designer-art`, `designer-source`). Admins then see **Designers** and **Design review** on the Admin page. Safe to run again. Designers apply and upload at `#/designer` (the Help page links to it).

Hosts see **Designer cards** in step 1 of the editor (online version only). They can try any design free on their card, with a watermarked preview; at **Publish** they pay its price once by UPI through Razorpay, and the full artwork replaces the preview. The payment runs through the same `sharing-campaign` Edge Function and `razorpay-webhook` as paid sharing (same keys, same test/live switch), so after running `marketplace.sql` **deploy both functions again**. The database refuses to publish a designer card the host has not bought. A designer's sales link (`index.html#/new?designer=…&ref=…`) pays them the referral share.

### Updating to v2.4
Re-run `supabase/schema.sql` (adds the `rsvps.answers` column and updates `submit_rsvp`) and `supabase/admin.sql` (time to first invitation), then re-run `billing.sql` as usual. Both files are safe to run again. Until `schema.sql` is re-run, guests can still reply, but required custom questions are only checked in the browser and answers are not saved.

## 4. Running the tests
```bash
python3 -m http.server 8765 &          # from the invitex folder
npm i playwright && node tests/e2e.js  # writes screenshots + results to tests/e2e-output
# SQL tests (local Postgres):
psql -f tests/supabase-stubs.sql && psql -d ivx -c 'create role service_role nologin' && psql -d ivx -f supabase/schema.sql && psql -d ivx -f tests/schema-test.sql && psql -d ivx -f tests/ai-credits-test.sql
# Admin page: database rules, then the page itself (needs a local Postgres you can reach with psql)
psql -d ivx -f supabase/admin.sql -f tests/admin-test.sql
psql -f tests/supabase-stubs.sql && psql -d ivx -c 'create role service_role nologin' && psql -d ivx -f supabase/schema.sql -f supabase/admin.sql -f tests/admin-seed.sql && PGDATABASE=ivx node tests/admin-e2e.js
# v2.4: custom RSVP questions and time to first invitation (after schema-test.sql / admin-test.sql), then the browser checks
psql -d ivx -f tests/rsvp-questions-test.sql && psql -d ivx -f tests/ttfi-test.sql && node tests/v24-e2e.js
# Designer marketplace: database checks, then the admin screens, then the designer page (fresh database before each browser test)
sh tests/run-marketplace-sql.sh && psql -d ivx -f tests/admin-seed.sql && PGDATABASE=ivx node tests/marketplace-admin-e2e.js
sh tests/run-marketplace-sql.sh && psql -d ivx -f tests/admin-seed.sql && PGDATABASE=ivx node tests/designer-e2e.js
# Buying a design: Edge Functions with a fake Razorpay, then the host's side in the browser (each builds its own database)
node tests/design-purchase-function-test.mjs && node tests/designer-card-e2e.mjs
# WhatsApp link previews (Cloudflare Pages Function, fake Supabase)
node tests/og-preview-test.mjs
# Paid sharing: database rules, Edge Functions, browser (fake Razorpay, no money)
sh tests/run-billing-sql.sh && node tests/payments-function-test.mjs && node tests/billing-e2e.mjs
# AI designs: server step and editor picker
node tests/ai-function-test.mjs && node tests/ai-design-e2e.js
# Calligraphy Studio (no server needed; see docs/CALLIGRAPHY_STUDIO.md)
node tests/calligraphy-e2e.js && node tests/calligraphy-pages-e2e.js && node tests/calligraphy-export-e2e.js
```
Calligraphy downloads load `js/vendor/harfbuzz/harfbuzz.wasm`. Most hosts already serve `.wasm` files as `application/wasm`; if yours does not, add that type (the downloads still work without it, a little slower).
