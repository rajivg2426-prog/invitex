# Writing studio (invitation wording)

In step 2 of the editor ("Fill your card"), hosts tap **✦ Write my wording** to open the writing studio. They choose:

- the occasion,
- the language (English, हिन्दी, ਪੰਜਾਬੀ),
- one of 12 writing styles,
- a length (Short for WhatsApp, Standard for the card, Detailed),
- 3–5 versions.

They can also add a few optional personal touches: who is being celebrated, who is inviting, who the guests mostly are, a religious tradition, **a memory or personal detail**, and **one thing every guest should know** (for example "Please arrive by 6 pm for the baraat"). The memory and the key message are placed in the main message **word for word**; the writer never rewrites them.

Each version fills every text line on the card: the top line, the line under the names, the welcome, the main message and the thank-you. Hosts can do the following:

- compare versions line by line,
- get new wording for a single line (↻),
- adjust a single line with the **Aa** menu: *Shorter*, *Longer*, *More emotional*, *More formal*, *More personal* or *Proofread* (Proofread fixes only spacing, punctuation, capitals and doubled words; it never changes words),
- undo a line change with ↶,
- edit a line,
- mix lines from different versions,
- preview a version on the live card,
- apply it, undo it, and restore any earlier wording.

**Nothing on the card changes until the host chooses "Use".** If they had typed a line themselves, the studio asks first ("Keep my lines" or "Replace everything").

The studio also warns when a generic word (such as *special*, *beautiful*, *joy* or their Hindi and Punjabi equivalents) is used more than once in a version, and the built-in writer avoids it where it can.

## Two writers, honestly labelled

| Writer | When it is used | Label on the card |
|---|---|---|
| **AI writer** | Online version, once switched on (below) | "AI-written" |
| **Built-in writer** | Demo mode, AI not switched on, AI busy or failing, daily AI limit reached, or the AI answer fails our checks | "Built-in writer" |

The built-in writer works offline, costs nothing, and already gives varied, natural wording in all three languages. It writes Hindi and Punjabi directly in those languages, not by translation. The AI writer is optional.

When the AI cannot be used, the studio always says so in plain words, for example "The AI writer is unavailable right now. These versions are from InviteX's built-in writer."

---

## Switching on the AI writer (about 10 minutes, no coding)

If you already switched on **Design with AI** ([AI_DESIGNS_SETUP.md](AI_DESIGNS_SETUP.md)), you already have the key and the database tables, so skip to step 3.

### Step 1. AI key

Use the same Google key as "Design with AI" (the secret `GEMINI_API_KEY`). If you do not have one yet:

1. Open **https://aistudio.google.com/apikey**.
2. Click **Create API key** and copy it.

Text writing works on Google's free tier. Billing is only needed for image designs.

### Step 2. Database tables (only if not done for AI designs)

1. Open **Supabase dashboard → SQL Editor → New query**.
2. Paste in the whole of [`supabase/ai-designs.sql`](../supabase/ai-designs.sql) and click **Run**.

No other database change is needed. The writing studio reuses the `ai_generations` log to count each user's daily AI writes.

### Step 3. Secret

1. Go to **Supabase → Edge Functions → Secrets**.
2. Check that `GEMINI_API_KEY` is there. If it isn't, add it.
3. Optional: add `ALLOWED_ORIGIN` = `https://rajivg2426-prog.github.io`.

### Step 4. Create the server step

1. Go to **Supabase → Edge Functions → Deploy a new function → Via Editor**.
2. Name it exactly **`write-invitation-copy`**.
3. Delete the sample code.
4. Paste in all of [`supabase/functions/write-invitation-copy/index.ts`](../supabase/functions/write-invitation-copy/index.ts).
5. Click **Deploy function**.
6. In the function's **Details / Settings**, turn **off** "Enforce JWT verification" (also called "Verify JWT") and save. The function checks the sign-in by itself.

### Step 5. Try it

1. Sign in on the site and open an invitation.
2. Go to **Fill your card** and tap **✦ Write my wording**.

The line under the button should say **"AI writer on"**. Tap **Write 4 versions**. The answer takes about 5–15 seconds.

