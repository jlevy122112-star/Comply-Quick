-- Promote partial collaboration/scope tables to first-class (framework §C12).
--
-- Three additive primitives, each RLS-scoped and reusing the existing
-- is_project_member() helper (0024) so project owners AND shared collaborators
-- get consistent access without policy recursion:
--   1. project_domains  — the domains a project owns / scopes scanning to.
--   2. task_comments    — collaboration thread on a compliance task.
--   3. integrations     — user-owned outbound webhook/API integrations.
-- Nothing here alters existing tables; all policies are additive.

-- ── 1. project_domains ───────────────────────────────────────────────────────
create table if not exists public.project_domains (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  domain text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, domain)
);

create index if not exists project_domains_project_idx on public.project_domains (project_id);

alter table public.project_domains enable row level security;

drop policy if exists "project_domains_select" on public.project_domains;
create policy "project_domains_select"
  on public.project_domains for select
  using (public.is_project_member(project_id));

-- Only the project owner mutates its domain scope.
drop policy if exists "project_domains_insert_owner" on public.project_domains;
create policy "project_domains_insert_owner"
  on public.project_domains for insert
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists "project_domains_delete_owner" on public.project_domains;
create policy "project_domains_delete_owner"
  on public.project_domains for delete
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- ── 2. task_comments ─────────────────────────────────────────────────────────
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.compliance_tasks (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;

-- Readable by anyone who can see the parent project (owner or member); when the
-- task isn't project-scoped, only the comment author / task owner sees it.
drop policy if exists "task_comments_select" on public.task_comments;
create policy "task_comments_select"
  on public.task_comments for select
  using (
    author_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
    or exists (select 1 from public.compliance_tasks t where t.id = task_id and t.user_id = auth.uid())
  );

-- A member/owner of the parent project (or the task owner) may comment as
-- themselves; the author_id must be the caller.
drop policy if exists "task_comments_insert" on public.task_comments;
create policy "task_comments_insert"
  on public.task_comments for insert
  with check (
    author_id = auth.uid()
    and (
      (project_id is not null and public.is_project_member(project_id))
      or exists (select 1 from public.compliance_tasks t where t.id = task_id and t.user_id = auth.uid())
    )
  );

drop policy if exists "task_comments_delete_author" on public.task_comments;
create policy "task_comments_delete_author"
  on public.task_comments for delete
  using (author_id = auth.uid());

-- ── 3. integrations ──────────────────────────────────────────────────────────
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('webhook', 'slack')),
  name text not null,
  target_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integrations_user_idx on public.integrations (user_id);

alter table public.integrations enable row level security;

drop policy if exists "integrations_select_own" on public.integrations;
create policy "integrations_select_own"
  on public.integrations for select
  using (user_id = auth.uid());

drop policy if exists "integrations_insert_own" on public.integrations;
create policy "integrations_insert_own"
  on public.integrations for insert
  with check (user_id = auth.uid());

drop policy if exists "integrations_update_own" on public.integrations;
create policy "integrations_update_own"
  on public.integrations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "integrations_delete_own" on public.integrations;
create policy "integrations_delete_own"
  on public.integrations for delete
  using (user_id = auth.uid());
