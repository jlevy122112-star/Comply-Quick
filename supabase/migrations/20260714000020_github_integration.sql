-- Comply-Quick — GitHub integration for source-code compliance findings.
--
-- Adds GitHub to the connector platform list, stores per-repo scan findings,
-- and supports an async job pipeline that parses repositories for privacy/
-- compliance signals (policies, consent code, trackers).

-- Add GitHub to supported connector platforms.
alter table connector.connector_connections
  drop constraint if exists connector_connections_platform_check;

alter table connector.connector_connections
  add constraint connector_connections_platform_check
  check (platform in (
    'shopify','gtm','woocommerce','webflow','bigcommerce','hubspot','ga4','klaviyo','wordpress','github'
  ));

-- Findings discovered in a connected GitHub repository.
create table if not exists connector.github_findings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connector.connector_connections (id) on delete cascade,
  repo_full_name text not null,
  path text,
  finding_type text not null check (
    finding_type in ('missing_privacy_policy','missing_cookie_disclosure','tracker_detected','consent_snippet','sensitive_data','data_sharing')
  ),
  severity text not null default 'medium' check (severity in ('low','medium','high')),
  message text not null,
  line_number integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists github_findings_connection_idx
  on connector.github_findings (connection_id, created_at desc);
create index if not exists github_findings_repo_idx
  on connector.github_findings (repo_full_name, finding_type);

alter table connector.github_findings enable row level security;

drop policy if exists github_findings_select on connector.github_findings;
create policy github_findings_select on connector.github_findings
  for select using (
    exists (
      select 1 from connector.connector_connections c
      where c.id = connection_id and public.is_org_member(c.agency_org_id)
    )
  );
