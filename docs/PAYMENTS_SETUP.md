# Paid sharing: setup (test mode)

InviteX can ask a host to pay once, by UPI through Razorpay, before sharing an invitation with guests.
Creating, editing, photos, preview, guest lists and messages stay free. One payment opens one
**sharing campaign** for one invitation, for any number of guests, and resending inside it is free.

This guide switches everything on in **test mode**. Test mode is safe:

- Only **admin and Super Admin accounts** are asked to pay, and only with Razorpay **test money**.
- Every other host shares free, exactly as before.
- No real money can move until you finish [PAYMENTS_GO_LIVE.md](PAYMENTS_GO_LIVE.md) yourself.

Everything below is done in web dashboards. It takes about 30 minutes.

---

## Step 1. Add the payments part of the database

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/billing.sql`](../supabase/billing.sql) and click **Run**. It should say "Success".

The order matters: `schema.sql`, then `admin.sql`, then (if you use AI designs) `ai-designs.sql`, then
`billing.sql`. If you ever run `schema.sql` or `admin.sql` again, run `billing.sql` again afterwards.
Running `billing.sql` twice is safe.

What it does:

- Creates the price settings (₹20 per campaign, charging on, **test mode**), sharing campaigns,
  orders, payments, refunds, webhook log, free-access rules and promotions. Row Level Security is on:
  a host can read only their own campaigns and payments and can write none of these tables directly.
- **Invitations already shared before this step keep working**: each published invitation gets a free
  "shared before billing" campaign, once.
- Makes the oldest admin the **Super Admin** if there is none yet. Only the Super Admin can change
  prices, free access or payment mode; other admins can only look.

To make a specific account the Super Admin, run this in the SQL Editor (put in your email):

```sql
update public.profiles set role = 'super_admin'
where user_id = (select id from auth.users where email = 'you@example.com');
```

## Step 2. Get Razorpay **test** keys

1. Sign up at **https://dashboard.razorpay.com** (test mode works before KYC).
2. Make sure the switch at the top says **Test Mode**.
3. **Account & Settings → API Keys → Generate Test Key**. Copy the **Key Id** (starts with `rzp_test_`)
   and the **Key Secret**. Keep the secret private; it is shown once.

## Step 3. Store the keys as Supabase secrets

Supabase dashboard → **Edge Functions → Secrets** → **Add new secret**, one at a time:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | your `rzp_test_…` key id |
| `RAZORPAY_KEY_SECRET` | your test key secret |
| `RAZORPAY_WEBHOOK_SECRET` | a long random password you make up (used again in step 5) |
| `ALLOWED_ORIGIN` (optional) | your site address, for example `https://rajivg2426-prog.github.io` |

Do **not** add `PAYMENTS_LIVE_ALLOWED`. Leaving it out is what keeps real payments impossible.

These secrets live only on the server. They are never put in `js/config.js`, in GitHub, or in the website.

## Step 4. Create the two server steps (Edge Functions)

For each of these, Supabase dashboard → **Edge Functions → Deploy a new function → Via Editor**,
name it exactly as shown, delete the sample code, paste the whole file and click **Deploy function**.
Then open the function's settings and turn **off** "Enforce JWT verification", and save.

| Function name | File to paste |
|---|---|
| `sharing-campaign` | [`supabase/functions/sharing-campaign/index.ts`](../supabase/functions/sharing-campaign/index.ts) |
| `razorpay-webhook` | [`supabase/functions/razorpay-webhook/index.ts`](../supabase/functions/razorpay-webhook/index.ts) |

`sharing-campaign` checks the host's sign-in itself. `razorpay-webhook` is called by Razorpay, which has
no Supabase sign-in, and instead checks Razorpay's signature on every message.

(With the Supabase command line instead: `supabase functions deploy sharing-campaign --no-verify-jwt`
and `supabase functions deploy razorpay-webhook --no-verify-jwt`.)

