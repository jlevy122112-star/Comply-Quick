-- Tenant-scoped feature flags.
--
-- Allows per-organization overrides on top of plan-level defaults. Admins can
-- force a feature on or off for a specific tenant; non-overridden flags fall
-- back to the default for the organization's current plan.

create table if not exists public.organization_features (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  flag text not null,
  enabled boolean not null default true,
  reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (organization_id, flag)
);

create index if not exists organization_features_org_idx
  on public.organization_features (organization_id);

-- Members of an org can read its feature overrides (needed to gate UI).
-- Only admins can create, update, or delete overrides.
alter table public.organization_features enable row level security;

drop policy if exists organization_features_select_member on public.organization_features;
create policy organization_features_select_member
  on public.organization_features for select
  using (public.is_org_member(organization_id));

drop policy if exists organization_features_write_admin on public.organization_features;
create policy organization_features_write_admin
  on public.organization_features for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
