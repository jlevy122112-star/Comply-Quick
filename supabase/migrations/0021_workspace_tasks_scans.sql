-- Workspace Phase A2 — project-scoped tasks + scans.
--
-- Adds an optional project_id link to both compliance_tasks and scans so the
-- per-project workspace can show a project's own task list and scan history.
-- Both columns are nullable: account-wide tasks (e.g. from the calendar) and
-- scan-first flows (a scan run before any project exists) keep working exactly
-- as before, and a NULL project_id simply means "not tied to a project".

alter table public.compliance_tasks
  add column if not exists project_id uuid references public.projects (id) on delete cascade;

create index if not exists compliance_tasks_project_idx
  on public.compliance_tasks (project_id);

alter table public.scans
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists scans_project_idx
  on public.scans (project_id);
