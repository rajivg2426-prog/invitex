// InviteX – Razorpay webhook (Supabase Edge Function "razorpay-webhook").
//
// Razorpay calls this address when a payment or refund changes. It is the second,
// independent confirmation of a payment (the first is the checkout callback), so a
// payment whose browser closed half-way still unlocks the host's campaign.
//
//   1. The X-Razorpay-Signature header must be the HMAC-SHA256 of the raw body with
//      RAZORPAY_WEBHOOK_SECRET. Anything else is logged and ignored.
//   2. Each event id (X-Razorpay-Event-Id) is processed once; repeats are skipped.
//   3. payment.authorized / payment.captured / payment.failed / order.paid → the same
//      database step as the checkout callback (_svc_payment_apply), which only unlocks
//      a captured payment for the exact order amount, once.
//   4. refund.created / refund.processed / refund.failed → _svc_refund_apply.
//   5. Orders and payments that are not sharing campaigns are marketplace design purchases:
//      _svc_design_payment_apply / _svc_design_refund_payment (supabase/marketplace.sql).
//
// Deploy with JWT verification OFF (Razorpay has no Supabase login):
//   supabase functions deploy razorpay-webhook --no-verify-jwt
// Secrets: RAZORPAY_WEBHOOK_SECRET (the secret typed in Razorpay Dashboard → Webhooks).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// No imports, so it can be pasted straight into the dashboard editor.

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

const enc = new TextEncoder();
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(message: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(message)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// marketplace.sql not installed: the design step does not exist, so the event is not a design one.
// Any other error is thrown, so the event is not marked done and Razorpay retries it.
const notInstalled = (fallback: { result: string }) => (e: Error) => {
  if (/ 404 |PGRST202|does not exist/.test(String(e?.message))) return fallback;
  throw e;
};

const PAYMENT_EVENTS = ['payment.authorized', 'payment.captured', 'payment.failed', 'order.paid'];
const REFUND_EVENTS = ['refund.created', 'refund.processed', 'refund.failed'];

export async function handle(req: Request, env: Env, f: Fetch = fetch): Promise<Response> {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const SB = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const rpc = async (name: string, args: unknown) => {
    const r = await f(`${SB}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    const t = await r.text();
    if (!r.ok) throw new Error(`rpc ${name} ${r.status} ${t}`);
    return t ? JSON.parse(t) : null;   // functions that return nothing send an empty body
  };

  const raw = await req.text();   // the signature is over the exact bytes Razorpay sent
  const secret = env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret) return reply(503, { error: 'Webhook secret not configured.' });
  const sig = req.headers.get('x-razorpay-signature') || '';
  const valid = !!sig && safeEqual(await hmacHex(secret, raw), sig);
  let ev: any = null;
  try { ev = JSON.parse(raw); } catch { /* not JSON */ }
  const type = String(ev?.event || 'unknown');
  const eventId = req.headers.get('x-razorpay-event-id') || ('body-' + (await sha256Hex(raw)));

  try {
    if (!valid) {
      await rpc('_svc_webhook_seen', { p_provider: 'razorpay', p_event_id: 'invalid-' + eventId, p_type: type, p_valid: false, p_payload: null }).catch(() => {});
      return reply(400, { error: 'Invalid signature.' });
    }
    const fresh = await rpc('_svc_webhook_seen', { p_provider: 'razorpay', p_event_id: eventId, p_type: type, p_valid: true, p_payload: ev });
    if (!fresh) return reply(200, { ok: true, duplicate: true });

    let result = 'ignored';
    const pay = ev?.payload?.payment?.entity;
    const refund = ev?.payload?.refund?.entity;
    if (PAYMENT_EVENTS.includes(type) && pay?.order_id) {
      const r = await rpc('_svc_payment_apply', {
        p_provider: 'razorpay', p_provider_order_id: pay.order_id, p_via: 'webhook',
        p_payment: { id: pay.id, status: pay.status, amount: pay.amount, currency: pay.currency, method: pay.method || null,
                     error_code: pay.error_code || null, error_description: pay.error_description || null },
      });
      result = r.result;
      if (result === 'unknown_order') {   // not a sharing campaign: a marketplace design purchase?
        const d = await rpc('_svc_design_payment_apply', {
          p_provider: 'razorpay', p_provider_order_id: pay.order_id, p_via: 'webhook',
          p_payment: { id: pay.id, status: pay.status, amount: pay.amount, currency: pay.currency, fee: typeof pay.fee === 'number' ? pay.fee : null },
        }).catch(notInstalled({ result: 'unknown_order' }));
        result = 'design ' + d.result;
      }
    } else if (REFUND_EVENTS.includes(type) && refund?.payment_id) {
      const r = await rpc('_svc_refund_apply', { p_provider: 'razorpay', p_refund: { id: refund.id, payment_id: refund.payment_id, amount: refund.amount, status: refund.status } });
      result = 'refund ' + r.result;
      if (r.result === 'unknown_payment') {
        const d = await rpc('_svc_design_refund_payment', { p_provider: 'razorpay', p_refund: { id: refund.id, payment_id: refund.payment_id, amount: refund.amount, status: refund.status } })
          .catch(notInstalled({ result: 'unknown_payment' }));
        result = 'design refund ' + d.result;
      }
    }
    await rpc('_svc_webhook_done', { p_provider: 'razorpay', p_event_id: eventId, p_result: result });
    return reply(200, { ok: true, result });
  } catch (e) {
    console.error(e);
    return reply(500, { error: 'Could not process the event; Razorpay will retry.' });   // not marked done, so the retry is processed
  }
}

// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno;
if (D?.serve) D.serve((req: Request) => handle(req, D.env.toObject()));
