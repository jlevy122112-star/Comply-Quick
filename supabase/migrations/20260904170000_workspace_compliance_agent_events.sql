-- Workspace-scoped compliance agent telemetry.

create table if not exists public.compliance_agent_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_api_key_id uuid not null references public.client_api_keys (id) on delete restrict,
  url text not null,
  title text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists compliance_agent_events_workspace_created_idx
  on public.compliance_agent_events (workspace_id, created_at desc);

create index if not exists compliance_agent_events_org_created_idx
  on public.compliance_agent_events (organization_id, created_at desc);

create index if not exists compliance_agent_events_key_created_idx
  on public.compliance_agent_events (client_api_key_id, created_at desc);

alter table public.compliance_agent_events enable row level security;

drop policy if exists "compliance_agent_events_select_member" on public.compliance_agent_events;
create policy "compliance_agent_events_select_member"
  on public.compliance_agent_events for select
  using (public.org_role(organization_id) is not null);
