-- Comply-Quick — Phase 2: Compliance Autopilot
-- Tracks regulations over time and stores *proposed* regenerations of a user's
-- compliance package when a tracked regulation changes. Propose-only by design:
-- the autopilot never mutates a live project; it writes a document_version with
-- status 'proposed' plus a notification, and the user accepts/rejects it.

-- ─── regulations ─────────────────────────────────────────────────────────────
-- Catalog of regulations the autopilot monitors. Global reference data written
-- by the daily cron (service role); readable by any authenticated user.
create table if not exists public.regulations (
  id text primary key, -- stable slug, e.g. 'eu_gdpr', 'california_ccpa'
  name text not null,
  region text not null,
  summary text not null default '',
  source_url text,
  current_version integer not null default 1,
  content_hash text, -- hash of the tracked source used for diffing
  last_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ─── regulation_versions ─────────────────────────────────────────────────────
-- Append-only history of each regulation. A new row is inserted by the diff
-- engine whenever the tracked content changes, enabling audit + rollback.
create table if not exists public.regulation_versions (
  id uuid primary key default gen_random_uuid(),
  regulation_id text not null references public.regulations (id) on delete cascade,
  version integer not null,
  summary text not null default '',
  content_hash text,
  change_note text not null default '',
  created_at timestamptz not null default now(),
  unique (regulation_id, version)
);

create index if not exists regulation_versions_regulation_idx
  on public.regulation_versions (regulation_id, version desc);

-- ─── document_versions ───────────────────────────────────────────────────────
-- Proposed/accepted regenerations of a project's compliance package. Owned by
-- the same user as the project; inserted by the autopilot (service role) or by a
-- manual regenerate, and resolved (accepted/rejected) by the owner.
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'proposed'
    check (status in ('proposed', 'accepted', 'rejected', 'superseded')),
  triggered_by text not null default 'autopilot'
    check (triggered_by in ('autopilot', 'manual')),
  regulation_id text references public.regulations (id) on delete set null,
  summary text not null default '',
  diff jsonb not null default '{}'::jsonb,
  package_markdown text not null default '',
  compliance_score jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists document_versions_user_status_idx
  on public.document_versions (user_id, status, created_at desc);
create index if not exists document_versions_project_idx
  on public.document_versions (project_id, created_at desc);

-- ─── notifications ───────────────────────────────────────────────────────────
-- Per-user in-app notifications (e.g. "3 documents need review"). Inserted by
-- the autopilot (service role); read + marked-read by the owner.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'info'
    check (type in ('info', 'document_proposed', 'regulation_change', 'action_needed')),
  title text not null,
  body text not null default '',
  related_project_id uuid references public.projects (id) on delete cascade,
  related_version_id uuid references public.document_versions (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.regulations enable row level security;
alter table public.regulation_versions enable row level security;
alter table public.document_versions enable row level security;
alter table public.notifications enable row level security;

-- regulations / regulation_versions: readable reference data for any signed-in
-- user. Writes happen via the service role (cron), which bypasses RLS.
drop policy if exists "regulations_select_all" on public.regulations;
create policy "regulations_select_all"
  on public.regulations for select
  to authenticated
  using (true);

drop policy if exists "regulation_versions_select_all" on public.regulation_versions;
create policy "regulation_versions_select_all"
  on public.regulation_versions for select
  to authenticated
  using (true);

-- document_versions: a user reads and resolves only their own proposals. Inserts
-- come from the service role (autopilot); a manual regenerate also inserts via
-- server code using the service role, so no insert policy is granted here.
drop policy if exists "document_versions_select_own" on public.document_versions;
create policy "document_versions_select_own"
  on public.document_versions for select
  using (auth.uid() = user_id);

drop policy if exists "document_versions_update_own" on public.document_versions;
create policy "document_versions_update_own"
  on public.document_versions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- notifications: owner can read and mark their own read. Inserts via service role.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
