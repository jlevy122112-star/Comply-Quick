-- Free scan claims remain one-per-email even when an unconsumed token expires.
alter table public.free_scan_claims
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

drop policy if exists "free_scan_claims_deny_anon" on public.free_scan_claims;
create policy "free_scan_claims_deny_anon"
  on public.free_scan_claims for all to anon
  using (false) with check (false);
drop policy if exists "free_scan_claims_deny_authenticated" on public.free_scan_claims;
create policy "free_scan_claims_deny_authenticated"
  on public.free_scan_claims for all to authenticated
  using (false) with check (false);

create index if not exists free_scan_claims_expiry_idx
  on public.free_scan_claims (expires_at)
  where used_at is null;

-- Public scans begin outside a workspace. Once associated with a workspace by a
-- trusted server workflow, the same event is visible only to workspace members.
create table if not exists public.public_scan_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.free_scan_claims (id) on delete restrict,
  workspace_id uuid references public.workspaces (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  url text not null,
  score integer not null check (score between 0 and 100),
  result jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists public_scan_events_workspace_created_idx
  on public.public_scan_events (workspace_id, created_at desc);
create index if not exists public_scan_events_claim_created_idx
  on public.public_scan_events (claim_id, created_at desc);

alter table public.public_scan_events enable row level security;

drop policy if exists "public_scan_events_select_workspace_member" on public.public_scan_events;
create policy "public_scan_events_select_workspace_member"
  on public.public_scan_events for select
  using (workspace_id is not null and public.is_workspace_member(workspace_id));

-- Claims and telemetry are written by trusted server routes with the service
-- role. No anon/authenticated insert, update, or delete policy is intentional.