// stripe-webhook: records a payment when Checkout completes.
//
// Stripe calls this endpoint directly (not the browser), so it verifies the
// Stripe signature and then writes the payment row with the service role, which
// bypasses RLS. This is the production-shaped path the schema comments pointed
// to: money-of-record is written by the webhook, not the client.
//
// Secrets required:
//   STRIPE_SECRET_KEY        sk_test_...
//   STRIPE_WEBHOOK_SECRET    whsec_...  (from `stripe listen` or the dashboard)
//
// Deploy without JWT verification so Stripe can reach it:
//   supabase functions deploy stripe-webhook --no-verify-jwt

import Stripe from "https://esm.sh/stripe@17.3.1?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, secret, undefined, cryptoProvider);
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${String(e?.message ?? e)}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const m = session.metadata ?? {};
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await admin.from("payments").insert({
      payer_id: m.payer_id ?? null,
      payee_bartender_id: m.bartender_id ?? null,
      kind: m.kind ?? "tip",
      amount_cents: Number(m.amount_cents ?? session.amount_total ?? 0),
      platform_fee_cents: Number(m.platform_fee_cents ?? 0),
      status: "succeeded",
      stripe_ref: typeof session.payment_intent === "string" ? session.payment_intent : null,
      stripe_session_id: session.id,
    });
    if (error) return new Response(`DB insert failed: ${error.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
