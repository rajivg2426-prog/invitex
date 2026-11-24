# Switching on "Design with AI"

In step 1 of the editor, hosts can pick a ready style (Royal, Floral, Temple, Minimal, Mehndi, Pichwai, Birthday, Corporate), pick colours, add a few words, and get **4 AI-painted card backgrounds**. They tap one and it becomes the card background, with their names and details on top.

The AI key must never be in the website, so a small server step (a Supabase **Edge Function** called `generate-card-art`) talks to the image AI. Everything below is done in web dashboards. No coding or command line is needed.

It takes about 15 minutes.

---

## Step 1. Get an AI key (Google, recommended)

1. Open **https://aistudio.google.com/apikey** and sign in with a Google account.
2. Click **Create API key**. Copy the key (it starts with `AIza…`). Keep it private.
3. Image generation is a paid feature, so the key's Google Cloud project needs **billing turned on**. AI Studio shows a "Set up billing" link next to the key. Add a card there.
4. Strongly recommended: in Google Cloud **Billing → Budgets & alerts**, create a budget (for example ₹2,000 a month) so you get an email before spending grows.

Cost: Google Imagen 4 is about **US$0.04 per image** (around ₹3.5), so one try (4 designs) is about ₹14. With 3 free tries, one new user can cost at most about ₹42. Check current prices at https://ai.google.dev/pricing.

> Prefer OpenAI? Create a key at https://platform.openai.com/api-keys and use the name `OPENAI_API_KEY` instead of `GEMINI_API_KEY` in step 3. It costs a little more (about ₹5 per image).

## Step 2. Add the free-tries tables to the database

1. Open your project at **https://supabase.com/dashboard** → **SQL Editor** → **New query**.
2. Open the file [`supabase/ai-designs.sql`](../supabase/ai-designs.sql) in this repository, copy all of it, paste it into the editor and click **Run**. It should say "Success. No rows returned".

This creates the allowance table (every user gets **3 free tries**) and a log of every AI request so you can keep an eye on cost.

## Step 3. Store the AI key as a secret in Supabase

1. In the Supabase dashboard go to **Edge Functions → Secrets** (sometimes shown under *Project Settings → Edge Functions*).
2. Click **Add new secret**:
   - Name: `GEMINI_API_KEY`
   - Value: the key from step 1
3. Optional, for extra safety: add `ALLOWED_ORIGIN` with the value `https://rajivg2426-prog.github.io` so only your site can call the function.

## Step 4. Create the server step (Edge Function)

1. In the Supabase dashboard go to **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly: **`generate-card-art`**
3. Delete the sample code. Open [`supabase/functions/generate-card-art/index.ts`](../supabase/functions/generate-card-art/index.ts) in this repository, copy all of it, and paste it in.
4. Click **Deploy function**.
5. Open the function's **Details / Settings** and turn **off** "Enforce JWT verification" (also called "Verify JWT"), then save. The function checks that the user is signed in by itself; Supabase's own check can wrongly reject the new-style keys this site uses.

## Step 5. Try it

Open the site, sign in, start a new invitation and look for **✨ Or let AI paint your card** in step 1. Choose a style and tap **Paint 4 designs**. The first try takes about 20–40 seconds.

If something is wrong, the editor shows a plain message, for example:
- *"The AI designer is not switched on yet"* → step 3 or 4 is missing, or the function name is not exactly `generate-card-art`.
- *"The AI key is not valid"* → re-copy the key in step 3.
- *"busy or the account has run out of credit"* → billing is not on (step 1.3), or wait a minute.

A failed attempt never uses up a free try.

---

## Day-to-day

**See how much AI is being used:** Supabase → **Table Editor** → `ai_generations` (one row per try, with the style and number of images).

**Give someone more tries** (for example after they pay): Supabase → **SQL Editor**:
```sql
update public.ai_credits set plan = 'pro', tries_limit = 20
where user_id = (select id from auth.users where email = 'their@email.com');
```

**Change the free allowance for everyone new:**
```sql
alter table public.ai_credits alter column tries_limit set default 5;
```

**Halve the cost** with Google's faster model: add the secret `AI_IMAGE_MODEL` = `imagen-4.0-fast-generate-001`.

**Paint fewer designs per try** (cheaper): add the secret `AI_IMAGES_PER_TRY` = `2` (1–4). The editor button still says "4", so change that text too if you do this.

## How it works (for developers)

- `js/wizard.js` (`renderAi`) shows the picker. `js/store.js` (`aiGenerate`, `aiCredits`, `aiRecent`) calls the function with the signed-in user's token.
- `supabase/functions/generate-card-art/index.ts` checks the user, takes one try (`ai_take_try`, atomic), builds the prompt from the chosen style, colours, event type and the user's cleaned words, calls Google Imagen or OpenAI, saves the images to `invite-media/<user-id>/ai/`, and refunds the try if anything fails. Prompts ask for rich ornament on the edges, a calm centre for the text, and no lettering.
- The chosen design is copied into the invitation's own media folder (as WebP), so removing or deleting the invitation works as before. All of a user's paintings stay in their `ai/` folder and appear under "Your earlier AI designs".
- To add another image provider, add a function shaped like `googleImagen` / `openAiImage` and a case in `pickProvider`.
- Tests: `node tests/ai-function-test.mjs` (function, with fake AI and Supabase), `node tests/ai-design-e2e.js` (editor picker), `tests/ai-credits-test.sql` (allowance rules).
