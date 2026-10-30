-- Speakeasy migration 0004: split shareable signals from private metrics
--
-- Replaces the SECURITY DEFINER bartender_signals view (which bypassed RLS and
-- was flagged critical by the Supabase advisor) with a least-privilege design:
-- the sensitive numbers (revenue, traffic, exact followers) stay in `metrics`
-- with owner-only access, and only the shareable signals live in a separate
-- table that bars are actually permitted to read. The boundary is enforced by
-- data classification at the table level, not by column projection inside a
-- privileged view.

-- 1. Shareable, non-sensitive signals only.
create table if not exists bartender_signals_pub (
  bartender_id  uuid primary key references bartender_profiles(id) on delete cascade,
  rank_score    int not null default 0,
  trend_rank    int,
  follower_band text not null default 'under 100',  -- banded, never the exact count
  updated_at    timestamptz not null default now()
);

grant select on bartender_signals_pub to authenticated;
alter table bartender_signals_pub enable row level security;

-- A bar member may read signals for bartenders who opted into bar discovery.
-- A bartender may read their own row. Patrons get nothing here.
drop policy if exists signals_pub_read on bartender_signals_pub;
create policy signals_pub_read on bartender_signals_pub for select to authenticated
  using (
    (
      exists (select 1 from bar_members where user_id = auth.uid())
      and exists (select 1 from bartender_profiles b where b.id = bartender_id and b.discoverable_to_bars)
    )
    or bartender_id = app_current_bartender_id()
  );

-- 2. Keep it in sync with metrics, copying only the safe fields.
create or replace function sync_bartender_signals_pub()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into bartender_signals_pub (bartender_id, rank_score, trend_rank, follower_band, updated_at)
  values (
    new.bartender_id, new.rank_score, new.trend_rank,
    case when new.followers >= 1000 then '1k+'
         when new.followers >= 500  then '500+'
         when new.followers >= 100  then '100+'
         else 'under 100' end,
    now()
  )
  on conflict (bartender_id) do update
    set rank_score = excluded.rank_score,
        trend_rank = excluded.trend_rank,
        follower_band = excluded.follower_band,
        updated_at = now();
  return new;
end $$;

drop trigger if exists trg_sync_signals on metrics;
create trigger trg_sync_signals after insert or update on metrics
  for each row execute function sync_bartender_signals_pub();

-- 3. Backfill from existing metrics.
insert into bartender_signals_pub (bartender_id, rank_score, trend_rank, follower_band)
select bartender_id, rank_score, trend_rank,
  case when followers >= 1000 then '1k+'
       when followers >= 500  then '500+'
       when followers >= 100  then '100+'
       else 'under 100' end
from metrics
on conflict (bartender_id) do update
  set rank_score = excluded.rank_score,
      trend_rank = excluded.trend_rank,
      follower_band = excluded.follower_band;

-- 4. Replace the definer view with a SECURITY INVOKER view that respects RLS.
--    Same columns and name, so the client query is unchanged; only rows the
--    caller is allowed to read come back.
drop view if exists bartender_signals;
create view bartender_signals with (security_invoker = on) as
  select
    p.bartender_id,
    b.display_name,
    b.specialty,
    p.rank_score,
    p.trend_rank,
    p.follower_band
  from bartender_signals_pub p
  join bartender_profiles b on b.id = p.bartender_id;

grant select on bartender_signals to authenticated;
