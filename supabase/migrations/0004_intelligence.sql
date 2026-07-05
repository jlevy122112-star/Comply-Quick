-- Comply-Quick — Phase 4: Compliance Intelligence Engine (Real-Time Alerts)
-- Adds proactive monitoring on top of the Phase 3 scanner. A user registers a
-- URL as a "monitor"; a weekly cron re-scans each monitor, compares the new
-- result against the previous one, and raises alerts when risk increases
-- (score drop, newly-detected tracker, new critical finding, or a failed scan).
-- Additive + backward compatible: no existing table is altered destructively.

-- ─── scan_monitors ───────────────────────────────────────────────────────────
-- A URL the user wants watched over time. Owned by the user; the weekly cron
-- (service role) re-scans it and stamps last_* fields. Monitoring is a Pro-tier
-- feature (enforced in app code), but the schema itself is tier-agnostic.
create table if not exists public.scan_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  label text not null default '',
  frequency text not null default 'weekly'
    check (frequency in ('weekly')),
  active boolean not null default true,
  last_scanned_at timestamptz,
  last_scan_id uuid references public.scans (id) on delete set null,
  last_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, url)
);

create index if not exists scan_monitors_user_idx
  on public.scan_monitors (user_id, created_at desc);
create index if not exists scan_monitors_due_idx
  on public.scan_monitors (active, last_scanned_at);

-- Link a scan back to the monitor that produced it (null for one-off manual
-- scans). Additive nullable column so existing rows/queries are unaffected.
alter table public.scans
  add column if not exists monitor_id uuid references public.scan_monitors (id) on delete set null;

create index if not exists scans_monitor_idx
  on public.scans (monitor_id, created_at desc);

-- ─── compliance_alerts ───────────────────────────────────────────────────────
-- A risk event raised by the intelligence engine when a monitored site changes
-- for the worse. Owned by the user; inserted by the cron (service role), read +
-- resolved by the owner. `detail` carries structured context (e.g. the list of
-- newly-added trackers) for the "Fix It" recommender and the timeline.
create table if not exists public.compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  monitor_id uuid references public.scan_monitors (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  type text not null default 'info'
    check (type in ('score_drop', 'new_tracker', 'new_critical', 'scan_failed', 'info')),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text not null default '',
  detail jsonb not null default '{}'::jsonb,
  fix_recommendation text,
  read boolean not null default false,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists compliance_alerts_user_idx
  on public.compliance_alerts (user_id, resolved, created_at desc);
create index if not exists compliance_alerts_monitor_idx
  on public.compliance_alerts (monitor_id, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.scan_monitors enable row level security;
alter table public.compliance_alerts enable row level security;

-- scan_monitors: full CRUD scoped to the owner. The cron writes via the service
-- role (bypasses RLS), so no separate service policy is required.
drop policy if exists "scan_monitors_select_own" on public.scan_monitors;
create policy "scan_monitors_select_own"
  on public.scan_monitors for select
  using (auth.uid() = user_id);

drop policy if exists "scan_monitors_insert_own" on public.scan_monitors;
create policy "scan_monitors_insert_own"
  on public.scan_monitors for insert
  with check (auth.uid() = user_id);

drop policy if exists "scan_monitors_update_own" on public.scan_monitors;
create policy "scan_monitors_update_own"
  on public.scan_monitors for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "scan_monitors_delete_own" on public.scan_monitors;
create policy "scan_monitors_delete_own"
  on public.scan_monitors for delete
  using (auth.uid() = user_id);

-- compliance_alerts: owner reads and updates (mark read / resolve) their own.
-- Inserts come from the service role (cron).
drop policy if exists "compliance_alerts_select_own" on public.compliance_alerts;
create policy "compliance_alerts_select_own"
  on public.compliance_alerts for select
  using (auth.uid() = user_id);

drop policy if exists "compliance_alerts_update_own" on public.compliance_alerts;
create policy "compliance_alerts_update_own"
  on public.compliance_alerts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
