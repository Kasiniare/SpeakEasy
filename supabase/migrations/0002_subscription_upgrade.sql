-- Speakeasy migration 0002: allow patrons to upgrade / re-request a tier
--
-- Problem: subscriptions has unique(patron_id, bartender_id), and the only
-- patron-facing write policies were insert-as-pending and cancel. A patron who
-- already had a row could neither change tier nor re-subscribe, so an "upgrade"
-- insert hit the unique constraint and failed.
--
-- Fix: let a patron move their OWN row to 'pending' (a re-request or upgrade
-- request). Crucially this never lets a patron reach an access-granting status
-- (approved/demoted); only the bartender's policy can do that. So an upgrade
-- drops the patron to 'pending' until the bartender approves the higher tier,
-- which is the safe default: a patron can ask for more access, never grant it
-- to themselves.
--
-- Also tighten both patron write paths so the chosen tier must belong to the
-- subscription's own bartender. Without this, a patron could point tier_id at
-- another bartender's high-rank tier and, once approved, gain access computed
-- from the wrong tier. (The same gap existed on the original insert policy, so
-- it is replaced here.)

drop policy if exists subs_patron_insert on subscriptions;

create policy subs_patron_insert on subscriptions for insert to authenticated
  with check (
    patron_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from tiers t
      where t.id = subscriptions.tier_id
        and t.bartender_id = subscriptions.bartender_id
    )
  );

create policy subs_patron_rerequest on subscriptions for update to authenticated
  using (patron_id = auth.uid())
  with check (
    patron_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from tiers t
      where t.id = subscriptions.tier_id
        and t.bartender_id = subscriptions.bartender_id
    )
  );
