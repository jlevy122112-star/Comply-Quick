-- Comply-Quick — Metered API billing (Phase 3 / [Up3]).
--
-- Adds programmatic API access with usage-based expansion revenue:
--   • api_keys          — hashed API credentials issued per user (Enterprise /
--                         Agency integrations). Only a SHA-256 hash is stored;
--                         the plaintext key is shown once at creation.
--   • api_usage_events  — append-only log of every metered API call for audit
--                         and per-endpoint analytics.
--   • api_usage_meters  — rolled-up (user, period, meter) ledger with a
--                         reported_to_stripe_at stamp so Stripe metered usage
--                         reporting is idempotent (mirrors billing_overages).
--
-- Metered prices live in TIER_CONFIG's METERED_PRICE_CENTS: $0.01 per API call,
-- $50 per API/programmatic template upload. The $5-per-extra-scan meter is
-- already accrued in billing_overages (migration 0009) wherever a scan runs.
--
-- Numbered 0010 to sit after Marketplace (0007/0008) and Agency billing (0009).

-- ─── api_keys ────────────────────────────────────────────────────────────────
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Human label chosen by the user (e.g. "Production integration").
  name text not null,
  -- Non-secret display prefix, e.g. "cq_live_9f3a" — safe to show in lists.
  key_prefix text not null,
  -- SHA-256 hex digest of the full secret key. The plaintext is never stored.
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_user_idx on public.api_keys (user_id, created_at desc);

-- ─── api_usage_events ────────────────────────────────────────────────────────
-- One row per metered API call. Append-only; never updated.
create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  api_key_id uuid references public.api_keys (id) on delete set null,
  -- Calendar-month bucket, e.g. '2026-07'.
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  endpoint text not null,
  -- Meter key: 'api_call' | 'api_template_upload' (matches METERED_PRICE_CENTS).
  meter text not null,
  quantity integer not null default 1,
  cost_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_events_user_period_idx
  on public.api_usage_events (user_id, period desc);

-- ─── api_usage_meters ────────────────────────────────────────────────────────
-- Rolled-up usage per (user, period, meter) for idempotent Stripe reporting.
create table if not exists public.api_usage_meters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  meter text not null,
  quantity integer not null default 0,
  cost_cents integer not null default 0,
  reported_to_stripe_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period, meter)
);

create index if not exists api_usage_meters_user_period_idx
  on public.api_usage_meters (user_id, period desc);

-- ─── Atomic meter rollup ─────────────────────────────────────────────────────
-- Upserts and increments a (user, period, meter) row in one statement so
-- concurrent API calls never lose usage. SECURITY DEFINER because the metered
-- API layer calls it via the service role after authenticating an API key.
create or replace function public.increment_api_usage(
  p_user_id uuid,
  p_period text,
  p_meter text,
  p_quantity integer,
  p_cost_cents integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.api_usage_meters (user_id, period, meter, quantity, cost_cents, updated_at)
  values (p_user_id, p_period, p_meter, p_quantity, p_cost_cents, now())
  on conflict (user_id, period, meter) do update
    set quantity = public.api_usage_meters.quantity + excluded.quantity,
        cost_cents = public.api_usage_meters.cost_cents + excluded.cost_cents,
        updated_at = now();
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.api_keys enable row level security;
alter table public.api_usage_events enable row level security;
alter table public.api_usage_meters enable row level security;

-- Users manage (read/create/revoke) only their own keys. The stored value is a
-- hash, so listing a key never exposes a usable secret.
drop policy if exists "api_keys_all_own" on public.api_keys;
create policy "api_keys_all_own"
  on public.api_keys for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Usage rows are written service-role only (from the metered API layer); users
-- may read their own for the usage dashboard.
drop policy if exists "api_usage_events_select_own" on public.api_usage_events;
create policy "api_usage_events_select_own"
  on public.api_usage_events for select
  using (user_id = auth.uid());

drop policy if exists "api_usage_meters_select_own" on public.api_usage_meters;
create policy "api_usage_meters_select_own"
  on public.api_usage_meters for select
  using (user_id = auth.uid());
