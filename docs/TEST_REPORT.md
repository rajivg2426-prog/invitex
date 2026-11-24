# InviteX Test Report

**Date:** 22 November 2026  
**Build:** InviteX 1.0 (vanilla HTML/CSS/JS)  
**Environment:** Headless Chromium (Playwright) on Linux. Desktop viewport 1366×900, mobile viewport 390×844, and the *iPhone 13* device profile. PostgreSQL 16 for the database schema.  
**Mode tested:** Demo/Local mode (IndexedDB), end to end. Production SQL was tested on PostgreSQL. The Supabase JS adapter was **not** tested against a live Supabase project (see §4).

Automated script: `tests/e2e.js` (Playwright). Final run: **24 / 24 checks passed, 0 JavaScript errors** in the host and guest pages.

## 1. Required journeys

| # | Journey | Result | Evidence |
|---|---|---|---|
| 1 | Create a wedding invitation through the wizard: choose category and palette, upload a cover photo (crop dialog → Apply), drag 2 gallery photos, enter title, hosts, 2 events (Wedding + Reception, "same venue as previous"), write a message, publish with a custom link | ✅ Pass | Published, link `invite.html?i=kabir-ananya` |
| 1b | Message assistant adds a "Royal" suggestion *below* the user's own text without overwriting it | ✅ Pass | Both texts present |
| 2 | Open on a 390 px phone: opening animation, title, 2 events, 2 gallery photos, **no horizontal scrolling**. Lightbox opens and closes with Esc | ✅ Pass | `screenshots/t2-hero.png`, `t2-3-schedule.png` |
| 3 | Share on WhatsApp: personal-guest button opens `https://wa.me/919876543210?text=Dear Rakesh Verma, We are delighted to invite you to Kabir & Ananya. Date: … Time: … Venue: … <personal link> …` | ✅ Pass | The status reads "WhatsApp/email opened", never "delivered" |
| 4 | Guest opens the personal link: greeted "Dear Rakesh Verma", name prefilled, confirms **2 adults + 1 child = 3**, chooses vegetarian. Submit was **double-clicked** on purpose. Thank-you, reference `IVX-…`, QR code and private edit link shown | ✅ Pass | `screenshots/t4-thanks.png` |
| 5 | Host dashboard shows **3 confirmed attendees** (2 adults, 1 child), and only **1** record despite the double-click | ✅ Pass | `screenshots/t5-dashboard.png` |
| 6 | A second guest declines through the general link. Dashboard: Declined 1, Total responses 2, confirmed attendees **still 3** | ✅ Pass | |
| 7 | Export CSV/Excel: file has a UTF-8 BOM, both guests, `Attending,2,1,3`, `Declined,0,0,0` and a totals row | ✅ Pass | `kabir-ananya-rsvps-YYYY-MM-DD.csv` |
| 8 | Guest taps **Get Directions** → `https://www.google.com/maps/dir/?api=1&destination=The Leela Palace, Diplomatic Enclave…` opens | ✅ Pass | |
| 9 | Google Calendar link: 14 Feb 2027 19:00–23:30 IST → `dates=20270214T133000Z/20270214T180000Z&ctz=Asia/Kolkata`, location included. The `.ics` file for "Add all" contains both events with correct UTC times | ✅ Pass | Time-zone conversion verified |
| 10 | Host edits the title and start time. Guests still see the old version (draft) until **Update published invitation**, then see "Kabir & Ananya – Forever" and 6:30 pm | ✅ Pass | |
| 11 | Second invitation: Corporate Meeting category, "Charcoal & Amber" palette, landscape layout, published as `q1-offsite` | ✅ Pass | `screenshots/t11-corporate.png` |
| 12 | The two invitations keep separate guest lists and RSVPs (2 vs 0). The same mobile number can RSVP to invitation 2 without affecting invitation 1 | ✅ Pass | |
| 13a | Image upload validation: a text file renamed `.jpg` is rejected ("does not look like a valid JPG file") | ✅ Pass | |
| 13b | Duplicate RSVP prevention: the same mobile number in a different format (`+91 98765-43210`) is blocked with a helpful message | ✅ Pass | |
| 13c | A guest changes their reply through the private edit link: the record is updated, not duplicated | ✅ Pass | |
| 13d | Language switch: after adding Hindi, the guest taps हिन्दी. Title "कबीर और अनन्या" and Hindi buttons ("उत्तर बदलें") render correctly | ✅ Pass | `screenshots/t13-hindi-rsvp.png` |
| 13e | Host wizard on an iPhone 13 profile: no horizontal scrolling | ✅ Pass | |
| + | Image card (1080×1350 PNG with QR) downloads, share-tab QR renders, check-in by `IVX:<slug>:<ref>` code works | ✅ Pass | `screenshots/card.png`, `share.png` |
| + | All 4 samples (Himachali Dham, wedding, birthday, corporate) render with no console errors | ✅ Pass | `screenshots/*-hero.png` |

## 2. Database / security tests (PostgreSQL 16)
`supabase/schema.sql` was applied to a local PostgreSQL 16 with minimal stand-ins for Supabase's `auth` and `storage` schemas (`tests/supabase-stubs.sql`). Then `tests/schema-test.sql` ran as the real `anon` and `authenticated` roles:

