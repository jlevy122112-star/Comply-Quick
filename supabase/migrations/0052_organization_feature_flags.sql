-- Persistent, organization-scoped feature flags. Environment values remain the
-- fallback so existing deployments retain their current behavior.
create table if not exists public.organization_feature_flags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  flag_key text not null,
  user_id uuid references auth.users (id) on delete cascade,
  enabled boolean not null,
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_feature_flags_scope_key
  on public.organization_feature_flags (organization_id, flag_key, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists organization_feature_flags_org_idx
  on public.organization_feature_flags (organization_id);

create table if not exists public.feature_flag_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  flag_key text not null,
  previous_enabled boolean,
  new_enabled boolean not null,
  actor_user_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists feature_flag_audit_org_created_idx
  on public.feature_flag_audit (organization_id, created_at desc);

alter table public.organization_feature_flags enable row level security;
alter table public.feature_flag_audit enable row level security;

drop policy if exists organization_feature_flags_select_member on public.organization_feature_flags;
create policy organization_feature_flags_select_member
  on public.organization_feature_flags for select
  using (public.is_org_member(organization_id));

drop policy if exists organization_feature_flags_insert_member on public.organization_feature_flags;
create policy organization_feature_flags_insert_member
  on public.organization_feature_flags for insert
  with check (public.is_org_member(organization_id));

drop policy if exists organization_feature_flags_insert_admin_guard on public.organization_feature_flags;
create policy organization_feature_flags_insert_admin_guard
  on public.organization_feature_flags as restrictive for insert
  with check (public.is_org_admin(organization_id) and updated_by = auth.uid());

drop policy if exists organization_feature_flags_update_member on public.organization_feature_flags;
create policy organization_feature_flags_update_member
  on public.organization_feature_flags for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists organization_feature_flags_update_admin_guard on public.organization_feature_flags;
create policy organization_feature_flags_update_admin_guard
  on public.organization_feature_flags as restrictive for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id) and updated_by = auth.uid());

drop policy if exists organization_feature_flags_delete_member on public.organization_feature_flags;
create policy organization_feature_flags_delete_member
  on public.organization_feature_flags for delete
  using (public.is_org_member(organization_id));

drop policy if exists organization_feature_flags_delete_admin_guard on public.organization_feature_flags;
create policy organization_feature_flags_delete_admin_guard
  on public.organization_feature_flags as restrictive for delete
  using (public.is_org_admin(organization_id));

drop policy if exists feature_flag_audit_select_admin on public.feature_flag_audit;
create policy feature_flag_audit_select_admin
  on public.feature_flag_audit for select
  using (public.is_org_admin(organization_id));

drop policy if exists feature_flag_audit_insert_admin on public.feature_flag_audit;
create policy feature_flag_audit_insert_admin
  on public.feature_flag_audit for insert
  with check (public.is_org_admin(organization_id) and actor_user_id = auth.uid());
