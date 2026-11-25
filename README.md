# InviteX – Digital Invitation Creator & RSVP Platform

Create an invitation in minutes, share it in seconds, and manage the whole event from one dashboard.

InviteX is a mobile-first web app written in plain **HTML, CSS and vanilla JavaScript** (no build step, no framework). It has two separate experiences:

| Experience | Entry point | Who uses it |
|---|---|---|
| **Creator / Host dashboard** | `index.html` | The person organising the event |
| **Guest invitation microsite** | `invite.html?i=<link-name>` | Guests, usually opening a WhatsApp link on a phone |

## Quick start (Demo / Local mode, 1 minute)

```bash
cd invitex
python3 -m http.server 8080        # or: npx serve .
# open http://localhost:8080
```

Click **Load 4 sample invitations** (Himachali Dham, Wedding, Birthday, Corporate conference) or **Create invitation**.

> Demo/Local mode stores everything in the browser's IndexedDB. The app says so on every screen. Guest links only work in the same browser, and RSVPs from other people's phones are **not** collected. To receive real RSVPs, set up Production mode (Supabase). It takes about 10 minutes: see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Features

- **14 categories**: wedding, engagement/reception, birthday, anniversary, housewarming, puja, festival/family gathering, corporate meeting, conference, product launch, school/college, retirement/farewell, community, custom. There are **14 themed designs** (each with its own illustrations, fonts and 2–3 colour palettes) plus a blank design. Portrait, landscape and square layouts.
- **3-step editor** with a live phone/desktop preview: Design → Fill your card → Share. Step 1 offers three clear ways to design the card: a gallery of ready designs, upload your own design, or design with AI. Autosaves drafts.
- **Design studio**: ready designs grouped by occasion (wedding, engagement, reception, birthday, anniversary, housewarming, religious, festivals, family gatherings, corporate, conferences, launches, school & college, farewell, community), each showing its style and colour choices; *Describe the card you want* finds the closest designs and colours from a few words and can hand them to the AI painter; three font pairings per design; undo / redo (buttons, Ctrl+Z, Ctrl+Shift+Z) for every change, including bringing back a removed picture.
- **✨ Design with AI** (optional, online version): pick a ready style (Royal, Floral, Temple, Minimal, Mehndi, Pichwai, Birthday, Corporate) and colours, and AI paints 4 card backgrounds to choose from. 3 free tries per user; the AI key stays on the server. Setup: [docs/AI_DESIGNS_SETUP.md](docs/AI_DESIGNS_SETUP.md).
- **Media**: drag-and-drop upload, crop/reposition/zoom/rotate, automatic resize and WebP/JPEG compression, replace/delete/reorder, host/couple/family photos with names and roles, gallery, background, logo, background music, voice message and video. Files are checked by their actual content, not just the extension.
- **Multiple events** per invitation (Mehendi, Haldi, Wedding, Reception…), each with its own date, time, venue, dress code and Maps link. Time-zone aware.
- **English, हिन्दी and ਪੰਜਾਬੀ** with a language switch on the invitation. The host writes the text for each language; nothing is machine-translated. Guest UI labels are hand-written in all three languages.
- **Writing studio** (✦ Write my wording): 3–5 complete versions in English, हिन्दी or ਪੰਜਾਬੀ in 12 styles and 3 lengths; per-line ↻ new wording and an **Aa** menu (Shorter, Longer, More emotional, More formal, More personal, Proofread); hosts can add who is inviting, a memory and one key message, which are used word for word; warnings when a generic word repeats. Nothing changes on the card until you press *Use*. Details: [docs/COPY_STUDIO.md](docs/COPY_STUDIO.md).
- **Rich-text message editor** and a **message assistant** with 7 styles (traditional, royal, modern, formal, friendly, religious, corporate). It never replaces your text without confirmation.
- **Guest microsite**: animated opening (doors, curtain, envelope or fade), personalised greeting, welcome, hosts, message, countdown, schedule, venue with embedded map and directions, highlights (menu, agenda, speakers), gallery with lightbox, audio/video, RSVP, instructions and a thank-you section. The host can switch each section on or off and reorder them. Guests control the music.
- **RSVP**: yes/no/maybe, adults and children counted separately, which events they will attend, additional names, food preference, special requirements, a message to the host and a consent checkbox. After replying, guests get a confirmation reference, a check-in QR code and a private edit link. Duplicate replies are blocked by personal invite and by mobile number, and double-tapping submit cannot send twice. There are per-guest and total capacity limits and an RSVP deadline.
- **Home dashboard**: a welcome with your next event in full (countdown, venue, how many replied and are coming, Share / Guests / Preview); five numbers that matter (invitations, people coming, awaiting reply, response rate, events in the next 30 days); occasion shortcuts; invitation cards with six quick actions (Edit, Preview, Share, Guests, Analytics, Duplicate) and a reply bar; *Guests and replies* across all invitations (confirmed, not sure, declined, pending, expected attendees) with event-wise tracking; *Needs attention* (drafts close to the date, guests not replied or not sent, places running out) with a button for each; recent activity you can act on (who replied, who was invited, who opened without replying). Every number comes from your real guest lists and replies.
- **Guest reply (V2)**: one tap stays one tap (Yes / Not sure yet / Can't come). An optional *Add details* panel collects children, which events, food, other names, special needs and a message, and opens by itself when the guest changes an earlier reply. A floating *Reply* button on phones, and Save the date / Get directions right after a yes.
- **Sharing centre (V2)**: honest sharing status (on the list, WhatsApp/email opened by you, link opened, replied, never "delivered"), message language with hand-written Hindi and Punjabi templates, guest list search and filters (not sent, sent, opened, replied).
- **RSVP dashboard**: KPIs (confirmed attendees, adults, children, yes/no/maybe, pending, response and attendance rate, places left), a donut chart, event-wise attendance, food preferences, search and filter, editing responses, CSV/Excel export (UTF-8 with BOM so Hindi and Punjabi display correctly), print and a guest-list download.
- **Sharing**: personalised WhatsApp click-to-chat links per guest, a general WhatsApp share, email, copy link, native share sheet, a QR code (PNG), a 1080×1350 image card and print/PDF. The app records "WhatsApp opened", never "delivered".
- **Reminders** for pending guests (editable template), **check-in** by QR scan (where the browser supports `BarcodeDetector`) or by reference, **duplicate invitation**, **edit after publishing** (changes stay as a draft until you press *Update published invitation*), **expiry date**, **password protection**, **custom link name**, **delete invitation and all its data**, and JSON backup/restore in local mode.

## Project structure

```
index.html            Host app (creator, dashboard)
invite.html           Guest invitation microsite
css/app.css           Host UI styles
css/invite.css        Invitation styles (themes via CSS variables, print styles)
js/config.js          Mode switch: Supabase URL + anon key (empty = Demo/Local)
js/util.js            Escaping, HTML sanitiser, time zones, ICS / Google Calendar, Maps, WhatsApp, CSV, image compression, QR
js/i18n.js            Guest UI labels in English / Hindi / Punjabi
js/themes.js          Categories, themes, SVG illustration motifs, message assistant, sample art
js/store.js           Data model + LocalStore (IndexedDB) + SupabaseStore (production) with one shared API
js/media.js           Upload validation, compression, crop/reposition/rotate tool
js/app.js             Router, modals, settings, login, help
js/home.js            Home dashboard (#/) and quick-create (#/new/<occasion>)
js/gallery.js         Design gallery: occasion tabs, "describe your card" matcher, font pairings
js/wizard.js          6-step creation wizard with live preview
js/dashboard.js       RSVP dashboard, guests & reminders, sharing, image card, check-in
js/invite.js          Guest microsite renderer and RSVP form
js/samples.js         The 4 sample invitations
js/vendor/qrcode.js   QR generator (qrcode-generator 1.4.4, MIT, Kazuhiko Arase)
supabase/schema.sql   Tables, RLS policies, guest RPC API, storage bucket & policies
tests/e2e.js          Playwright end-to-end test of all 13 required journeys
tests/copy-*.{mjs,js} Writing studio tests: built-in writer, AI server step, studio in the browser
js/copy/              Writing studio: built-in writer (engine + EN/HI/PA phrase banks) and studio screen
supabase/functions/write-invitation-copy/  Server step for the optional AI writer
tests/schema-test.sql SQL test of RLS + RPCs (run against Postgres with tests/supabase-stubs.sql)
docs/                 User manual, deployment guide, test report, screenshots
```

## Documentation

- [User manual](docs/USER_MANUAL.md): for hosts, with no technical knowledge needed
- [Deployment & Supabase setup](docs/DEPLOYMENT.md)
- [Test report](docs/TEST_REPORT.md), including known limitations
- [Writing studio and AI writer setup](docs/COPY_STUDIO.md)
