# Speakeasy, build state

Last updated: 2026-10-30. This is the resume-from-here doc. It records what
exists, how it is wired, how to run it, and what is still open.

## What Speakeasy is

A privacy-first platform where bar patrons follow trusted bartenders across
venues and shifts. The bartender is the priority user: they control who follows
them, what each subscription tier unlocks, and whether a bar ever sees their
schedule. The differentiator is gated, permissioned membership (OnlyFans or
Patreon style) with privacy enforced in the database, not the interface.

Three roles, one backend:
- Bartender: owns profile, tiers, shifts, posts, metrics, decides on followers
  and on bar visibility requests.
- Patron: discovers bartenders, requests a tier, gets approved, sees only what
  that tier unlocks, tips directly.
- Bar: sees banded talent signals only, requests shift visibility (optionally
  paying for it), sends offers. Never sees schedules, patron identities, or
  revenue without an explicit grant.

## Where it lives

- Repo: https://github.com/Kasiniare/SpeakEasy (branch: main, this is canonical)
- Live app: https://speakeasy-lovat.vercel.app
- Supabase project ref: vyzfhohkndqexwojdbdq
- Hosting: Vercel (auto-deploys on every push to main)

## Stack

- Frontend: React 18 + Vite. One web app serving all three roles. Deployed as a
  static build to Vercel.
- Backend: Supabase (Postgres database, Auth, Row Level Security). Free tier.
- Payments: Stripe Connect, test mode. Code committed, not yet deployed. See
  STRIPE.md.

Note on "web" vs "mobile": this is one responsive web app. It adapts by
viewport width (a useViewport hook, since the UI uses inline styles): on desktop
the patron view is a two-column discover-plus-detail layout and metric grids are
four wide; on phones everything collapses to a single column. A true native
mobile app (iOS/Android) would be a separate client (React Native / Expo or a
PWA) pointed at the same Supabase backend. Because the backend is shared, any
web client and any mobile client sync automatically through one source of truth,
with RLS applying identically to each.

## The privacy model (the spine)

RLS (Row Level Security) is Postgres deciding, row by row, who may read or write
what. Every table has RLS enabled, and a table with RLS on and no matching
policy denies everything. So the baseline is default-deny: access exists only
where a policy opens a specific door.

Key guarantees, all enforced in the database:
- A shift is visible to a non-owner only if it is public, the viewer holds an
  approved subscription at a high enough tier, or the viewer's bar holds an
  active, non-revoked grant. A private shift matches none of these.
- Bars cannot read patron_profiles at all (no policy grants it), so patron
  identities never reach a bar.
- Only the owning bartender can read their metrics row (revenue, traffic, exact
  followers). Bars read a separate, classified table of shareable signals only.
- A bar can insert a visibility request only in the 'requested' state; only the
  bartender can move it to 'granted' or 'revoked'. A bar cannot approve itself.
- A patron can move their own subscription only to 'pending' or 'canceled',
  never to an access-granting status. Only the bartender approves.

Cross-table checks run through SECURITY DEFINER helper functions
(app_current_bartender_id, app_is_bar_member, app_has_member_access,
app_bar_can_see_shifts) so policy evaluation does not recurse into the RLS it
enforces.

## Data model (tables)

profiles, bartender_profiles, patron_profiles, bar_accounts, bar_members,
venues, tiers, subscriptions, shifts, posts, grants, patron_flags, offers,
payments, metrics, bartender_signals_pub. Plus the view bartender_signals.

Full definitions and every policy are in supabase/migrations/.

## Migrations (apply in order, in the Supabase SQL editor)

- 0001_init_schema_rls.sql: schema, helper functions, all RLS policies.
- 0002_subscription_upgrade.sql: patron upgrade/re-request path, tier-ownership
  tightening.
- 0003_stripe.sql: stripe_account_id on bartenders, payment status/fee fields.
- 0004_signals_separation.sql: splits shareable signals from private metrics;
  replaces the SECURITY DEFINER view with a SECURITY INVOKER view over an
  RLS-protected table (resolves the Supabase advisor finding).
- 0005_avatars_media.sql: avatar_url on the three profile tables; a media table
  (photo/video gallery) with owner-only write and audience-aware read RLS; two
  public Storage buckets (avatars, media) with owner-folder write policies.
  0001-0004 are applied to the live project; apply 0005 to enable avatars and
  galleries.

To apply a migration: open the file, copy its contents (not the path), paste
into the SQL editor, Run. Schema changes report success with no rows.

## Seed data and demo accounts

supabase/seed.sql populates the prototype cast. Every account password is
`speakeasy-demo`.
- remy@speakeasy.test, bartender, has tiers, shifts across all scopes, metrics,
  a pending bar request from The Gilded Owl.
- alex@speakeasy.test, patron, approved at Inner Circle.
- owl@speakeasy.test, bar (The Gilded Owl).
- marcus@speakeasy.test, patron, Top Shelf. nadia@ and julia@, bartenders.
  sam@ (pending), chad@ (demoted, flagged).

## Environment variables (Vercel, and local .env)

- VITE_SUPABASE_URL = https://vyzfhohkndqexwojdbdq.supabase.co  (bare URL, no
  trailing path)
- VITE_SUPABASE_ANON_KEY = the publishable/anon key (safe in the browser; RLS is
  the guard, not key secrecy). Never put the service_role or secret key here.

## Running it

Deployed: just open the live URL. Pushes to main auto-deploy.

Local:
1. git clone https://github.com/Kasiniare/SpeakEasy && cd SpeakEasy
2. copy .env.example to .env, fill the two VITE_ vars above
3. npm install && npm run dev

## Stripe (test mode, not yet deployed)

Two Supabase Edge Functions are written and committed:
- create-checkout: builds a Stripe Checkout Session. Destination charge with an
  8% application fee when the bartender has a Connect account, else a plain
  platform charge.
- stripe-webhook: records the payment via the service role on
  checkout.session.completed.

The app's Tip button works today: if the functions are not deployed it records a
demo payment and says so; once deployed it redirects to real Checkout. Full
setup runbook is in STRIPE.md. These functions have not been run against a live
Stripe account yet.

## Known limitations and open items

- Stripe functions are unproven against live Stripe; deploy and test per
  STRIPE.md.
- Identity verification is a boolean only; no provider (Stripe Identity /
  Persona) wired.
- Patron flags are visible to bartenders but not to the flagged patron. Product
  decision to confirm before launch.
- Seed inserts directly into auth.users, which works but is dev-shaped; real
  users should be created through Auth.
- Media storage buckets are public-read in this PoC, so the raw file bytes are
  reachable by anyone with the URL; the media table RLS gates listing only.
  Production should use a private bucket with signed URLs. Media is also not yet
  tier-gated (gallery is visible to anyone who can see the bartender).
- Loyalty program mechanics and advertising/campaign targeting are modeled in
  the architecture spec but not built.
- No automated tests yet.
- Name: "Speakeasy" is a common word. Trademark/App Store search recommended
  before committing to the name.

## Suggested next steps

- Deploy and test the Stripe path.
- Realtime: Supabase Realtime can push live updates (a new follower approval, a
  granted shift) to any connected client without a refresh.
- Later: a native mobile client (Expo) against the same backend.
