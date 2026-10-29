# Stripe test-mode setup

This wires tips (and later subscriptions) through Stripe Connect so money lands
with the bartender, with the platform keeping a fee. Everything here is
**test mode**: no real money moves, and you only owe Stripe anything once you
switch to live keys after launch.

Nothing in the browser ever touches a Stripe secret. The two Edge Functions run
server-side:

- `create-checkout` builds a Checkout Session and returns its URL.
- `stripe-webhook` records the payment (service role) when Checkout completes.

Until these are deployed, the app's Tip button falls back to recording a demo
payment row, so the UI keeps working.

## One-time setup

1. **Stripe account.** Create one at https://dashboard.stripe.com. Stay in
   **Test mode** (toggle, top right). Copy the **Secret key** (`sk_test_...`)
   from Developers, API keys.

2. **Enable Connect.** In the Stripe dashboard, go to Connect and enable it
   (test). This is what lets the platform pay bartenders. You can skip this for
   a first smoke test: with no Connect account on a bartender, the charge just
   goes to your platform test balance.

3. **Apply migration 0003.** In the Supabase SQL editor, run
   `supabase/migrations/0003_stripe.sql`.

4. **Install the Supabase CLI** (one time): https://supabase.com/docs/guides/cli
   Then from the repo root:
   ```
   supabase login
   supabase link --project-ref vyzfhohkndqexwojdbdq
   ```

5. **Set the function secrets:**
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
   ```
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
   injected automatically, do not set them.)

6. **Deploy the functions:**
   ```
   supabase functions deploy create-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
   The `--no-verify-jwt` on the webhook lets Stripe reach it; it is protected by
   the Stripe signature instead.

7. **Register the webhook.** In Stripe, Developers, Webhooks, add an endpoint:
   ```
   https://vyzfhohkndqexwojdbdq.supabase.co/functions/v1/stripe-webhook
   ```
   Subscribe to the event `checkout.session.completed`. Copy the signing secret
   (`whsec_...`) it gives you, then:
   ```
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
   (Local alternative: `stripe listen --forward-to <that URL>` prints a
   `whsec_` to use instead.)

## Testing it

- In the app, sign in as a patron approved to a bartender and tap Tip. You are
  redirected to Stripe Checkout. Pay with the test card `4242 4242 4242 4242`,
  any future expiry, any CVC.
- You land back on the app with `?paid=1`. The webhook records the payment;
  check the `payments` table, or Remy's revenue metric.

## Paying bartenders directly (Connect)

To make a tip actually route to a bartender instead of the platform balance,
give that bartender a test Connect account id:

1. Create a test connected account (Stripe dashboard, Connect, or the API) and
   complete its test onboarding so charges and transfers are enabled.
2. Set it on the bartender:
   ```sql
   update bartender_profiles
     set stripe_account_id = 'acct_xxx'
     where handle = 'remypours';
   ```

Now `create-checkout` uses a destination charge with an 8% application fee: the
bartender receives the tip minus the fee, the platform keeps the fee. With no
`stripe_account_id`, it stays a plain platform charge so you can test the plumbing
first.

## Note

These functions were written against the documented Stripe + Supabase patterns
but have not been run against a live Stripe account from here. If a deploy or a
charge errors, send the exact message and we will adjust.
