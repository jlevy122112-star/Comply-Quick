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

-- Append-only audit ledger. Enforced immutable via triggers (no update/delete).
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
  before update or delete on connector_audit_ledger
  for each row execute function connector_audit_ledger_immutable();