## Step 5. Tell Razorpay where to send payment updates (webhook)

Razorpay dashboard (still in Test Mode) → **Account & Settings → Webhooks → Add New Webhook**:

- **Webhook URL**: `https://YOUR-PROJECT.supabase.co/functions/v1/razorpay-webhook`
- **Secret**: the same password you put in `RAZORPAY_WEBHOOK_SECRET`
- **Active events**: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`,
  `refund.created`, `refund.processed`, `refund.failed`

This is the second, independent confirmation of each payment. If a host's browser closes half-way,
the webhook still opens their sharing.

Also check **Account & Settings → Payment capture**: automatic capture should be on (the default), so
a UPI payment becomes "captured" by itself. InviteX opens sharing only for a captured payment of the
exact amount.

## Step 6 (optional). Re-check unfinished payments every 15 minutes

If both the browser and the webhook miss a payment, the host can press **I already paid**. To have the
server re-check by itself as well: Supabase dashboard → **Integrations → Cron → Create job**:

- Schedule: every 15 minutes (`*/15 * * * *`)
- Type: **Supabase Edge Function**, function `sharing-campaign`, method POST
- Body: `{"action":"reconcile"}`
- Header `Authorization`: `Bearer ` followed by your **service_role** key (Project Settings → API).
  This key stays inside Supabase; never put it anywhere else.

## Step 7. Try it with test money

1. Sign in to InviteX with your **admin** account, open a published invitation, go to **Share**.
2. You see **₹20 once, by UPI** and a blue **TEST MODE** label. Click **Start sharing · Pay ₹20 by UPI**.
3. Razorpay's window opens with UPI only. In test mode Razorpay shows a test screen instead of a real
   UPI app: choose the option that makes the payment succeed.
4. The Share tab changes to **Paid ₹20** and the sharing buttons appear. Guests can now open the link.
5. Admin → **Payment transactions** → tick **Show test payments instead**: the payment is listed.

Then try a failure (choose "failure" on the test screen) and closing the window: the host sees
**Try again**, **I already paid** and **Not now**, and is never charged twice for one campaign.

A host without an admin role sees **Sharing is free right now** in test mode. That is expected.

---

## Using the admin money screens

Admin → left menu:

- **Overview**: users, campaigns, real revenue (test payments are counted separately).
- **Sharing campaigns**: every campaign, paid or free, with search and filters.
- **Pricing control** (Super Admin): the charging switch and the price, ₹10 to ₹100 in whole rupees.
  Each save is a new version with who changed it and when. A change applies to campaigns started later.
- **Free access** (Super Admin): emergency "everything free" switch, free days for new users, free first
  campaigns, timed promotions (they end by themselves and normal pricing returns), and free access for
  named people.
- **Payment transactions**: every payment, with filters, search and **Download CSV**.
- **Revenue reports**: money per day, India time.
- **System settings**: test/live mode (see the go-live guide), campaign closing days, guest limit.
- **Audit log**: every change, with who made it. It cannot be edited or deleted.

## Refunds

Make refunds in the Razorpay dashboard (Payments → the payment → Refund). The webhook records it.
After a **full** refund, links already sent keep working, but that campaign stops sharing to new guests;
the host can start a new campaign. If a host was charged twice for one campaign, Payment transactions
shows **Paid twice: refund due**; refund the second payment in Razorpay.

## Running the tests (for developers)

Needs a local Postgres you can reach with `psql`, Node 22.18 or newer, and Playwright.

```bash
sh tests/run-billing-sql.sh            # 108 database checks (prices, free access, campaigns, payments, refunds, RLS)
node tests/payments-function-test.mjs  # 36 checks of both Edge Functions with a fake Razorpay
node tests/billing-e2e.mjs             # 36 browser checks: pay flow, locked guest link, admin screens, phone layout
```

All three use a **fake** Razorpay: no network and no money.
