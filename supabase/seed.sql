-- Speakeasy seed data
-- Runs after migrations on `supabase db reset`. Populates the same cast as the
-- prototypes so the three roles have real rows and the RLS policies in
-- migration 0001 can be exercised end to end.
--
-- Note on auth.users: these direct inserts work for local Supabase dev. Against
-- a hosted project, create the users through the Auth admin API or Studio
-- instead, then keep the domain rows below. Demo password for every account is
-- 'speakeasy-demo'.

-- ------------------------------------------------------------
-- Auth users
-- ------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','remy@speakeasy.test',  crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','',''),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','alex@speakeasy.test',  crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','',''),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','owl@speakeasy.test',   crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','',''),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','nadia@speakeasy.test', crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','',''),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','julia@speakeasy.test', crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','',''),
  ('00000000-0000-0000-0000-000000000000','66666666-6666-6666-6666-666666666666','authenticated','authenticated','marcus@speakeasy.test',crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','',''),
  ('00000000-0000-0000-0000-000000000000','77777777-7777-7777-7777-777777777777','authenticated','authenticated','sam@speakeasy.test',   crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','',''),
  ('00000000-0000-0000-0000-000000000000','88888888-8888-8888-8888-888888888888','authenticated','authenticated','chad@speakeasy.test',  crypt('speakeasy-demo', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,'','','','');

-- ------------------------------------------------------------
-- Profiles (roles are additive)
-- ------------------------------------------------------------
insert into profiles (id, roles, display_name) values
  ('11111111-1111-1111-1111-111111111111','{bartender}','Remy Laurent'),
  ('22222222-2222-2222-2222-222222222222','{patron}','Alex Rivera'),
  ('33333333-3333-3333-3333-333333333333','{bar}','Gilded Owl Ops'),
  ('44444444-4444-4444-4444-444444444444','{bartender}','Nadia Osei'),
  ('55555555-5555-5555-5555-555555555555','{bartender}','Julia Reyes'),
  ('66666666-6666-6666-6666-666666666666','{patron}','Marcus D.'),
  ('77777777-7777-7777-7777-777777777777','{patron}','Sam W.'),
  ('88888888-8888-8888-8888-888888888888','{patron}','Chad B.');

-- ------------------------------------------------------------
-- Bartender profiles
-- ------------------------------------------------------------
insert into bartender_profiles (id, user_id, display_name, handle, bio, specialty, discoverable, discoverable_to_bars) values
  ('b0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Remy Laurent','remypours','Negroni evangelist. I save the good stuff for my regulars.','Barrel-aged classics, Mezcal', true, true),
  ('b0000000-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444','Nadia Osei','nadiashakes','Rum flights and a tiki bar that travels.','Tiki, Rum flights', true, true),
  ('b0000000-0000-0000-0000-000000000003','55555555-5555-5555-5555-555555555555','Julia Reyes','julpours','Agave first. Spice on request.','Agave, Spicy margs', true, false);

-- ------------------------------------------------------------
-- Patron profiles (only where we need profile detail / subscriber visibility)
-- ------------------------------------------------------------
insert into patron_profiles (user_id, display_name, bio, favorite_drinks, patronage_zips, identity_verified) values
  ('22222222-2222-2222-2222-222222222222','Alex Rivera','Cocktail nerd, terrible at darts.', '{"Negroni","Mezcal sour","Espresso martini"}', '{"10003","11211"}', true),
  ('66666666-6666-6666-6666-666666666666','Marcus D.','Top Shelf regular.', '{"Old Fashioned"}', '{"10003"}', true);

-- ------------------------------------------------------------
-- Bars, members, venues
-- ------------------------------------------------------------
insert into bar_accounts (id, name, advertiser) values
  ('ba000000-0000-0000-0000-000000000001','The Gilded Owl', true),
  ('ba000000-0000-0000-0000-000000000002','Velvet & Rye', false);

insert into bar_members (bar_id, user_id, bar_role) values
  ('ba000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','owner');

insert into venues (id, bar_id, name, address) values
  ('be000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','The Gilded Owl','Downtown'),
  ('be000000-0000-0000-0000-000000000002','ba000000-0000-0000-0000-000000000002','Velvet & Rye','Eastside'),
  ('be000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000002','Rooftop No. 9 (pop-up)','Riverside');

-- ------------------------------------------------------------
-- Remy's tiers (rank orders them; higher rank sees everything below)
-- ------------------------------------------------------------
insert into tiers (id, bartender_id, name, price_cents, rank, perks, active) values
  ('70000000-0000-0000-0000-000000000011','b0000000-0000-0000-0000-000000000001','Regulars',    500, 1, '["Shift calendar","Members-only posts"]', true),
  ('70000000-0000-0000-0000-000000000012','b0000000-0000-0000-0000-000000000001','Inner Circle',1500,2, '["Everything in Regulars","Exclusive recipes","Reserved seat requests"]', true),
  ('70000000-0000-0000-0000-000000000013','b0000000-0000-0000-0000-000000000001','Top Shelf',   4000,3, '["Everything above","Free appetizer per shift","Event and wedding bookings"]', true);

-- ------------------------------------------------------------
-- Subscriptions in mixed states (exercises approve/pending/demoted paths)
-- ------------------------------------------------------------
insert into subscriptions (patron_id, bartender_id, tier_id, status) values
  ('22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000012','approved'),  -- Alex, Inner Circle
  ('66666666-6666-6666-6666-666666666666','b0000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000013','approved'),  -- Marcus, Top Shelf
  ('77777777-7777-7777-7777-777777777777','b0000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000011','pending'),   -- Sam, Regulars, awaiting
  ('88888888-8888-8888-8888-888888888888','b0000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000011','demoted');   -- Chad, demoted

-- ------------------------------------------------------------
-- Shifts across every visibility scope
-- ------------------------------------------------------------
insert into shifts (bartender_id, venue_id, starts_at, ends_at, visibility, min_tier_rank) values
  ('b0000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-000000000001', now() + interval '2 day'  + time '19:00', now() + interval '3 day' + time '02:00','members', 2),  -- Inner Circle+
  ('b0000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-000000000002', now() + interval '3 day'  + time '20:00', now() + interval '4 day' + time '03:00','members', 1),  -- Regulars+
  ('b0000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-000000000001', now() + interval '6 day'  + time '18:00', now() + interval '7 day' + time '00:00','private', null), -- owner only
  ('b0000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-000000000003', now() + interval '10 day' + time '21:00', now() + interval '11 day'+ time '02:00','public',  null); -- everyone

-- ------------------------------------------------------------
-- Posts
-- ------------------------------------------------------------
insert into posts (bartender_id, kind, title, body, visibility, min_tier_rank) values
  ('b0000000-0000-0000-0000-000000000001','recipe','Barrel-aged Negroni, the real ratio','Equal parts, then time does the rest.','members', 2),
  ('b0000000-0000-0000-0000-000000000001','photo','Behind the stick at the Owl','','members', 1),
  ('b0000000-0000-0000-0000-000000000001','discount','2 dollars off well drinks, Tuesdays','','members', 3);

-- ------------------------------------------------------------
-- The Gilded Owl's pending visibility request to Remy, with a 25/mo offer
-- ------------------------------------------------------------
insert into grants (bartender_id, bar_id, kind, status, offer_cents) values
  ('b0000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','employer_visibility','requested', 2500);

-- ------------------------------------------------------------
-- Objective flags (visible to bartenders only)
-- ------------------------------------------------------------
insert into patron_flags (patron_id, issued_by, kind, evidence) values
  ('77777777-7777-7777-7777-777777777777','b0000000-0000-0000-0000-000000000001','no_show','Reserved seat, never showed, twice'),
  ('88888888-8888-8888-8888-888888888888','b0000000-0000-0000-0000-000000000001','chargeback','Disputed a legitimate tab'),
  ('88888888-8888-8888-8888-888888888888','b0000000-0000-0000-0000-000000000001','reported','Reported by two bartenders');

-- ------------------------------------------------------------
-- An employment-style offer from the Owl to Remy
-- ------------------------------------------------------------
insert into offers (bar_id, bartender_id, kind, terms, status) values
  ('ba000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','guest_residency','Three Fridays in July, headline the back bar','sent');

-- ------------------------------------------------------------
-- A couple of tips already sent to Remy
-- ------------------------------------------------------------
insert into payments (payer_id, payee_bartender_id, kind, amount_cents, stripe_ref) values
  ('22222222-2222-2222-2222-222222222222','b0000000-0000-0000-0000-000000000001','tip', 2000,'pi_demo_alex'),
  ('66666666-6666-6666-6666-666666666666','b0000000-0000-0000-0000-000000000001','tip', 5000,'pi_demo_marcus');

-- ------------------------------------------------------------
-- Metrics (bartender sees full; bars see only the banded signals view)
-- ------------------------------------------------------------
insert into metrics (bartender_id, followers, subscribers, revenue_cents, traffic, rank_score, trend_rank) values
  ('b0000000-0000-0000-0000-000000000001', 1284, 4, 284700, 5120, 92, 7),
  ('b0000000-0000-0000-0000-000000000002',  940, 0, 90000,  3100, 74, 24),
  ('b0000000-0000-0000-0000-000000000003', 1530, 0, 160000, 4800, 88, 11);
