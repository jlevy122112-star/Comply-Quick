-- Comply-Quick — Agency billing (seats, scan limits, overage).
-- Adds a per-account monthly overage ledger so scans beyond an agency's
-- included allotment (TIER_CONFIG.scanLimit) accrue metered overage that can be
-- reported to Stripe. Seat limits reuse the existing agency_members table and
-- are enforced in application code against TIER_CONFIG.seats.
--
-- Numbered 0009 to sit after the Marketplace migrations (0007/0008) so it never
-- collides with them regardless of merge order.

-- ─── billing_overages ────────────────────────────────────────────────────────
-- One row per (account owner, calendar month). `scans_over` / `overage_cents`
-- accrue as the owner runs scans past their plan's included scanLimit. Enterprise
-- (unlimited) never accrues. `reported_to_stripe_at` makes Stripe usage reporting
-- idempotent for a later metered-billing pass.
create table if not exists public.billing_overages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Calendar-month bucket, e.g. '2026-07'.
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  scans_used integer not null default 0,
  scans_over integer not null default 0,
  overage_cents integer not null default 0,
  reported_to_stripe_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create index if not exists billing_overages_user_period_idx
  on public.billing_overages (user_id, period desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.billing_overages enable row level security;

-- The account owner may read and write their own ledger rows (accrual runs under
-- the owner's session when a scan completes). No cross-user visibility.
drop policy if exists "billing_overages_all_own" on public.billing_overages;
create policy "billing_overages_all_own"
  on public.billing_overages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
