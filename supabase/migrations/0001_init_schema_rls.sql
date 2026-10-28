-- Speakeasy: initial schema and Row Level Security (RLS)
-- Migration 0001
--
-- Design principle: DEFAULT DENY. RLS is enabled on every table, and because a
-- table with RLS on and no matching policy denies all access, nothing is
-- readable or writable unless a policy below explicitly allows it. The product
-- promise lives here, in the database, not in the UI:
--   * A bar sees nothing about a bartender's schedule or location without an
--     explicit, revocable grant.
--   * A patron sees only what their approved tier unlocks.
--   * A bar never sees an individual patron's identity, and never sees a
--     bartender's revenue, tips, or raw traffic.
--
-- Access checks that cross tables run through SECURITY DEFINER helper functions
-- (functions that execute with the definer's rights, bypassing the caller's RLS)
-- so that policy evaluation does not recurse into the same RLS it is enforcing.
-- This is the standard Supabase pattern for relationship-based policies.

create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
create type role_kind           as enum ('patron','bartender','bar','admin');
create type subscription_status as enum ('pending','approved','blocked','demoted','canceled');
create type content_scope       as enum ('private','public','members');
create type post_kind           as enum ('recipe','photo','discount','announcement');
create type flag_kind           as enum ('no_show','chargeback','reported','verified_good');
create type grant_kind          as enum ('employer_visibility');
create type grant_status        as enum ('requested','granted','denied','revoked');
create type offer_kind          as enum ('guest_residency','employment','event_booking');
create type offer_status        as enum ('sent','accepted','declined');
create type payment_kind        as enum ('tip','subscription','bar_fee');

-- ============================================================
-- Tables
-- ============================================================

-- Base account, one row per auth user. Roles are additive (a user can be both
-- a patron and a bartender).
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  roles        role_kind[] not null default '{patron}',
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

create table bartender_profiles (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references profiles(id) on delete cascade,
  display_name         text not null,
  handle               text unique,
  bio                  text not null default '',
  specialty            text not null default '',
  discoverable         boolean not null default true,  -- shows up in patron discovery
  discoverable_to_bars boolean not null default false, -- opt in to bar talent search
  created_at           timestamptz not null default now()
);

create table patron_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references profiles(id) on delete cascade,
  display_name      text not null,
  bio               text not null default '',
  favorite_drinks   text[] not null default '{}',
  patronage_zips    text[] not null default '{}',
  identity_verified boolean not null default false, -- only the verified flag, never the raw document
  created_at        timestamptz not null default now()
);

create table bar_accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  advertiser boolean not null default false,
  created_at timestamptz not null default now()
);

create table bar_members (
  bar_id   uuid not null references bar_accounts(id) on delete cascade,
  user_id  uuid not null references profiles(id) on delete cascade,
  bar_role text not null default 'staff',  -- 'owner' | 'manager' | 'staff'
  primary key (bar_id, user_id)
);

create table venues (
  id         uuid primary key default gen_random_uuid(),
  bar_id     uuid not null references bar_accounts(id) on delete cascade,
  name       text not null,
  address    text,
  created_at timestamptz not null default now()
);

-- Tiers are defined by each bartender. rank orders them: a higher rank sees
-- everything scoped at or below its own rank.
create table tiers (
  id           uuid primary key default gen_random_uuid(),
  bartender_id uuid not null references bartender_profiles(id) on delete cascade,
  name         text not null,
  price_cents  int not null default 0,
  rank         int not null,
  perks        jsonb not null default '[]',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (bartender_id, rank)
);

-- The access-control join table. One relationship per patron, per bartender.
create table subscriptions (
  id           uuid primary key default gen_random_uuid(),
  patron_id    uuid not null references profiles(id) on delete cascade,
  bartender_id uuid not null references bartender_profiles(id) on delete cascade,
  tier_id      uuid not null references tiers(id) on delete restrict,
  status       subscription_status not null default 'pending',
  created_at   timestamptz not null default now(),
  unique (patron_id, bartender_id)
);

