-- Comply-Quick — government-grade system audit log.
--
-- Append-only record of consequential system events. Retention is handled by the
-- monthly archive job; rows older than 90 days are compressed, moved to encrypted
-- storage, and then deleted from this table. The table intentionally has no
-- UPDATE or DELETE policies for authenticated roles — only the service role
-- (used by trusted server code) can modify it.

create table if not exists public.system_audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type varchar(100) not null,
  actor_id uuid,
  actor_type varchar(50) not null,
  target_resource varchar(255),
  ip_address varchar(45),
  details jsonb not null default '{}'::jsonb,
  -- Optional tenant scoping for filtered queries without parsing target_resource.
  organization_id uuid
);

create index if not exists idx_audit_event_type
  on public.system_audit_logs (event_type);
create index if not exists idx_audit_created_at
  on public.system_audit_logs (created_at);
create index if not exists idx_audit_organization_created
  on public.system_audit_logs (organization_id, created_at desc);

alter table public.system_audit_logs enable row level security;

-- Authenticated users can only read their own entries; admin/enterprise views use
-- the service-role client. No UPDATE or DELETE policies exist.
drop policy if exists "system_audit_logs_select_actor" on public.system_audit_logs;
create policy "system_audit_logs_select_actor" on public.system_audit_logs
  for select using (actor_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for authenticated roles; service role bypasses RLS.
