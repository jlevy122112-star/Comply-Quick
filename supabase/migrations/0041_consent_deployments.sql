-- Managed consent deployments.
-- A deployment is the accountable, verifiable configuration behind a generated
-- banner. The public id is safe to embed in a merchant's page; the internal id
-- is retained in the evidence ledger for joins and owner-only reporting.

create table if not exists public.consent_deployments (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  site_url text not null,
  site_origin text not null,
  privacy_policy_url text not null,
  policy_version text not null,
  regions text[] not null default '{}',
  pixels text[] not null default '{}',
  enforcement_mode text not null default 'automatic'
    check (enforcement_mode in ('automatic', 'event_only')),
  status text not null default 'ready'
    check (status in ('ready', 'verified', 'paused')),
  last_verified_at timestamptz,
  verification_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consent_deployments_project_updated_idx
  on public.consent_deployments (project_id, updated_at desc);

alter table public.consent_deployments enable row level security;

drop policy if exists consent_deployments_select_owner on public.consent_deployments;
create policy consent_deployments_select_owner on public.consent_deployments
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = consent_deployments.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists consent_deployments_insert_owner on public.consent_deployments;
create policy consent_deployments_insert_owner on public.consent_deployments
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = consent_deployments.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists consent_deployments_update_owner on public.consent_deployments;
create policy consent_deployments_update_owner on public.consent_deployments
  for update using (
    exists (
      select 1 from public.projects p
      where p.id = consent_deployments.project_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = consent_deployments.project_id and p.user_id = auth.uid()
    )
  );

-- Retain the resolved, private deployment id with every choice. No write policy
-- is added: public writes still flow only through the service-role endpoint.
alter table public.consent_records
  add column if not exists deployment_id uuid references public.consent_deployments (id) on delete set null;

create index if not exists consent_records_deployment_created_idx
  on public.consent_records (deployment_id, created_at desc);
