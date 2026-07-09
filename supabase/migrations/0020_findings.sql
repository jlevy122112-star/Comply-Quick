-- Comply-Quick — Findings & Remediation system (framework §3.6, data model §5).
--
-- Promotes scan findings from ephemeral JSON living inside a scan result into
-- first-class rows with a lifecycle (status / owner / due date) and an
-- append-only event history. This is what turns Comply-Quick from a one-shot
-- generator into a recurring operations platform: a finding persists across
-- scans, can be assigned and worked, and automatically re-opens if a later scan
-- re-detects an issue that was marked resolved.
--
-- Scoping is scan-first: a finding is always born from a scan (scan_id NOT
-- NULL) so users who only run scans — without ever creating a project — still
-- get first-class findings. project_id is OPTIONAL: it is backfilled if/when the
-- scan's URL is associated with a project, letting the Project Workspace show
-- the same rows. Reconciliation is keyed on (user_id, finding_key) across the
-- user's scan history so repeated scans of the same site update one row.
--
-- Ownership: every row carries user_id and is RLS-scoped so a user only ever
-- sees and mutates their own findings/events.

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  -- Deterministic identity for this issue for this user (see findings-db.ts).
  finding_key text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  detail text not null default '',
  recommendation text not null default '',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'reopened')),
  owner text,
  due_date date,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint findings_user_key_unique unique (user_id, finding_key)
);

create index if not exists findings_user_idx on public.findings (user_id);
create index if not exists findings_scan_idx on public.findings (scan_id);
create index if not exists findings_project_idx on public.findings (project_id);
create index if not exists findings_status_idx on public.findings (user_id, status);

alter table public.findings enable row level security;

drop policy if exists findings_select_own on public.findings;
create policy findings_select_own on public.findings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists findings_insert_own on public.findings;
create policy findings_insert_own on public.findings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists findings_update_own on public.findings;
create policy findings_update_own on public.findings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists findings_delete_own on public.findings;
create policy findings_delete_own on public.findings
  for delete to authenticated using (auth.uid() = user_id);

-- ─── Append-only lifecycle history ──────────────────────────────────────────
-- One row per meaningful change to a finding: creation, status transition,
-- owner/due assignment, redetection by a later scan, or a free-text comment.
-- Immutable by design (no update/delete policy) so the workspace Activity tab
-- and any future audit export have a trustworthy trail.

create table if not exists public.finding_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  finding_id uuid not null references public.findings(id) on delete cascade,
  type text not null check (type in (
    'created', 'status_changed', 'owner_changed', 'due_changed',
    'redetected', 'reopened', 'resolved_auto', 'comment'
  )),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists finding_events_finding_idx on public.finding_events (finding_id, created_at);

alter table public.finding_events enable row level security;

drop policy if exists finding_events_select_own on public.finding_events;
create policy finding_events_select_own on public.finding_events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists finding_events_insert_own on public.finding_events;
create policy finding_events_insert_own on public.finding_events
  for insert to authenticated with check (auth.uid() = user_id);
