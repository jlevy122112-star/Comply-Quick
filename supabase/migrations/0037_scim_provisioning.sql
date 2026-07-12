-- Enterprise SCIM 2.0 provisioning (RFC 7643/7644).
--
-- Lets an organization's identity provider (Okta, Azure AD, etc.) push and
-- deprovision directory users over the SCIM REST API. Two additive tables:
--
--   * scim_tokens  — per-org bearer credentials the IdP authenticates with.
--                    Only a SHA-256 hash is stored; the plaintext is shown once.
--   * scim_users   — the provisioned directory mirror (SCIM User core schema),
--                    one row per externally-managed identity.
--
-- The SCIM endpoints authenticate by bearer token (not a user session) and read
-- via the service-role client, so writes here bypass RLS. The policies below
-- exist so org members can *view* their provisioning state in the dashboard and
-- so org owners/admins can manage tokens; the endpoint never relies on them.

-- ─── scim_tokens ─────────────────────────────────────────────────────────────
create table if not exists public.scim_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null default 'SCIM token',
  token_prefix text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists scim_tokens_org_idx on public.scim_tokens (organization_id);

-- ─── scim_users ──────────────────────────────────────────────────────────────
create table if not exists public.scim_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  external_id text,
  user_name text not null,
  email text,
  display_name text,
  given_name text,
  family_name text,
  active boolean not null default true,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_name)
);

create index if not exists scim_users_org_idx on public.scim_users (organization_id);
create unique index if not exists scim_users_org_external_idx
  on public.scim_users (organization_id, external_id)
  where external_id is not null;

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.scim_tokens enable row level security;
alter table public.scim_users enable row level security;

-- scim_tokens: org members read (token_hash is never selected by the UI layer);
-- owner/admin manage. The SCIM endpoint uses the service-role client and does
-- not depend on these policies.
drop policy if exists "scim_tokens_select_member" on public.scim_tokens;
create policy "scim_tokens_select_member"
  on public.scim_tokens for select
  using (public.is_org_member(organization_id));

drop policy if exists "scim_tokens_write_admin" on public.scim_tokens;
create policy "scim_tokens_write_admin"
  on public.scim_tokens for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- scim_users: org members read the provisioned directory. All writes come from
-- the SCIM endpoint via the service-role client, so no member write policy.
drop policy if exists "scim_users_select_member" on public.scim_users;
create policy "scim_users_select_member"
  on public.scim_users for select
  using (public.is_org_member(organization_id));
