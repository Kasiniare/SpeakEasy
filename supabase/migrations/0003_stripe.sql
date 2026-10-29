-- Speakeasy migration 0003: Stripe fields
--
-- Adds just enough to support Stripe Connect payouts and webhook-recorded
-- payments. Real money movement happens only in Edge Functions using the
-- service role and the Stripe secret key, never in the browser.

-- The bartender's Stripe Connect account id (acct_...). Null until they
-- onboard. When null, the create-checkout function falls back to a plain
-- platform charge so the flow can be smoke-tested before Connect onboarding.
alter table bartender_profiles
  add column if not exists stripe_account_id text;

-- Payment lifecycle. The webhook flips a row to 'succeeded' on
-- checkout.session.completed.
do $$ begin
  create type payment_status as enum ('pending','succeeded','failed','refunded');
exception when duplicate_object then null; end $$;

alter table payments
  add column if not exists status payment_status not null default 'succeeded',
  add column if not exists platform_fee_cents int not null default 0,
  add column if not exists stripe_session_id text;

-- The webhook writes with the service role, which bypasses RLS. No new read
-- policy is needed: payments_party_select from migration 0001 still limits
-- reads to the payer and the payee bartender.
