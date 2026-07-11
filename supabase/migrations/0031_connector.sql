-- OAuth Compliance Connector — persistence for the continuous-compliance engine.
--
-- Stores agency-owned platform connections, encrypted OAuth tokens, the events
-- that wake the agent, remediation change sets, and an append-only audit ledger.
-- Tokens are stored ONLY as ciphertext produced by src/lib/connector/crypto.ts
-- (AES-256-GCM); plaintext tokens never touch the database.

create table if not exists connector_connections (
  id uuid primary key default gen_random_uuid(),
  agency_org_id uuid not null references organizations (id) on delete cascade,
  client_seat_id uuid,
  platform text not null check (
    platform in ('shopify','gtm','woocommerce','webflow','bigcommerce','hubspot','ga4','klaviyo')
  ),
  external_account_id text not null,
  status text not null default 'pending' check (
    status in ('pending','active','degraded','frozen','revoked')
  ),
  mode text not null default 'propose_only' check (mode in ('propose_only','auto')),
  scopes text[] not null default '{}',
  -- AES-256-GCM ciphertext (v1:iv:tag:ciphertext); never plaintext.
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz,
  unique (platform, external_account_id)
);

create index if not exists connector_connections_agency_idx
  on connector_connections (agency_org_id);

create table if not exists connector_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connector_connections (id) on delete cascade,
  type text not null check (type in ('webhook','regulation','heartbeat','token','user')),
  payload_ref text,
  received_at timestamptz not null default now()
);

create index if not exists connector_events_connection_idx
  on connector_events (connection_id, received_at desc);

create table if not exists connector_remediations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connector_connections (id) on delete cascade,
  trigger_event_id uuid references connector_events (id) on delete set null,
  changes jsonb not null default '[]'::jsonb,
  status text not null default 'proposed' check (
    status in ('proposed','applied','failed','reverted')
  ),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists connector_remediations_connection_idx
  on connector_remediations (connection_id, created_at desc);

-- Append-only audit ledger. Rows are immutable: RLS grants only SELECT/INSERT
-- to application roles (no UPDATE/DELETE policy) and a trigger blocks UPDATE.
-- DELETE is intentionally NOT trigger-blocked so administrative/cascade cleanup
-- (e.g. deleting an organization for data-erasure) is not permanently wedged;
-- app clients still cannot delete rows because RLS grants them no DELETE.
create table if not exists connector_audit_ledger (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connector_connections (id) on delete cascade,
  actor text not null check (actor in ('agent','user','system')),
  action text not null,
  previous_state_ref text,
  ok boolean not null default true,
  at timestamptz not null default now()
);

create index if not exists connector_audit_ledger_connection_idx
  on connector_audit_ledger (connection_id, at desc);

create or replace function connector_audit_ledger_immutable()
returns trigger as $$
begin
  raise exception 'connector_audit_ledger is append-only; % is not allowed', tg_op;
end;
$$ language plpgsql;

drop trigger if exists connector_audit_ledger_no_update on connector_audit_ledger;
create trigger connector_audit_ledger_no_update
  before update on connector_audit_ledger
  for each row execute function connector_audit_ledger_immutable();

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- All connector tables hold sensitive per-agency data (incl. encrypted OAuth
-- tokens on connector_connections). Supabase exposes every table via PostgREST,
-- so RLS MUST be enabled or any authenticated user could read/write tokens.
-- Access is scoped to members of the owning agency org; writes to the top-level
-- connection are gated to org owner/admins. Child tables inherit the scope via
-- their parent connection. (service_role, used by server-side jobs, bypasses RLS.)
alter table connector_connections enable row level security;
alter table connector_events enable row level security;
alter table connector_remediations enable row level security;
alter table connector_audit_ledger enable row level security;

-- connector_connections: members read; owner/admins manage.
drop policy if exists connector_connections_select on connector_connections;
create policy connector_connections_select on connector_connections
  for select using (public.is_org_member(agency_org_id));

drop policy if exists connector_connections_insert on connector_connections;
create policy connector_connections_insert on connector_connections
  for insert with check (public.is_org_admin(agency_org_id));

drop policy if exists connector_connections_update on connector_connections;
create policy connector_connections_update on connector_connections
  for update using (public.is_org_admin(agency_org_id))
  with check (public.is_org_admin(agency_org_id));

drop policy if exists connector_connections_delete on connector_connections;
create policy connector_connections_delete on connector_connections
  for delete using (public.is_org_admin(agency_org_id));

-- Helper: does the caller belong to the org that owns this connection?
create or replace function connector_caller_owns_connection(c_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from connector_connections c
    where c.id = c_id and public.is_org_member(c.agency_org_id)
  );
$$;

-- connector_events: members of the owning org read/insert.
drop policy if exists connector_events_select on connector_events;
create policy connector_events_select on connector_events
  for select using (connector_caller_owns_connection(connection_id));

drop policy if exists connector_events_insert on connector_events;
create policy connector_events_insert on connector_events
  for insert with check (connector_caller_owns_connection(connection_id));

-- connector_remediations: members of the owning org read/insert/update.
drop policy if exists connector_remediations_select on connector_remediations;
create policy connector_remediations_select on connector_remediations
  for select using (connector_caller_owns_connection(connection_id));

drop policy if exists connector_remediations_insert on connector_remediations;
create policy connector_remediations_insert on connector_remediations
  for insert with check (connector_caller_owns_connection(connection_id));

drop policy if exists connector_remediations_update on connector_remediations;
create policy connector_remediations_update on connector_remediations
  for update using (connector_caller_owns_connection(connection_id))
  with check (connector_caller_owns_connection(connection_id));

-- connector_audit_ledger: append-only — SELECT + INSERT only (no update/delete).
drop policy if exists connector_audit_ledger_select on connector_audit_ledger;
create policy connector_audit_ledger_select on connector_audit_ledger
  for select using (connector_caller_owns_connection(connection_id));

drop policy if exists connector_audit_ledger_insert on connector_audit_ledger;
create policy connector_audit_ledger_insert on connector_audit_ledger
  for insert with check (connector_caller_owns_connection(connection_id));
