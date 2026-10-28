# Speakeasy

A privacy-first platform where bar patrons follow trusted bartenders across venues and shifts. The bartender is the priority user: they control who follows them, what each tier unlocks, and whether a bar ever sees their schedule.

The core idea is enforced in the database, not the interface. Row Level Security (RLS) policies make the privacy model a property of Postgres: default deny, and access only where an explicit relationship or grant exists.

## What is here

```
supabase/
  migrations/0001_init_schema_rls.sql   schema + RLS policies (the privacy core)
  seed.sql                              demo data for all three roles
src/
  lib/supabase.js                       Supabase client
  lib/queries.js                        data-access layer (thin queries; RLS enforces)
  App.jsx                               live harness: sign in as any role, watch RLS act
```

## Running it (free, no card required)

1. Create a free Supabase project at https://supabase.com. The free plan is $0 and needs no payment method on file.
2. In the project's SQL editor, run `supabase/migrations/0001_init_schema_rls.sql`, then run `supabase/seed.sql`.
   (Or, with the Supabase CLI and local dev: `supabase start` then `supabase db reset`, which applies migrations and seed automatically.)
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Project Settings, API.
4. Install and run:
   ```
   npm install
   npm run dev
   ```

## Trying the privacy model

Every seeded account uses the password `speakeasy-demo`.

- Sign in as **Alex (patron)**. Alex is approved at Inner Circle, so the Inner Circle and Regulars shifts show, the private shift never appears, and Top Shelf content stays hidden.
- Sign in as **The Gilded Owl (bar)**. You see banded talent signals only. Press "Try to read shifts" on Remy and it returns zero rows, because the bar's visibility request is still pending. Grant it as Remy, come back, and the shifts appear.
- Sign in as **Remy (bartender)**. Approve Sam's pending request, re-scope a shift, grant the Owl's request, and read your full metrics (a row no other role can read).

The client never checks permissions. It asks, and the database answers within the policies in `0001_init_schema_rls.sql`.

## Not yet wired

- Payments run as direct inserts for the demo. Production writes tips and subscriptions through a Stripe webhook using the service role.
- Identity verification stores only a verified flag; the provider integration is not built.
- The richer three-pane prototype UI can be ported onto this data layer; `queries.js` already covers the operations it needs.