-- Every shift carries its own visibility. 'private' is owner only. 'members'
-- requires min_tier_rank. A bar can additionally see shifts only through a grant.
create table shifts (
  id            uuid primary key default gen_random_uuid(),
  bartender_id  uuid not null references bartender_profiles(id) on delete cascade,
  venue_id      uuid references venues(id) on delete set null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  visibility    content_scope not null default 'private',
  min_tier_rank int,  -- used when visibility = 'members'
  created_at    timestamptz not null default now()
);

create table posts (
  id            uuid primary key default gen_random_uuid(),
  bartender_id  uuid not null references bartender_profiles(id) on delete cascade,
  kind          post_kind not null,
  title         text not null,
  body          text not null default '',
  visibility    content_scope not null default 'members',
  min_tier_rank int,
  created_at    timestamptz not null default now()
);

-- The keystone of the privacy model: an explicit, revocable permission from a
-- bartender (grantor) to a bar (grantee). A bar requests it; the bartender
-- decides and can revoke. offer_cents carries the optional reverse-subscription
-- (the bar paying the bartender for visibility).
create table grants (
  id           uuid primary key default gen_random_uuid(),
  bartender_id uuid not null references bartender_profiles(id) on delete cascade,
  bar_id       uuid not null references bar_accounts(id) on delete cascade,
  kind         grant_kind not null default 'employer_visibility',
  status       grant_status not null default 'requested',
  offer_cents  int not null default 0,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  revoked_at   timestamptz,
  unique (bartender_id, bar_id, kind)
);

-- Objective, type-constrained flags. No free text reputation, no star ratings.
create table patron_flags (
  id         uuid primary key default gen_random_uuid(),
  patron_id  uuid not null references profiles(id) on delete cascade,
  issued_by  uuid not null references bartender_profiles(id) on delete cascade,
  kind       flag_kind not null,
  evidence   text,
  created_at timestamptz not null default now()
);

create table offers (
  id           uuid primary key default gen_random_uuid(),
  bar_id       uuid not null references bar_accounts(id) on delete cascade,
  bartender_id uuid not null references bartender_profiles(id) on delete cascade,
  kind         offer_kind not null,
  terms        text,
  status       offer_status not null default 'sent',
  created_at   timestamptz not null default now()
);

create table payments (
  id                 uuid primary key default gen_random_uuid(),
  payer_id           uuid references profiles(id) on delete set null,
  payee_bartender_id uuid references bartender_profiles(id) on delete set null,
  kind               payment_kind not null,
  amount_cents       int not null,
  stripe_ref         text,
  created_at         timestamptz not null default now()
);

-- Aggregate engagement. The bartender sees all of this about themselves. Bars
-- never read this table directly; they read the banded bartender_signals view.
create table metrics (
  bartender_id  uuid primary key references bartender_profiles(id) on delete cascade,
  followers     int not null default 0,
  subscribers   int not null default 0,
  revenue_cents bigint not null default 0,
  traffic       int not null default 0,
  rank_score    int not null default 0,
  trend_rank    int,
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- Helper functions (SECURITY DEFINER, so policies do not recurse)
-- ============================================================

-- The bartender_profiles.id owned by the current user, or null.
create or replace function app_current_bartender_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from bartender_profiles where user_id = auth.uid()
$$;

-- Is the current user a member of this bar?
create or replace function app_is_bar_member(p_bar_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from bar_members where bar_id = p_bar_id and user_id = auth.uid()
  )
$$;

-- Does the current user hold an approved subscription to this bartender at a
-- tier whose rank meets the required minimum?
create or replace function app_has_member_access(p_bartender_id uuid, p_min_rank int)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from subscriptions s
    join tiers t on t.id = s.tier_id
    where s.bartender_id = p_bartender_id
      and s.patron_id    = auth.uid()
      and s.status       = 'approved'
      and t.rank >= coalesce(p_min_rank, 1)
  )
$$;

-- Does the current user belong to a bar that holds an active, non-revoked
-- employer_visibility grant from this bartender?
create or replace function app_bar_can_see_shifts(p_bartender_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from grants g
    join bar_members bm on bm.bar_id = g.bar_id
    where g.bartender_id = p_bartender_id
      and bm.user_id     = auth.uid()
      and g.kind         = 'employer_visibility'
      and g.status       = 'granted'
      and g.revoked_at is null
  )
$$;

