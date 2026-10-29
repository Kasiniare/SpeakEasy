// create-checkout: starts a Stripe Checkout Session for a tip or subscription.
//
// Runs server-side only. Verifies the caller from their Supabase JWT, looks up
// the bartender's Connect account with the service role, and creates a test-mode
// Checkout Session. If the bartender has a Connect account, the charge is a
// destination charge with an application fee (money goes to the bartender, the
// platform keeps a cut). If not, it falls back to a plain platform charge so the
// flow can be smoke-tested before Connect onboarding.
//
// Secrets required (supabase secrets set ...):
//   STRIPE_SECRET_KEY        test-mode secret (sk_test_...)
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY

import Stripe from "https://esm.sh/stripe@17.3.1?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "../_shared/cors.ts";

const PLATFORM_FEE_BPS = 800; // 8%

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { bartenderId, amountCents, kind = "tip", returnUrl } = await req.json();
    if (!bartenderId || !amountCents || amountCents < 100) {
      return json({ error: "bartenderId and amountCents (>= 100) are required" }, 400);
    }

    // Identify the caller from their JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "not authenticated" }, 401);

    // Look up the bartender with the service role (read stripe_account_id).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: bartender, error: bErr } = await admin
      .from("bartender_profiles")
      .select("id, display_name, stripe_account_id")
      .eq("id", bartenderId)
      .single();
    if (bErr || !bartender) return json({ error: "bartender not found" }, 404);

    const fee = Math.round((amountCents * PLATFORM_FEE_BPS) / 10000);
    const origin = returnUrl || req.headers.get("origin") || "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${kind === "tip" ? "Tip" : "Payment"} for ${bartender.display_name}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      // Destination charge only when the bartender has onboarded to Connect.
      payment_intent_data: bartender.stripe_account_id
        ? { application_fee_amount: fee, transfer_data: { destination: bartender.stripe_account_id } }
        : undefined,
      success_url: `${origin}?paid=1`,
      cancel_url: `${origin}?canceled=1`,
      metadata: {
        kind,
        payer_id: user.id,
        bartender_id: bartenderId,
        amount_cents: String(amountCents),
        platform_fee_cents: String(bartender.stripe_account_id ? fee : 0),
      },
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
