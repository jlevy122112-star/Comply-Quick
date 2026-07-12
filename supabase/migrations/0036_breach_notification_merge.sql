-- Atomic per-obligation breach-notification merge.
--
-- The breach dashboard records the timestamp at which each individual
-- notification obligation was satisfied in the `notifications` JSONB column of
-- `breach_incidents`, keyed by the deterministic notification-rule id. Merging a
-- key in application code (read the map, merge in JS, write it back) is not
-- atomic: two concurrent requests can each read the same base map and the second
-- write silently discards the first's newly recorded notification.
--
-- This function performs the merge in a single UPDATE using Postgres' JSONB `||`
-- (set a key) and `-` (clear a key) operators, eliminating the race window. It
-- runs as SECURITY INVOKER (the default), so the caller's row-level security
-- policies still apply — a user can only merge into their own incidents.

create or replace function public.apply_breach_notification(
  p_incident_id uuid,
  p_rule_id text,
  p_at text
) returns uuid
language sql
as $$
  update public.breach_incidents
  set notifications = case
        when p_at is null then notifications - p_rule_id
        else notifications || jsonb_build_object(p_rule_id, p_at)
      end,
      updated_at = now()
  where id = p_incident_id
  returning id;
$$;

revoke all on function public.apply_breach_notification(uuid, text, text) from public;
grant execute on function public.apply_breach_notification(uuid, text, text) to authenticated;