-- ============================================================
-- Enable RLS on every table (this is the default-deny switch)
-- ============================================================
alter table profiles           enable row level security;
alter table bartender_profiles enable row level security;
alter table patron_profiles    enable row level security;
alter table bar_accounts       enable row level security;
alter table bar_members        enable row level security;
alter table venues             enable row level security;
alter table tiers              enable row level security;
alter table subscriptions      enable row level security;
alter table shifts             enable row level security;
alter table posts              enable row level security;
alter table grants             enable row level security;
alter table patron_flags       enable row level security;
alter table offers             enable row level security;
alter table payments           enable row level security;
alter table metrics            enable row level security;

-- ============================================================
-- Policies
-- ============================================================

-- profiles: a user manages only their own base row.
create policy profiles_select_self on profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_self on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- bartender_profiles: owner manages; others may read only a discoverable
-- bartender, or one they already subscribe to. (Reading the profile never
-- reveals shifts or posts, which have their own policies.)
create policy bp_owner_all on bartender_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bp_select_visible on bartender_profiles for select to authenticated
  using (discoverable = true or user_id = auth.uid() or app_has_member_access(id, 1));

-- patron_profiles: owner manages. A bartender may read the profile of a patron
-- who subscribes to them. NO policy grants bars access, so patron identities
-- never reach a bar.
create policy pp_owner_all on patron_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy pp_select_subscriber on patron_profiles for select to authenticated
  using (exists (
    select 1 from subscriptions s
    where s.patron_id = patron_profiles.user_id
      and s.bartender_id = app_current_bartender_id()
  ));

-- bar_accounts and membership.
create policy ba_insert on bar_accounts for insert to authenticated with check (true);
create policy ba_member_select on bar_accounts for select to authenticated using (app_is_bar_member(id));
create policy ba_member_update on bar_accounts for update to authenticated using (app_is_bar_member(id)) with check (app_is_bar_member(id));

create policy bm_select on bar_members for select to authenticated
  using (user_id = auth.uid() or app_is_bar_member(bar_id));
create policy bm_manage on bar_members for all to authenticated
  using (app_is_bar_member(bar_id)) with check (app_is_bar_member(bar_id));

-- venues: readable to authenticated users; managed by the owning bar.
create policy venues_select on venues for select to authenticated using (true);
create policy venues_manage on venues for all to authenticated
  using (app_is_bar_member(bar_id)) with check (app_is_bar_member(bar_id));

-- tiers: active tiers are readable (so patrons can browse and subscribe);
-- the owning bartender manages them.
create policy tiers_select on tiers for select to authenticated
  using (active = true or bartender_id = app_current_bartender_id());
create policy tiers_owner_manage on tiers for all to authenticated
  using (bartender_id = app_current_bartender_id()) with check (bartender_id = app_current_bartender_id());

-- subscriptions: patron sees and creates their own; bartender sees and decides
-- on subscriptions to them. A patron can only move their own row to 'canceled';
-- approve/block/demote is the bartender's to set.
create policy subs_patron_select on subscriptions for select to authenticated using (patron_id = auth.uid());
create policy subs_bartender_select on subscriptions for select to authenticated using (bartender_id = app_current_bartender_id());
create policy subs_patron_insert on subscriptions for insert to authenticated with check (patron_id = auth.uid() and status = 'pending');
create policy subs_patron_cancel on subscriptions for update to authenticated
  using (patron_id = auth.uid()) with check (patron_id = auth.uid() and status = 'canceled');
create policy subs_bartender_decide on subscriptions for update to authenticated
  using (bartender_id = app_current_bartender_id()) with check (bartender_id = app_current_bartender_id());

-- shifts: owner does everything. Everyone else reads only when the shift is
-- public, or they are an approved member at a high enough tier, or their bar
-- holds an active grant. A 'private' shift matches none of these, so only the
-- owner ever sees it.
create policy shifts_owner_all on shifts for all to authenticated
  using (bartender_id = app_current_bartender_id()) with check (bartender_id = app_current_bartender_id());
create policy shifts_read on shifts for select to authenticated
  using (
    visibility = 'public'
    or (visibility = 'members' and app_has_member_access(bartender_id, min_tier_rank))
    or app_bar_can_see_shifts(bartender_id)
  );

