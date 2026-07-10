-- Enterprise multi-tenancy: organizations → workspaces → projects, RBAC, SSO.
--
-- Adds a first-class tenant hierarchy above the per-user/agency model. Fully
-- additive: the new columns on `projects` are nullable, existing per-user and
-- agency flows are untouched, and every new member SELECT policy is a separate
-- permissive policy OR-combined with the existing owner policies. Roles use the
-- shared five-rung ladder enforced in app code by src/lib/rbac; the DB stores
-- the role string and gates writes to owner/admin at the policy layer.

-- ─── organizations ───────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Organization',
  slug text not null unique,
  plan text not null default 'enterprise'
    check (plan in ('free', 'team', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizations_owner_idx on public.organizations (owner_id);

-- ─── organization_members ────────────────────────────────────────────────────
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'manager', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_org_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_idx on public.organization_members (user_id);

-- ─── workspaces ──────────────────────────────────────────────────────────────
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index if not exists workspaces_org_idx on public.workspaces (organization_id);

-- ─── workspace_members ───────────────────────────────────────────────────────
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'manager', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_ws_idx on public.workspace_members (workspace_id);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

-- ─── sso_connections ─────────────────────────────────────────────────────────
-- Enterprise SSO config, one row per identity provider. `email_domain` maps a
-- user's email domain to this org so IdP-initiated / domain-routed logins resolve
-- the right tenant. Enforcement is env-gated in app code (no-op until a real IdP
-- is wired), mirroring the notification-dispatch pattern.
create table if not exists public.sso_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  protocol text not null default 'saml'
    check (protocol in ('saml', 'oidc')),
  display_name text not null default 'Company SSO',
  email_domain text not null,
  metadata_url text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email_domain)
);

create index if not exists sso_connections_org_idx on public.sso_connections (organization_id);

-- ─── project tenancy tags (nullable, additive) ───────────────────────────────
alter table public.projects
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.projects
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;

create index if not exists projects_org_idx on public.projects (organization_id);
create index if not exists projects_workspace_idx on public.projects (workspace_id);

-- ─── RLS helpers (SECURITY DEFINER to avoid policy recursion) ─────────────────
create or replace function public.is_org_member(o_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o where o.id = o_id and o.owner_id = auth.uid()
  ) or exists (
    select 1 from public.organization_members m
    where m.organization_id = o_id and m.user_id = auth.uid()
  );
$$;

-- The caller's effective role in an org. The owner is always 'owner'; otherwise
-- the stored membership role; null when not a member.
create or replace function public.org_role(o_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (select 1 from public.organizations o where o.id = o_id and o.owner_id = auth.uid())
      then 'owner'
    else (
      select m.role from public.organization_members m
      where m.organization_id = o_id and m.user_id = auth.uid()
      limit 1
    )
  end;
$$;

-- True when the caller owns/administers the org (role gate for writes).
create or replace function public.is_org_admin(o_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.org_role(o_id) in ('owner', 'admin');
$$;

create or replace function public.is_workspace_member(w_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = w_id and public.is_org_member(w.organization_id)
  ) or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = w_id and m.user_id = auth.uid()
  );
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.sso_connections enable row level security;

-- organizations: members read; owner creates; owner/admin update; owner deletes.
drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member"
  on public.organizations for select
  using (owner_id = auth.uid() or public.is_org_member(id));

drop policy if exists "organizations_insert_own" on public.organizations;
create policy "organizations_insert_own"
  on public.organizations for insert
  with check (owner_id = auth.uid());

drop policy if exists "organizations_update_admin" on public.organizations;
create policy "organizations_update_admin"
  on public.organizations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

drop policy if exists "organizations_delete_owner" on public.organizations;
create policy "organizations_delete_owner"
  on public.organizations for delete
  using (owner_id = auth.uid());

-- organization_members: members read the roster; owner/admin manage seats.
drop policy if exists "organization_members_select" on public.organization_members;
create policy "organization_members_select"
  on public.organization_members for select
  using (user_id = auth.uid() or public.is_org_member(organization_id));

drop policy if exists "organization_members_insert_admin" on public.organization_members;
create policy "organization_members_insert_admin"
  on public.organization_members for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "organization_members_update_admin" on public.organization_members;
create policy "organization_members_update_admin"
  on public.organization_members for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "organization_members_delete_admin" on public.organization_members;
create policy "organization_members_delete_admin"
  on public.organization_members for delete
  using (public.is_org_admin(organization_id));

-- workspaces: org members read; owner/admin/manager create & update; admin deletes.
drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces for select
  using (public.is_workspace_member(id));

drop policy if exists "workspaces_insert_manager" on public.workspaces;
create policy "workspaces_insert_manager"
  on public.workspaces for insert
  with check (public.org_role(organization_id) in ('owner', 'admin', 'manager'));

drop policy if exists "workspaces_update_manager" on public.workspaces;
create policy "workspaces_update_manager"
  on public.workspaces for update
  using (public.org_role(organization_id) in ('owner', 'admin', 'manager'))
  with check (public.org_role(organization_id) in ('owner', 'admin', 'manager'));

drop policy if exists "workspaces_delete_admin" on public.workspaces;
create policy "workspaces_delete_admin"
  on public.workspaces for delete
  using (public.is_org_admin(organization_id));

-- workspace_members: workspace members read; org admins manage seats.
drop policy if exists "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select"
  on public.workspace_members for select
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_write_admin" on public.workspace_members;
create policy "workspace_members_write_admin"
  on public.workspace_members for all
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and public.is_org_admin(w.organization_id)))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and public.is_org_admin(w.organization_id)));

-- sso_connections: org members read; owner/admin manage.
drop policy if exists "sso_connections_select_member" on public.sso_connections;
create policy "sso_connections_select_member"
  on public.sso_connections for select
  using (public.is_org_member(organization_id));

drop policy if exists "sso_connections_write_admin" on public.sso_connections;
create policy "sso_connections_write_admin"
  on public.sso_connections for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- Additive member read access on projects tagged to an org/workspace the caller
-- belongs to. OR-combined with existing owner + project-member policies.
drop policy if exists "projects_select_org_member" on public.projects;
create policy "projects_select_org_member"
  on public.projects for select
  using (
    (organization_id is not null and public.is_org_member(organization_id))
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );
