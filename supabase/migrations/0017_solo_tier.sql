-- Rename the paid entitlement tier `pro` (and the older `single`) to `solo`,
-- matching the value-based repricing and the machine key now used across the
-- app (src/lib/pricing.ts).
--
-- Why this migration is required: the original check constraint in 0001 only
-- allowed ('free','single','agency','enterprise'). The webhook writes the code's
-- tier key on checkout, so once the code moved to `pro`/`solo` the DB rejected
-- the upsert and the paid entitlement was silently dropped — a charged customer
-- stayed on Free. We migrate any legacy rows and widen the constraint so the
-- persisted value matches the code.

-- 1. Migrate existing rows off the retired keys.
update public.subscriptions
set tier = 'solo', updated_at = now()
where tier in ('single', 'pro');

-- 2. Replace the tier check constraint. The inline constraint from 0001 is
--    auto-named `subscriptions_tier_check`; drop it if present, then add the
--    updated allow-list. Old values are no longer accepted (all rows migrated
--    above), and the app normalizes any legacy key before writing.
alter table public.subscriptions
  drop constraint if exists subscriptions_tier_check;

alter table public.subscriptions
  add constraint subscriptions_tier_check
  check (tier in ('free', 'solo', 'agency', 'enterprise'));
