-- GitHub App monitoring: installation metadata, push-event ingestion, and async scan queue.

alter table connector.connector_connections
  add column if not exists integration_type text not null default 'oauth_app'
    check (integration_type in ('oauth_app', 'github_app'));

alter table connector.connector_connections
  add column if not exists github_installation_id bigint;

alter table connector.connector_connections
  add column if not exists github_installation_target_type text
    check (github_installation_target_type in ('user', 'organization', 'repository'));

alter table connector.connector_connections
  add column if not exists github_installation_target_login text;

alter table connector.connector_connections
  add column if not exists github_repository_selection text
    check (github_repository_selection in ('all', 'selected'));

alter table connector.connector_connections
  add column if not exists install_metadata jsonb not null default '{}'::jsonb;

alter table connector.connector_connections
  add column if not exists last_webhook_at timestamptz;

create unique index if not exists connector_connections_github_installation_uidx
  on connector.connector_connections (github_installation_id);

create table if not exists connector.github_push_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connector.connector_connections (id) on delete cascade,
  github_installation_id bigint not null,
  delivery_id text not null,
  event_type text not null,
  repo_id bigint,
  repo_full_name text not null,
  ref_name text,
  before_sha text,
  after_sha text,
  pushed_at timestamptz,
  sender_login text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (delivery_id)
);

create index if not exists github_push_events_connection_created_idx
  on connector.github_push_events (connection_id, created_at desc);

create index if not exists github_push_events_repo_sha_idx
  on connector.github_push_events (repo_full_name, after_sha);

alter table connector.github_push_events enable row level security;

drop policy if exists github_push_events_select on connector.github_push_events;
create policy github_push_events_select on connector.github_push_events
  for select using (
    exists (
      select 1 from connector.connector_connections c
      where c.id = connection_id and public.is_org_member(c.agency_org_id)
    )
  );

create table if not exists connector.github_scan_queue (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connector.connector_connections (id) on delete cascade,
  github_installation_id bigint not null,
  repo_id bigint,
  repo_full_name text not null,
  ref_name text,
  head_sha text,
  enqueue_source text not null default 'push'
    check (enqueue_source in ('push', 'manual')),
  push_event_id uuid references connector.github_push_events (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  last_error text,
  worker_id text,
  findings_count integer,
  dedupe_key text,
  created_by uuid references auth.users (id) on delete set null,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists github_scan_queue_status_queued_idx
  on connector.github_scan_queue (status, queued_at asc);

create index if not exists github_scan_queue_connection_updated_idx
  on connector.github_scan_queue (connection_id, updated_at desc);

alter table connector.github_scan_queue enable row level security;

drop policy if exists github_scan_queue_select on connector.github_scan_queue;
create policy github_scan_queue_select on connector.github_scan_queue
  for select using (
    exists (
      select 1 from connector.connector_connections c
      where c.id = connection_id and public.is_org_member(c.agency_org_id)
    )
  );

grant select on connector.github_push_events to authenticated;
grant select on connector.github_scan_queue to authenticated;
grant all privileges on connector.github_push_events to service_role;
grant all privileges on connector.github_scan_queue to service_role;
