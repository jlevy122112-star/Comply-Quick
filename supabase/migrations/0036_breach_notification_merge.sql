-- Atomic breach-incident update.
--
-- The breach dashboard mutates a fixed set of fields on an incident: status,
-- containment timestamp, notes, and the per-obligation `notifications` map
-- (keyed by the deterministic notification-rule id). Doing these as separate
-- statements in application code has two problems:
--
--  1. Merging a key into the `notifications` JSONB in JS (read the map, merge,
--     write it back) is not atomic — two concurrent requests can each read the
--     same base map and the second write silently discards the first.
--  2. Applying a notification merge and a scalar-field change as two separate
--     writes is not transactional — one can succeed while the other fails,
--     leaving a partial update on a compliance-critical audit record.
--
-- This function performs the whole update in a single UPDATE statement. The
-- `notifications` map is merged with Postgres' JSONB `||` (set a key) and `-`
-- (clear a key) operators, so there is no read-modify-write race. Each field is
-- guarded by an `apply` flag so callers can distinguish "leave unchanged" from
-- "set to null" (e.g. clearing containment or notes). It runs as SECURITY
-- INVOKER (the default), so the caller's row-level security policies still apply
-- — a user can only update their own incidents.

create or replace function public.update_breach_incident(
  p_incident_id uuid,
  p_apply_status boolean,
  p_status text,
  p_apply_contained boolean,
  p_contained_at timestamptz,
  p_apply_notes boolean,
  p_notes text,
  p_apply_notify boolean,
  p_rule_id text,
  p_at text
) returns uuid
language sql
as $$
  update public.breach_incidents
  set
    status = case when p_apply_status then p_status else status end,
    contained_at = case when p_apply_contained then p_contained_at else contained_at end,
    notes = case when p_apply_notes then p_notes else notes end,
    notifications = case
      when not p_apply_notify then notifications
      when p_at is null then notifications - p_rule_id
      else notifications || jsonb_build_object(p_rule_id, p_at)
    end,
    updated_at = now()
  where id = p_incident_id
  returning id;
$$;

revoke all on function public.update_breach_incident(
  uuid, boolean, text, boolean, timestamptz, boolean, text, boolean, text, text
) from public;
grant execute on function public.update_breach_incident(
  uuid, boolean, text, boolean, timestamptz, boolean, text, boolean, text, text
) to authenticated;
