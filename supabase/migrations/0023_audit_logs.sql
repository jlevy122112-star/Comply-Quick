-- Immutable audit trail (framework §3.7 / A4).
--
-- Append-only record of consequential actions a user takes in their compliance
-- ecosystem: proposal approvals/rejections, public-score publish/revoke, and
-- compliance-package exports. Immutability is enforced at the DB level: RLS
-- allows INSERT + SELECT for the owner but no UPDATE/DELETE policies exist, so
-- rows can never be altered or removed through the API. This is what an auditor
-- (or the user) relies on to prove what happened and when.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Optional scoping to the affected project/scan for filtered timelines.
  project_id uuid references public.projects (id) on delete set null,
  -- The action performed, e.g. 'proposal.accepted', 'score.published', 'package.exported'.
  action text not null,
  -- The kind of entity acted upon, e.g. 'proposal', 'scan', 'project'.
  entity_type text not null default '',
  -- The affected entity's id (free-form; not FK-constrained so history survives deletes).
  entity_id text,
  -- Human-readable one-line summary shown in the audit timeline.
  summary text not null default '',
  -- Structured context (before/after, labels, counts) — never secrets.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_created_idx
  on public.audit_logs (user_id, created_at desc);
create index if not exists audit_logs_project_idx
  on public.audit_logs (project_id);

alter table public.audit_logs enable row level security;

-- Append + read only. Deliberately NO update/delete policies → immutable.
drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own" on public.audit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
  for insert with check (auth.uid() = user_id);
