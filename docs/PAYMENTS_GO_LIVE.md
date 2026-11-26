# Paid sharing: going live with real money

**Do these steps yourself, only when you have decided to take real payments.** Nothing in InviteX switches
to real money by itself: it needs all three of the switches in step 5, and each one is yours to turn.

Before you start, test mode must already work end to end ([PAYMENTS_SETUP.md](PAYMENTS_SETUP.md), step 7).

## 1. Razorpay account activation (KYC)

Razorpay dashboard → **Activate account**. You will need PAN, bank account details, business details and
your website address. Razorpay checks that the website shows the pages in step 2. Approval usually takes
a few working days. UPI must be enabled for the account (it is by default for most Indian businesses).

## 2. Pages your website must have

Razorpay and Indian payment rules expect these to be public and linked from the site (footer or Help):

- **Terms and conditions**: what a sharing campaign is, that one payment covers one campaign for one invitation.
- **Refund and cancellation policy**: for example, refunds for duplicate payments or failed sharing, how to
  ask, and how long it takes (Razorpay refunds usually reach the customer in 5 to 7 working days).
- **Privacy policy**: what you store (account email, invitations, guest names and phone numbers, payment
  records) and that card or UPI details are handled by Razorpay, not stored by InviteX.
- **Contact us**: an email, phone number and address for payment questions.

These are business and legal texts; have them checked by someone qualified. They are not included.

## 3. Tax

Ask a chartered accountant whether you need GST registration and invoices for this income. InviteX
records every payment (Admin → Payment transactions → Download CSV) but does not create tax invoices.

## 4. Live keys and live webhook

1. In the Razorpay dashboard switch to **Live Mode**.
2. **API Keys → Generate Live Key**. Copy the Key Id (`rzp_live_…`) and the secret.
3. **Webhooks → Add New Webhook** in Live Mode, with the same URL and events as in test mode, and a **new**
   secret password.
4. Supabase → **Edge Functions → Secrets**: replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
   `RAZORPAY_WEBHOOK_SECRET` with the live values.

From this moment until step 5 is finished, payments are refused (the server sees live keys but the
database is still in test mode). Hosts who are not admins keep sharing free, so nobody is blocked.

## 5. The three switches

All three are needed. Any one missing means no real payment can start.

1. **Live keys** on the server (step 4).
2. Supabase → Edge Functions → Secrets → add `PAYMENTS_LIVE_ALLOWED` with the value `true`.
3. InviteX → Admin → **System settings** (Super Admin only): type **I approve live payments** and click
   **Switch to live payments**. This is recorded in the Audit log.

## 6. One real ₹10 payment and refund

1. Admin → **Pricing control**: set the price to **₹10** and save.
2. With your own account, start a campaign on one of your invitations and pay ₹10 from your own UPI app.
3. Check: the Share tab says **Paid ₹10**, the payment appears in Admin → Payment transactions (without
   the TEST label) and in the Razorpay dashboard.
4. In the Razorpay dashboard refund that payment. Check it shows as **Refunded** in Payment transactions.
5. Set the price you want (₹10 to ₹100) and save.

## Going back

Admin → System settings → **Switch back to test mode** stops all new real payments immediately.
Campaigns that were already paid stay open. For an outage or a goodwill gesture, use Admin → Free access →
**Make all new sharing campaigns free** instead; normal pricing returns when you switch it off.
