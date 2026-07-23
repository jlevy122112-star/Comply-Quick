-- Comply-Quick — CMS plugin platform connections.
--
-- Expands the connector to support native CMS plugins (Webflow app, WordPress
-- plugin) and provides a durable audit of webhook events that announce when an
-- agency connects a new platform instance.

-- Adopt the schema used by the connector application code. Migration 0031
-- originally created these tables in public, so move them before using the
-- connector-qualified names below.
create schema if not exists connector;

grant usage on schema connector to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.connector_connections') is not null then
    alter table public.connector_connections set schema connector;
  end if;

  if to_regclass('public.connector_events') is not null then
    alter table public.connector_events set schema connector;
  end if;

  if to_regclass('public.connector_remediations') is not null then
    alter table public.connector_remediations set schema connector;
  end if;

  if to_regclass('public.connector_audit_ledger') is not null then
    alter table public.connector_audit_ledger set schema connector;
  end if;
end
$$;

-- Add WordPress to the supported connector platforms.
alter table connector.connector_connections
  drop constraint if exists connector_connections_platform_check;

alter table connector.connector_connections
  add constraint connector_connections_platform_check
  check (platform in (
    'shopify','gtm','woocommerce','webflow','bigcommerce','hubspot','ga4','klaviyo','wordpress'
  ));

-- Inbound webhook audit log for platform connection events.
-- Stored in the connector schema next to connector_events; this table is
-- append-only and scoped to the owning agency org.
create table if not exists connector.platform_webhook_events (
  id uuid primary key default gen_random_uuid(),
  agency_org_id uuid not null references public.organizations (id) on delete cascade,
  source text not null check (source in ('webflow','wordpress','supabase_db')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists platform_webhook_events_agency_idx
  on connector.platform_webhook_events (agency_org_id, created_at desc);

alter table connector.platform_webhook_events enable row level security;

drop policy if exists platform_webhook_events_select on connector.platform_webhook_events;
create policy platform_webhook_events_select on connector.platform_webhook_events
  for select using (public.is_org_member(agency_org_id));

drop policy if exists platform_webhook_events_insert on connector.platform_webhook_events;
create policy platform_webhook_events_insert on connector.platform_webhook_events
  for insert with check (public.is_org_admin(agency_org_id));