---

### Updating an existing AI writer (needed once for the Aa menu)

If you switched the AI writer on before this release, redeploy the server step once so it understands the **Aa** line changes and the new memory / key message fields: in Supabase open **Edge Functions → write-invitation-copy**, replace its code with the new `supabase/functions/write-invitation-copy/index.ts`, and press **Deploy**. Nothing else changes (same secrets, same tables).

Until you do, everything still works: on AI-written versions the **Aa** changes are made by the built-in writer instead, and the line is labelled "Built-in writer" so it is always clear who wrote it.

## Optional settings (Edge Function secrets)

| Secret | What it does | Default |
|---|---|---|
| `GEMINI_API_KEY` | Google key (first choice) | none |
| `OPENAI_API_KEY` | OpenAI key, used as a backup if Google fails | none |
| `ANTHROPIC_API_KEY` | Anthropic key, used as a further backup | none |
| `AI_TEXT_PROVIDERS` | Order to try, e.g. `openai,google` | `google,openai,anthropic` (only those with a key) |
| `AI_TEXT_MODEL_GOOGLE` | Google model | `gemini-2.5-flash` |
| `AI_TEXT_MODEL_OPENAI` | OpenAI model | `gpt-4.1-mini` |
| `AI_TEXT_MODEL_ANTHROPIC` | Anthropic model | `claude-haiku-4-5` |
| `AI_TEXT_DAILY_LIMIT` | AI writes per user per 24 hours | `30` |
| `ALLOWED_ORIGIN` | Only this website may call the function | `*` |

If a provider fails, times out or sends an answer that fails the checks, the next provider is tried. If they all fail, the browser uses the built-in writer.

**Cost:** one AI write (4 versions) is roughly 2,000–3,000 words of text. On Gemini 2.5 Flash that is well under ₹0.50, or free within Google's free tier. Usage is in **Table Editor → `ai_generations`** (rows whose style starts with `copy:`).

## Privacy

The AI receives only what writing needs:

- the occasion, style, length and language,
- the names being celebrated, the event title and the host name,
- event names, dates, times, venue and city,
- the optional guest type, tradition, memory and key message that the host typed in the studio,
- earlier wording to avoid repeating.

Phone numbers, addresses, map links, guest lists, RSVPs and email addresses are never sent. The server step also drops any other field. The usage log stores only the occasion, language, length and style, not names or places.

## Rollback

- **Turn the AI writer off without deploying anything:** delete the `write-invitation-copy` function, or remove the AI key secrets. The studio switches to the built-in writer by itself.
- **Undo the whole feature:** revert the pull request. Invitations keep their wording. The studio's notes (the `copy` field inside each draft) are ignored by the old code and never appear on guest pages.

## For developers

| File | What it does |
|---|---|
| `js/copy/engine.js` (`IXCopy`) | Built-in writer: styles, facts (nothing invented), phrase picking with tone, idea and freshness rules, five message structures, repeat and similarity checks, checks on AI answers. Deterministic for a given seed. |
| `js/copy/bank-en.js`, `bank-hi.js`, `bank-pa.js` | Hand-written phrase banks, tagged by occasion group, tone, idea and tradition. |
| `js/copy/studio.js` (`IXStudio`) | The studio screen, apply / undo / restore, and the "ask before replacing typed lines" rule. |
| `js/store.js` | `aiWriteAvailable` and `aiWrite()` call the function with the user's token. |
| `supabase/functions/write-invitation-copy/index.ts` | Sign-in check, daily limit, prompt, structured JSON from each provider, server-side checks, fallback, usage log. |

Tests (no network, fixed seeds):

```
node tests/copy-engine-test.mjs     # built-in writer: every occasion × style × language × length, repeats, safety
node tests/copy-function-test.mjs   # server step with fake Supabase and fake AI providers
python3 -m http.server 8765 &  node tests/copy-studio-e2e.js   # the studio in the browser (demo mode, fake AI)
node tests/copy-v2-e2e.js           # Aa line changes, proofread, memory / key message, repeated-word warning
```
