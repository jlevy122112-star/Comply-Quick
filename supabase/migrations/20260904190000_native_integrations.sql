-- Native CMS integrations (Webflow + WordPress) with unified event-log support.
--
-- This coexists with public.integrations (advanced generic webhooks) and reuses
-- connector.platform_webhook_events as the single durable append-only event log.

create table if not exists public.native_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  client_seat_id uuid references public.agency_clients (id) on delete set null,
  platform text not null check (platform in ('webflow', 'wordpress')),
  status text not null default 'pending' check (status in ('pending', 'active', 'degraded', 'revoked')),
  mode text not null default 'propose_only' check (mode in ('propose_only', 'auto')),
  external_account_id text not null,
  install_metadata jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  revoked_reason text,
  last_verified_at timestamptz,
  last_sync_at timestamptz,
  last_error jsonb,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, workspace_id, platform, external_account_id)
);

create index if not exists native_integrations_org_client_platform_status_updated_idx
  on public.native_integrations (organization_id, client_seat_id, platform, status, updated_at desc);

create index if not exists native_integrations_workspace_idx
  on public.native_integrations (workspace_id, updated_at desc);

create index if not exists native_integrations_client_idx
  on public.native_integrations (client_seat_id, updated_at desc);

alter table public.native_integrations enable row level security;

drop policy if exists native_integrations_select_org_member on public.native_integrations;
create policy native_integrations_select_org_member on public.native_integrations
  for select using (public.is_org_member(organization_id));

drop policy if exists native_integrations_insert_org_admin on public.native_integrations;
create policy native_integrations_insert_org_admin on public.native_integrations
  for insert with check (
    public.is_org_admin(organization_id)
    and (
      workspace_id is null
      or exists (
        select 1
        from public.workspaces w
        where w.id = workspace_id
          and w.organization_id = native_integrations.organization_id
      )
    )
    and (
      client_seat_id is null
      or exists (
        select 1
        from public.agency_clients c
        where c.id = client_seat_id
          and c.organization_id = native_integrations.organization_id
      )
    )
  );

drop policy if exists native_integrations_update_org_admin on public.native_integrations;
create policy native_integrations_update_org_admin on public.native_integrations
  for update
  using (public.is_org_admin(organization_id))
  with check (
    public.is_org_admin(organization_id)
    and (
      workspace_id is null
      or exists (
        select 1
        from public.workspaces w
        where w.id = workspace_id
          and w.organization_id = native_integrations.organization_id
      )
    )
    and (
      client_seat_id is null
      or exists (
        select 1
        from public.agency_clients c
        where c.id = client_seat_id
          and c.organization_id = native_integrations.organization_id
      )
    )
  );

-- No delete policy by design: integrations are soft-revoked (status='revoked').

grant select, insert, update on public.native_integrations to authenticated;
grant all privileges on public.native_integrations to service_role;

-- Unified durable event-log idempotency support.
alter table connector.platform_webhook_events
  add column if not exists native_integration_id uuid references public.native_integrations (id) on delete set null;

alter table connector.platform_webhook_events
  add column if not exists event_key text;

create unique index if not exists platform_webhook_events_event_key_uidx
  on connector.platform_webhook_events (event_key)
  where event_key is not null;

create index if not exists platform_webhook_events_native_integration_idx
  on connector.platform_webhook_events (native_integration_id, created_at desc);

-- Backfill from connector CMS connections where available.
insert into public.native_integrations (
  organization_id,
  workspace_id,
  client_seat_id,
  platform,
  status,
  mode,
  external_account_id,
  install_metadata,
  connected_at,
  last_verified_at,
  created_at,
  updated_at
)
select
  c.agency_org_id as organization_id,
  w.id as workspace_id,
  c.client_seat_id,
  c.platform,
  case
    when c.status in ('pending', 'active', 'degraded', 'revoked') then c.status
    else 'pending'
  end as status,
  case
    when c.mode in ('propose_only', 'auto') then c.mode
    else 'propose_only'
  end as mode,
  c.external_account_id,
  jsonb_build_object('source', 'connector.connector_connections', 'connection_id', c.id),
  c.created_at,
  c.last_verified_at,
  c.created_at,
  now()
from connector.connector_connections c
left join lateral (
  select ws.id
  from public.workspaces ws
  where ws.organization_id = c.agency_org_id
  order by ws.created_at asc
  limit 1
) w on true
where c.platform in ('webflow', 'wordpress')
  and not exists (
    select 1
    from public.native_integrations n
    where n.organization_id = c.agency_org_id
      and n.workspace_id is not distinct from w.id
      and n.platform = c.platform
      and n.external_account_id = c.external_account_id
  );
