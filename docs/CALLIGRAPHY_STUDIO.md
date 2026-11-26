# Calligraphy Studio – how it works

Calligraphy Studio makes wedding cards that look hand-lettered: real calligraphy fonts, decorated initials, flourishes, papers and inks, in English, Hindi and Punjabi. This page is for whoever maintains InviteX. How to use it is in the [user manual](USER_MANUAL.md#calligraphy-studio).

## Where things are

| File | What it does |
|---|---|
| `fonts/calligraphy/` | 34 self-hosted font files (all SIL Open Font License 1.1), `fonts.css`, the licences and `LICENSES.md`. Made by `tools/fetch-calligraphy-fonts.mjs`, which refuses any font that is not OFL. |
| `js/calligraphy/fonts.js` | The font library: categories, which script each font covers, size factors, on-demand loading. |
| `js/calligraphy/library.js` | Inks, papers (SVG noise textures, torn edges), borders, corners and the 20 flourishes. |
| `js/calligraphy/styles.js` | The 10 starting styles, the words each page uses, the four pages, starting words in each language. |
| `js/calligraphy/render.js` | The drawing engine: design data → one SVG page. Used by the studio, the thumbnails, the guest page and the downloads, so they always match. |
| `js/calligraphy/studio.js` | The editor at `#/calligraphy/<invitation id>` (and `…/download` to open the download choices). |
| `js/calligraphy/export.js` | PNG, JPG, ZIP, PDF and print PDF. |
| `css/calligraphy.css` | Studio layout (three panels on a computer, bottom bar and sheets on a phone). |
| `js/vendor/jspdf.umd.min.js`, `js/vendor/svg2pdf.umd.min.js`, `js/vendor/harfbuzz/` | jsPDF 4.2.1, svg2pdf.js 2.9.0 (MIT) and HarfBuzz (harfbuzzjs 1.6.4, MIT). Loaded only when someone downloads. |

## Saved data

Everything lives inside the invitation record, so demo mode (IndexedDB) and the online version (the `data` column in Supabase) both keep it with no database change. The published copy guests see includes it too.

- `inv.calligraphy`: `{ v, style, size, paper{…}, inks{…}, sheen, nameLayout, initials, orn{…}, el{ id: changes }, added[], removed[], pages{ cover, events, rsvp }, fromCopy{…}, autoTitle{…}, active }`.
  - `el` holds what the host changed for one item: position (`dx`, `dy`, `rot`), size, spacing, fonts, ink, `hidden`.
  - Items on the cover, events and RSVP pages have ids like `cover:names` or `events:ev1n`. The names keep one set of lettering settings on every page; only their position is per page.
  - `added` lists flourishes the host added, each with `page`, `x`, `y`, `scale`, `rot`, `opacity` and `ink`.
  - `pages.x === false` leaves a page out of the set.
  - `fromCopy` remembers what Copy Studio last wrote into each line, so a line the host typed is never replaced.
- Words stay in `inv.text[lang]`, with these new keys: `heading`, `bride`, `groom`, `underNames`, `brideParents`, `groomParents`, `reception`, `rsvpNote`, `blessing`, `coverLine`, `eventsTitle`, `rsvpTitle`. The message is the same `message` Copy Studio writes.
- Dates, times and places come from `inv.events`. The reply-by date is `inv.settings.rsvpDeadline`, which also closes RSVP. The contact is `inv.contact`.

## Lettering

- Each piece of text is checked for its script. Hindi always uses a Devanagari font and Punjabi a Gurmukhi font; an English calligraphy font is never forced onto them.
- Names are drawn exactly as typed. If a name is long it is made smaller first; it is split over two lines only as a last resort, at a space.
- Punjabi uses traditional lettering, because no freely licensed handwritten Gurmukhi calligraphy font exists.

## Copy Studio

The Words panel opens the existing Copy Studio (`js/copy/studio.js`) beside the card; there is no second writer. Its lines map like this:

| Copy Studio | Calligraphy card |
|---|---|
| Top line | Heading |
| Line under the names | Line under the names |
| Main message | Message (the same line) |
| Thank-you | Blessing |

The calligraphy writing styles are Royal, Romantic (`heartfelt`), Traditional, Formal, Poetic, Elegant and Minimal (`modern`). **Poetic** is new for both writers: hand-written phrase banks in English, Hindi and Punjabi in `js/copy/bank-*.js`, and a prompt line in `supabase/functions/write-invitation-copy/index.ts`. Redeploy that function to get AI-written Poetic text. Until it is redeployed, the server treats Poetic as Elegant, while the built-in writer already writes Poetic.

## Downloads

Nothing is a screenshot of the editor. Each page is drawn again from the design (`IXC.draw`), then:

1. **Lettering → outlines.** `export.js` reads every `<text>` in the page, shapes it with HarfBuzz from the same font files (so Devanagari and Gurmukhi letters join correctly and script fonts keep their joining strokes), and writes each line as vector paths. Arched names are laid along their curve letter by letter. The OFL allows fonts to be embedded and converted this way.
2. **Paper → picture.** The paper texture is made of SVG noise filters, which a PDF cannot hold, so it is drawn as a 300 dpi picture behind the vectors. That is the only picture in a PDF, and identical paper is stored once.
3. **PNG and JPG**: the outlined page drawn on a canvas at 300 dpi (1500 × 2100 px for 5 × 7 in, 1748 × 2480 px for A5).
4. **PDF**: the paper picture plus the ink layer as vectors (svg2pdf.js), one page each, at the exact card size. Outlines in metal gradients get a solid middle colour, because PDF readers do not paint gradient outlines.
5. **Print PDF**: flat inks, no torn edge, paper running 3 mm past the cut line (bleed) on every side, and crop marks in an 8 mm margin. For 5 × 7 in that is a 149 × 199.8 mm page.
6. **ZIP**: one PNG for each page that is switched on, stored without compression (PNGs are already compressed).

Gold, bronze and copper are gold-coloured inks. The studio and the download choices say plainly that they are not metallic foil.

## Tests

Run these from the repository; no server is needed (the tests serve the files themselves). To use a running server instead, add `BASE=http://localhost:8765/`.

```bash
node tests/calligraphy-e2e.js          # part A: gallery, fonts, names, editing, flourishes, paper, ink, undo, save, phone (34 checks)
node tests/calligraphy-pages-e2e.js    # part B: the four pages and Copy Studio, Poetic in 3 languages (33 checks)
node tests/calligraphy-export-e2e.js   # part C: every download checked from the outside, online save, phone (25 checks)
node tests/copy-engine-test.mjs && node tests/copy-function-test.mjs   # writers, including Poetic
```

How the 18 test points from the brief are covered:

| # | Point | Where |
|---|---|---|
| 1 | Calligraphy Studio appears in the gallery | `calligraphy-e2e`: gallery tab, 10 styles, step 1 choice |
| 2 | All font categories load | `calligraphy-e2e`: all 33 library fonts load from `fonts/calligraphy`, categories shown |
| 3 | Bride and groom names render correctly | `calligraphy-e2e`: names drawn exactly as typed |
| 4 | Text remains editable | `calligraphy-e2e`: live SVG text, edited from the panel and the card |
| 5 | Different sections can use different fonts | `calligraphy-e2e` |
| 6 | Hindi text renders correctly | `calligraphy-e2e` (Devanagari font), `calligraphy-export-e2e` (shaped conjuncts, Hindi PDF) |
| 7 | Punjabi text renders correctly | `calligraphy-e2e` (Gurmukhi font), `calligraphy-export-e2e` |
| 8 | Long names fit without overflow | `calligraphy-e2e`: a 40-letter name |
| 9 | Flourishes can be moved and resized | `calligraphy-e2e`: drag, resize, turn, transparency, kept off words |
| 10 | Paper backgrounds can be changed | `calligraphy-e2e`: all 8 papers, dark-paper ink swap |
| 11 | Colour controls work | `calligraphy-e2e` |
| 12 | Undo and redo work | `calligraphy-e2e`, `calligraphy-pages-e2e` |
| 13 | Designs save and reopen correctly | all three suites; `calligraphy-export-e2e` also checks the online (Supabase) save and load path and the published copy |
| 14 | Multi-page invitations generate correctly | `calligraphy-pages-e2e`, `calligraphy-export-e2e` (4-page PDF and ZIP, a page left out) |
| 15 | PDF export preserves fonts | `calligraphy-export-e2e`: lettering is vector outlines from the font files, no fallback PDF font, correct page sizes |
| 16 | PNG export is high resolution | `calligraphy-export-e2e`: 1500 × 2100 px PNG and JPG |
| 17 | Mobile preview works | all three suites on an iPhone 13 screen |
| 18 | Existing templates continue to work | `calligraphy-e2e` (the 14 ready designs), plus the older suites |

The online (Supabase) mode is checked by running the design through the same JSON save and load the online version uses. A run against a real Supabase project needs the online setup in `DEPLOYMENT.md`.
