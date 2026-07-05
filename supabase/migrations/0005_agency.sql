-- Comply-Quick — Phase 5: Agency Client Portal (White-Label Multi-Tenant)
-- Adds a tenant layer on top of the per-user app so an Agency/Enterprise user
-- can manage multiple client profiles, brand their workspace (white-label), and
-- attach client-owned custom domains. Additive + backward compatible: existing
-- per-user tables/policies are untouched; new client_id columns are nullable so
-- all current rows and queries keep working.

-- ─── agencies ────────────────────────────────────────────────────────────────
-- One workspace/tenant per agency, owned by an agency-tier user. Branding fields
-- drive the white-label UI. `slug` is the vanity path (/portal/<slug>) and is
-- also used to resolve a request when it arrives on a custom domain.
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Agency',
  slug text not null unique,
  -- White-label branding.
  logo_url text,
  primary_color text not null default '#4f46e5'
    check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  support_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A user owns at most one agency workspace (team seats live in agency_members).
  unique (owner_id)
);

create index if not exists agencies_owner_idx on public.agencies (owner_id);

-- ─── agency_members ──────────────────────────────────────────────────────────
-- Team seats within an agency. The owner is always an implicit member; extra
-- rows grant colleagues access. Roles gate destructive actions in app code.
create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create index if not exists agency_members_agency_idx on public.agency_members (agency_id);
create index if not exists agency_members_user_idx on public.agency_members (user_id);

-- ─── agency_clients ──────────────────────────────────────────────────────────
-- A client the agency manages. Compliance work (monitors, projects) is attached
-- via the nullable client_id columns below, so a per-client dashboard is just a
-- filtered view of the agency owner's existing data.
create table if not exists public.agency_clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  contact_email text,
  website_url text,
  notes text not null default '',
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_clients_agency_idx
  on public.agency_clients (agency_id, created_at desc);

-- ─── agency_domains ──────────────────────────────────────────────────────────
-- Custom (client-owned) domains that serve the white-label portal. A domain is
-- added `pending`, gets a verification token, and flips to `verified` once DNS
-- (and, in production, a Cloudflare-for-SaaS custom hostname) is confirmed.
create table if not exists public.agency_domains (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  domain text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'error')),
  verification_token text not null default encode(gen_random_bytes(16), 'hex'),
  cf_hostname_id text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agency_domains_agency_idx on public.agency_domains (agency_id);

-- ─── client_id tags on existing per-user data ────────────────────────────────
-- Nullable so existing rows (one-off/manual work) stay unattributed and every
-- current query is unaffected. Lets an agency organize monitors/projects per
-- client without changing ownership (rows remain owned by the agency user).
alter table public.scan_monitors
  add column if not exists client_id uuid references public.agency_clients (id) on delete set null;
alter table public.projects
  add column if not exists client_id uuid references public.agency_clients (id) on delete set null;

create index if not exists scan_monitors_client_idx on public.scan_monitors (client_id);
create index if not exists projects_client_idx on public.projects (client_id);

-- ─── RLS helper (SECURITY DEFINER to avoid policy recursion) ──────────────────
-- Membership check used by client/domain policies. Runs as definer so it can
-- read agencies/agency_members without triggering their own RLS (which would
-- otherwise recurse). Returns true when the caller owns or belongs to the agency.
create or replace function public.is_agency_member(a_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.agencies a where a.id = a_id and a.owner_id = auth.uid()
  ) or exists (
    select 1 from public.agency_members m where m.agency_id = a_id and m.user_id = auth.uid()
  );
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_clients enable row level security;
alter table public.agency_domains enable row level security;

-- agencies: the owner has full control; members may read the workspace.
drop policy if exists "agencies_select_member" on public.agencies;
create policy "agencies_select_member"
  on public.agencies for select
  using (owner_id = auth.uid() or public.is_agency_member(id));

drop policy if exists "agencies_insert_own" on public.agencies;
create policy "agencies_insert_own"
  on public.agencies for insert
  with check (owner_id = auth.uid());

drop policy if exists "agencies_update_own" on public.agencies;
create policy "agencies_update_own"
  on public.agencies for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "agencies_delete_own" on public.agencies;
create policy "agencies_delete_own"
  on public.agencies for delete
  using (owner_id = auth.uid());

-- agency_members: a member can see the roster of agencies they belong to; only
-- the agency owner can add/remove seats.
drop policy if exists "agency_members_select" on public.agency_members;
create policy "agency_members_select"
  on public.agency_members for select
  using (user_id = auth.uid() or public.is_agency_member(agency_id));

drop policy if exists "agency_members_insert_owner" on public.agency_members;
create policy "agency_members_insert_owner"
  on public.agency_members for insert
  with check (exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid()));

drop policy if exists "agency_members_delete_owner" on public.agency_members;
create policy "agency_members_delete_owner"
  on public.agency_members for delete
  using (exists (select 1 from public.agencies a where a.id = agency_id and a.owner_id = auth.uid()));

-- agency_clients: any member of the owning agency has full CRUD.
drop policy if exists "agency_clients_all_member" on public.agency_clients;
create policy "agency_clients_all_member"
  on public.agency_clients for all
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));

-- agency_domains: same membership scope.
drop policy if exists "agency_domains_all_member" on public.agency_domains;
create policy "agency_domains_all_member"
  on public.agency_domains for all
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));
