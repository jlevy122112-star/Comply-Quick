-- Workspace/client-scoped API keys for install snippet distribution.

create unique index if not exists workspaces_id_org_unique_idx
  on public.workspaces (id, organization_id);

create table if not exists public.client_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  constraint client_api_keys_workspace_org_fk
    foreign key (workspace_id, organization_id)
    references public.workspaces (id, organization_id)
    on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_api_keys_org_idx
  on public.client_api_keys (organization_id, created_at desc);
create index if not exists client_api_keys_workspace_idx
  on public.client_api_keys (workspace_id, created_at desc);

alter table public.client_api_keys enable row level security;

drop policy if exists "client_api_keys_select_member" on public.client_api_keys;
create policy "client_api_keys_select_member"
  on public.client_api_keys for select
  using (public.org_role(organization_id) is not null);

drop policy if exists "client_api_keys_manage_admin" on public.client_api_keys;
create policy "client_api_keys_manage_admin"
  on public.client_api_keys for all
  using (public.org_role(organization_id) in ('owner', 'admin'))
  with check (public.org_role(organization_id) in ('owner', 'admin'));