| Check | Result |
|---|---|
| Schema applies without errors | ✅ |
| Host B sees **0** of host A's invitations or password secrets (RLS) | ✅ |
| Anonymous users read **0** rows from invitations, guests and rsvps, even with table grants | ✅ |
| `get_public_invitation` returns the guest name for a valid personal token | ✅ |
| `submit_rsvp`: valid reply → ok; same phone in another format → `duplicate`; 5 people with a per-invite limit of 4 → `maxParty`; decline stores 0 attendees | ✅ |
| Password: no password → `password_required`, wrong → `wrong_password`, correct → `ok` (bcrypt) | ✅ |

## 3. Bugs found during testing and fixed
1. **The host app opened the home page instead of the requested page on reload.** The router ran before `wizard.js`/`dashboard.js` had registered their routes. Fixed by waiting for `DOMContentLoaded`.
2. **IndexedDB writes reported success before they were committed.** Another tab (the guest page) could briefly read stale data. Writes now resolve on transaction `complete`.
3. **Choosing a category replaced events with four empty events.** It now creates only the main event, and the others are one-tap suggestions.
4. **The cover and countdown used the earliest event (Mehendi) instead of the wedding.** Added a "Main event" choice.
5. **The Himalayan illustration showed a hard colour edge**, the host wizard was clipped on phones, and the image card's QR overlapped the corner decoration. All fixed.
6. **The password hash was in a column hosts could read** (a column-level revoke does not override Supabase's table grants). It now lives in `invitation_secrets` with RLS and no policies.
7. **Inline `onerror` image handlers were incompatible with a strict CSP.** They were replaced by listeners.

One intermittent failure of TEST 10 (an edit not saved) was seen once during development, before fix 2. It did not reproduce in 6 later full runs.

## 4. Not tested / known limitations (please read)
- **Live Supabase**: `SupabaseStore` in `js/store.js` is written against the schema and the supabase-js v2 API, but it was **not run against a real Supabase project** (none was available). The SQL logic it depends on was tested (§2). Expect to verify sign-in, storage uploads and the dashboard once a project is connected.
- **Browsers**: only Chromium was available for automated tests. Safari, Firefox and Edge were **not** tested. The code avoids Chromium-only APIs except camera QR scanning (`BarcodeDetector`, Chrome/Edge only, with manual reference entry as the fallback) and uses standard CSS (`:has()` needs Safari 15.4+ / Firefox 121+).
- **Demo/Local mode** cannot receive RSVPs from other devices. This is by design and is stated clearly in the UI.
- **WhatsApp**: uses official `wa.me` click-to-chat. The host must press Send, and delivery cannot be confirmed. There is no bulk or automatic sending (that would need the paid WhatsApp Business API). In tests the wa.me page was stubbed and the generated URL and message were verified.
- **Email**: `mailto:` links open the host's own mail app. There is no server-side email sending.
- **Google Maps embed** was blocked by the test sandbox's network. The embed URL and the directions link were verified, but the map tiles were not seen rendering.
- **Writing studio AI writer**: tested with fake providers only (`tests/copy-function-test.mjs`). It has not been run against live Gemini/OpenAI/Anthropic. The built-in writer is used whenever the AI is off or fails.
- **Audio/video** are uploaded as-is (browsers cannot compress them). Images are compressed.
- **PDF** is made through the browser's *Print → Save as PDF* on a print-optimised page, not a generated PDF file.
- **Section ordering** uses up/down buttons (keyboard accessible) rather than drag-and-drop.
- **Rate limiting / captcha** on public RSVP submission is not included. See the hardening checklist in DEPLOYMENT.md.
- Accessibility: keyboard navigation, focus trapping in dialogs, labels, `aria-live` messages and reduced-motion support were implemented and spot-checked. No full screen-reader audit was done.

## 5. Writing studio (InviteX V2 wording)

| Test | Result |
|---|---|
| `node tests/copy-engine-test.mjs`: 14 occasions × every offered style × 3 languages × 3 lengths (1,422 combinations, 4,266 versions) | 18,475 checks passed |
| `node tests/copy-function-test.mjs`: server step with fake Supabase and AI | 40 passed |
| `node tests/copy-studio-e2e.js`: studio in the browser (demo mode, fake AI) | all passed |
| `node tests/ai-function-test.mjs`, `tests/ai-design-e2e.js`, `tests/rsvp-onetap.js` (existing) | all passed |

The engine checks cover:
- every line is filled, with no leftover `{tokens}`, "undefined" or doubled punctuation;
- Hindi and Punjabi are written in their own script;
- no wedding or religious words at business events, and no party words at a puja;
- no religion appears unless the host chose one;
- no phrase is repeated across lines of a version;
- versions in one request differ (highest similarity 0.44 against a 0.5 limit);
- names with special characters are escaped;
- missing details are handled without inventing anything;
- multiple events and traditions are handled;
- the same seed gives the same result;
- wording the host turned down is avoided;
- lines are still not shared after 8 rounds;
- AI answers with placeholders, links, invented numbers, the wrong script or near-duplicates are rejected.

`tests/e2e.js` was updated for the writing studio (TEST 1b now checks that the studio asks before replacing typed text and keeps it). It still stops at TEST 7 (CSV export file name) and then times out. The same happens on `main` without these changes, because that test predates the 3-step editor and the one-tap RSVP. It needs a separate refresh.
