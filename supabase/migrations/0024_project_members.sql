-- Project memberships (framework §3.1 / A5).
--
-- The agency layer (0005) already provides the org/workspace grouping above
-- projects (agencies → agency_clients → projects.client_id) plus agency-wide
-- seats (agency_members). What was missing is per-project collaboration: sharing
-- a single project with named collaborators independent of an agency. This adds
-- that primitive additively — the project owner keeps full control, and members
-- gain read access. Nothing here changes existing owner behavior (RLS permissive
-- policies are OR-combined), so all current queries keep working unchanged.

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer'
    check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index if not exists project_members_project_idx on public.project_members (project_id);
create index if not exists project_members_user_idx on public.project_members (user_id);

-- SECURITY DEFINER membership check (mirrors is_agency_member) to avoid RLS
-- recursion when project policies reference memberships.
create or replace function public.is_project_member(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.projects p where p.id = p_id and p.user_id = auth.uid()
  ) or exists (
    select 1 from public.project_members m where m.project_id = p_id and m.user_id = auth.uid()
  );
$$;

alter table public.project_members enable row level security;

-- Members can see the roster of projects they belong to; only the project owner
-- manages seats.
drop policy if exists "project_members_select" on public.project_members;
create policy "project_members_select"
  on public.project_members for select
  using (user_id = auth.uid() or public.is_project_member(project_id));

drop policy if exists "project_members_insert_owner" on public.project_members;
create policy "project_members_insert_owner"
  on public.project_members for insert
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists "project_members_delete_owner" on public.project_members;
create policy "project_members_delete_owner"
  on public.project_members for delete
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- Additive member read access on the project and its child data. These are
-- separate permissive SELECT policies, OR-combined with the existing
-- *_select_own policies, so owners are unaffected and members gain read-only
-- visibility into shared projects.
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  using (public.is_project_member(id));

drop policy if exists "findings_select_member" on public.findings;
create policy "findings_select_member"
  on public.findings for select
  using (project_id is not null and public.is_project_member(project_id));

drop policy if exists "compliance_tasks_select_member" on public.compliance_tasks;
create policy "compliance_tasks_select_member"
  on public.compliance_tasks for select
  using (project_id is not null and public.is_project_member(project_id));

drop policy if exists "scans_select_member" on public.scans;
create policy "scans_select_member"
  on public.scans for select
  using (project_id is not null and public.is_project_member(project_id));
