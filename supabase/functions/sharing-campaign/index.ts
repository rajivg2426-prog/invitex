// InviteX – paid sharing campaigns (Supabase Edge Function "sharing-campaign").
//
// The browser calls this to pay for a sharing campaign with UPI through Razorpay
// Standard Checkout. Every money decision is made here and in the database
// (supabase/billing.sql); the browser only opens the checkout window.
//
// Actions (POST JSON { action, ... }, signed-in host):
//   order   { campaign_id }   re-check free access, create or reuse a Razorpay order
//                             with the SERVER amount, return what Checkout needs
//   verify  { campaign_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
//                             check the signature, ask Razorpay for the payment, and
//                             unlock only when it is captured for the exact amount
//   status  { campaign_id }   ask Razorpay about the campaign's order (pending UPI)
//   reconcile                 (service key only, for a scheduled job) re-check orders
//                             still open after 30 minutes, in case a callback was lost
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   RAZORPAY_KEY_ID          rzp_test_… while testing, rzp_live_… only after go-live
//   RAZORPAY_KEY_SECRET      never leaves the server
//   PAYMENTS_LIVE_ALLOWED    leave UNSET until the owner approves real payments ("true" to allow)
//   ALLOWED_ORIGIN           e.g. https://rajivg2426-prog.github.io (default: any origin)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// No imports, so it can be pasted straight into the dashboard editor.

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

export type Payment = {
  id: string; order_id?: string; status: string; amount: number; currency: string;
  method?: string; error_code?: string | null; error_description?: string | null;
};

