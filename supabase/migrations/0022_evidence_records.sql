-- Audit & Evidence Agent — persisted evidence records (framework §3.3 / A3).
--
-- The Audit & Evidence agent compiles a framework-specific evidence pack on the
-- fly; this table persists the per-control evidence state so it survives across
-- sessions, feeds back into the next pack compilation as the "ledger", and can
-- be surfaced in an auditor-ready Evidence view. One row per
-- (user_id, framework, control_id): the latest known state of that control.

create table if not exists public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Optional project scope; NULL = account-wide evidence for the framework.
  project_id uuid references public.projects (id) on delete cascade,
  framework text not null,
  control_id text not null,
  control_title text not null default '',
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'missing'
    check (status in ('collected', 'missing', 'not_applicable')),
  -- What the org should attach to satisfy this control (denormalized for display).
  required_evidence jsonb not null default '[]'::jsonb,
  -- Free-form pointer to the collected artifact (URL, doc id, note).
  evidence_ref text,
  source_url text not null default '',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, framework, control_id, project_id)
);

create index if not exists evidence_records_user_framework_idx
  on public.evidence_records (user_id, framework);
create index if not exists evidence_records_project_idx
  on public.evidence_records (project_id);

alter table public.evidence_records enable row level security;

drop policy if exists "evidence_records_select_own" on public.evidence_records;
create policy "evidence_records_select_own" on public.evidence_records
  for select using (auth.uid() = user_id);

drop policy if exists "evidence_records_insert_own" on public.evidence_records;
create policy "evidence_records_insert_own" on public.evidence_records
  for insert with check (auth.uid() = user_id);

drop policy if exists "evidence_records_update_own" on public.evidence_records;
create policy "evidence_records_update_own" on public.evidence_records
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "evidence_records_delete_own" on public.evidence_records;
create policy "evidence_records_delete_own" on public.evidence_records
  for delete using (auth.uid() = user_id);