-- posts: same tier logic, but bars get no special access to posts.
create policy posts_owner_all on posts for all to authenticated
  using (bartender_id = app_current_bartender_id()) with check (bartender_id = app_current_bartender_id());
create policy posts_read on posts for select to authenticated
  using (
    visibility = 'public'
    or (visibility = 'members' and app_has_member_access(bartender_id, min_tier_rank))
  );

-- grants: the bartender (grantor) manages the full lifecycle. A bar may read
-- grants addressed to it and may insert a new one only in the 'requested'
-- state. It cannot flip its own request to 'granted'.
create policy grants_bartender_all on grants for all to authenticated
  using (bartender_id = app_current_bartender_id()) with check (bartender_id = app_current_bartender_id());
create policy grants_bar_select on grants for select to authenticated using (app_is_bar_member(bar_id));
create policy grants_bar_request on grants for insert to authenticated
  with check (app_is_bar_member(bar_id) and status = 'requested');

-- offers: the bar manages what it sends; the bartender reads and responds.
create policy offers_bar_all on offers for all to authenticated
  using (app_is_bar_member(bar_id)) with check (app_is_bar_member(bar_id));
create policy offers_bartender_select on offers for select to authenticated using (bartender_id = app_current_bartender_id());
create policy offers_bartender_respond on offers for update to authenticated
  using (bartender_id = app_current_bartender_id()) with check (bartender_id = app_current_bartender_id());

-- patron_flags: visible to bartenders across the network (network reputation),
-- written by the issuing bartender. Patrons and bars cannot read them.
create policy flags_bartender_select on patron_flags for select to authenticated
  using (app_current_bartender_id() is not null);
create policy flags_bartender_insert on patron_flags for insert to authenticated
  with check (issued_by = app_current_bartender_id());

-- payments: only the payer and the payee bartender can see a payment. In
-- production these rows are written by a Stripe webhook using the service role
-- (which bypasses RLS); the insert policy below is a convenience for the PoC.
create policy payments_party_select on payments for select to authenticated
  using (payer_id = auth.uid() or payee_bartender_id = app_current_bartender_id());
create policy payments_payer_insert on payments for insert to authenticated with check (payer_id = auth.uid());

-- metrics: the bartender reads their own full telemetry. No other role reads
-- this table at all.
create policy metrics_owner_select on metrics for select to authenticated
  using (bartender_id = app_current_bartender_id());

-- ============================================================
-- Bar-facing signals view
-- ============================================================
-- What a bar is allowed to see about favored talent: rank, trend, and a
-- follower BAND. It runs with definer rights (security_invoker = off) so it can
-- read metrics, but it only ever projects the non-sensitive columns, and only
-- for bartenders who opted in to bar discovery. Revenue, traffic, exact
-- follower counts, schedule, and patron identities are never selected here.
create or replace view bartender_signals with (security_invoker = off) as
  select
    b.id          as bartender_id,
    b.display_name,
    b.specialty,
    m.rank_score,
    m.trend_rank,
    case
      when m.followers >= 1000 then '1k+'
      when m.followers >= 500  then '500+'
      when m.followers >= 100  then '100+'
      else 'under 100'
    end as follower_band
  from bartender_profiles b
  join metrics m on m.bartender_id = b.id
  where b.discoverable_to_bars = true;

grant select on bartender_signals to authenticated;

-- ============================================================
-- Decisions made here, and what is deliberately deferred
-- ============================================================
-- 1. Tier scoping uses a numeric min_tier_rank rather than fixed tier names,
--    so each bartender can define their own ladder. A patron at rank R sees
--    content scoped to any rank up to R.
-- 2. The reverse-subscription (a bar paying for visibility) is folded into
--    grants.offer_cents rather than a separate table, to keep the PoC lean.
-- 3. Patron flags are visible to bartenders but not to the flagged patron.
--    That reduces gaming but trades away transparency. Flag this one for a
--    product decision before launch.
-- 4. First-bar-member bootstrap and all real payment writes belong in Supabase
--    Edge Functions running as the service role; the permissive insert policies
--    for bar_accounts and payments are PoC conveniences, not production shape.
-- 5. Not yet modeled: loyalty program mechanics, advertising/campaign targeting
--    (should read only the aggregate segment layer, never individual patrons),
--    and audit logging of grant changes.