// A payment provider. Campaigns and unlocks only ever see "a verified payment of X paise",
// so adding Cashfree later means writing another object with these five jobs.
export interface PaymentProvider {
  name: string;
  publicKey(): string;
  mode(): 'test' | 'live' | 'unknown';
  createOrder(o: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  verifyCheckout(p: { order_id: string; payment_id: string; signature: string }): Promise<boolean>;
  fetchPayment(id: string): Promise<Payment>;
  orderPayments(orderId: string): Promise<Payment[]>;
}

/* ---------------- small crypto helpers (Web Crypto, works in Deno and Node) ---------------- */
const enc = new TextEncoder();
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------------- Razorpay ---------------- */
export function razorpay(env: Env, f: Fetch): PaymentProvider {
  const id = env.RAZORPAY_KEY_ID || '', secret = env.RAZORPAY_KEY_SECRET || '';
  const API = (env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1').replace(/\/$/, '');
  const auth = 'Basic ' + btoa(`${id}:${secret}`);
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await f(API + path, { ...init, headers: { authorization: auth, 'content-type': 'application/json', ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`razorpay ${path.split('/')[1]} ${r.status} ${(j as any)?.error?.description || ''}`.trim());
    return j as any;
  };
  return {
    name: 'razorpay',
    publicKey: () => id,
    mode: () => (id.startsWith('rzp_live_') ? 'live' : id.startsWith('rzp_test_') ? 'test' : 'unknown'),
    createOrder: async (o) => { const j = await call('/orders', { method: 'POST', body: JSON.stringify(o) }); return { id: j.id }; },
    verifyCheckout: async (p) => !!(p.order_id && p.payment_id && p.signature) && safeEqual(await hmacHex(secret, `${p.order_id}|${p.payment_id}`), String(p.signature)),
    fetchPayment: async (pid) => call('/payments/' + encodeURIComponent(pid)),
    orderPayments: async (oid) => ((await call('/orders/' + encodeURIComponent(oid) + '/payments')).items || []) as Payment[],
  };
}

const PROVIDERS: Record<string, (env: Env, f: Fetch) => PaymentProvider> = { razorpay };

export const slim = (p: Payment) => ({
  id: p.id, status: p.status, amount: p.amount, currency: p.currency, method: p.method || null,
  error_code: p.error_code || null, error_description: p.error_description || null,
});

class UserError extends Error {
  status: number; code: string;
  constructor(msg: string, status = 400, code = 'error') { super(msg); this.status = status; this.code = code; }
}

export async function handle(req: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  const cors = {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    vary: 'origin',
  };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const SB = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const svc = { apikey: KEY, authorization: `Bearer ${KEY}` };
  const rpc = async (name: string, args: unknown) => {
    const r = await f(`${SB}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...svc, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    const t = await r.text();
    if (!r.ok) throw new Error(`rpc ${name} ${r.status} ${t}`);
    return t ? JSON.parse(t) : null;   // functions that return nothing send an empty body
  };

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  try {
    // The provider and the mode must agree: test keys in test mode, live keys only in live mode
    // AND only when PAYMENTS_LIVE_ALLOWED is set. Anything else: no orders at all.
    const dbMode = String(await rpc('_svc_billing_mode', {}));
    const provider = PROVIDERS.razorpay(env, f);
    const ready = () => {
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) throw new UserError('Payments are not switched on yet (the Razorpay keys have not been added).', 503, 'not_configured');
      if (dbMode === 'live' && env.PAYMENTS_LIVE_ALLOWED !== 'true') throw new UserError('Real payments have not been approved yet.', 503, 'live_not_allowed');
      if (provider.mode() !== dbMode) throw new UserError(`Payments are set to ${dbMode} mode but the server has ${provider.mode()} keys.`, 503, 'mode_mismatch');
    };
    const apply = async (orderId: string, p: Payment, via: string) => rpc('_svc_payment_apply', { p_provider: provider.name, p_provider_order_id: orderId, p_payment: slim(p), p_via: via });

    // scheduled reconcile (service key only)
    if (body.action === 'reconcile') {
      if (!KEY || !safeEqual(token, KEY)) return reply(401, { error: 'Not allowed.' });
      ready();
      const list = (await rpc('_svc_orders_to_reconcile', { p_min_age_minutes: 30 })) as any[];
      const out: any[] = [];
      for (const o of list) {
        try { for (const p of await provider.orderPayments(o.provider_order_id)) out.push(await apply(o.provider_order_id, p, 'reconcile')); }
        catch (e) { console.error('reconcile', o.provider_order_id, e); }
      }
      return reply(200, { checked: list.length, results: out });
    }

    // who is asking?
    if (!token) return reply(401, { error: 'Please sign in.', code: 'auth' });
    const ur = await f(`${SB}/auth/v1/user`, { headers: { apikey: KEY, authorization: `Bearer ${token}` } });
    const user = ur.ok ? await ur.json() : null;
    if (!user?.id) return reply(401, { error: 'Please sign in again.', code: 'auth' });
    const campaign = String(body.campaign_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(campaign)) return reply(400, { error: 'Which campaign?' });

    if (body.action === 'order') {
      const prep = await rpc('_svc_order_prepare', { p_user: user.id, p_campaign: campaign, p_provider: provider.name });
      if (prep.status === 'not_found') return reply(404, { error: 'Campaign not found.' });
      if (prep.status === 'suspended') return reply(403, { error: 'Your account is paused.' });
      if (prep.status === 'busy') return reply(409, { error: 'A payment is already being set up. Please try again in a moment.', code: 'busy' });
      if (prep.status === 'closed') return reply(409, { error: 'This campaign is finished.', code: 'closed', campaign: prep.campaign });
      if (prep.status === 'unlocked' || prep.status === 'free') return reply(200, { status: 'unlocked', campaign: prep.campaign });
      try { ready(); } catch (e) {
        if (prep.status === 'create') await rpc('_svc_order_create_failed', { p_order: prep.order_id, p_error: (e as Error).message }).catch(() => {});
        throw e;
      }
      let orderId = prep.provider_order_id;
      if (prep.status === 'create') {
        try {
          const o = await provider.createOrder({
            amount: prep.amount_paise, currency: prep.currency, receipt: String(prep.receipt).slice(0, 40),
            notes: { campaign_id: campaign, user_id: user.id, app: 'InviteX' },
          });
          orderId = o.id;
          await rpc('_svc_order_created', { p_order: prep.order_id, p_provider_order_id: orderId });
        } catch (e) {
          await rpc('_svc_order_create_failed', { p_order: prep.order_id, p_error: String((e as Error).message) }).catch(() => {});
          console.error(e);
          return reply(502, { error: 'Could not start the payment. Please try again.', code: 'provider' });
        }
      }
      return reply(200, {
        status: 'checkout', provider: provider.name, key_id: provider.publicKey(), order_id: orderId,
        amount_paise: prep.amount_paise, currency: prep.currency, is_test: !!prep.is_test, method: 'upi',
      });
    }

    if (body.action === 'verify' || body.action === 'status') {
      const ord = await rpc('_svc_campaign_order', { p_user: user.id, p_campaign: campaign });
      if (!ord?.provider_order_id) return reply(404, { error: 'No payment has been started for this campaign.' });
      ready();
      if (body.action === 'verify') {
        if (body.razorpay_order_id !== ord.provider_order_id) return reply(400, { error: 'That payment is for a different order.', code: 'order_mismatch' });
        const good = await provider.verifyCheckout({ order_id: body.razorpay_order_id, payment_id: body.razorpay_payment_id, signature: body.razorpay_signature });
        if (!good) return reply(400, { error: 'The payment could not be verified. Nothing was unlocked.', code: 'invalid_signature' });
        // never trust the browser's word: ask Razorpay
        const p = await provider.fetchPayment(String(body.razorpay_payment_id));
        if (p.order_id !== ord.provider_order_id) return reply(400, { error: 'That payment is for a different order.', code: 'order_mismatch' });
        const r = await apply(ord.provider_order_id, p, 'checkout');
        return reply(200, { result: r.result });
      }
      const pays = await provider.orderPayments(ord.provider_order_id);
      const results: string[] = [];
      for (const p of pays) results.push((await apply(ord.provider_order_id, p, 'status_check')).result);
      const best = ['unlocked', 'already_unlocked', 'duplicate', 'pending', 'mismatch', 'failed'].find((k) => results.includes(k)) || 'waiting';
      return reply(200, { result: best });
    }
    return reply(400, { error: 'Unknown action.' });
  } catch (e) {
    if (e instanceof UserError) return reply(e.status, { error: e.message, code: e.code });
    console.error(e);
    return reply(500, { error: 'Something went wrong with the payment step. Please try again. A retry never charges you twice.' });
  }
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handle(req, D.env.toObject()));
