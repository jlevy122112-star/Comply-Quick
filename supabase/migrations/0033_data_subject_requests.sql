-- Data-subject requests (DSAR) — access/export and erasure request ledger.
--
-- Records every self-service data export and account-deletion request for
-- audit/accountability under GDPR Art. 15/17 and US state privacy laws
-- (CCPA/CPRA access & deletion rights). `user_id` is intentionally a plain uuid
-- (NOT a FK to auth.users with cascade): the row must survive account deletion
-- so it remains as durable evidence that an erasure request was fulfilled.
--
-- Rows are append-only from the user's perspective: authenticated users may
-- create and read their own requests, but cannot update or delete them. Status
-- transitions (pending -> completed/failed) are performed by the service-role
-- client, which bypasses RLS.

create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- 'export' = access/portability (Art. 15/20); 'deletion' = erasure (Art. 17).
  type text not null check (type in ('export', 'deletion')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Free-form summary of what was exported/erased (e.g. row counts), for audit.
  detail jsonb,
  unique (id)
);

create index if not exists data_subject_requests_user_idx
  on public.data_subject_requests (user_id, requested_at desc);

alter table public.data_subject_requests enable row level security;

-- Users can see their own request history.
drop policy if exists dsr_select_own on public.data_subject_requests;
create policy dsr_select_own on public.data_subject_requests
  for select
  using (auth.uid() = user_id);

-- Users can file a request for themselves.
drop policy if exists dsr_insert_own on public.data_subject_requests;
create policy dsr_insert_own on public.data_subject_requests
  for insert
  with check (auth.uid() = user_id);

-- Intentionally no update/delete policies: the ledger is immutable to users.
-- The service role (bypasses RLS) updates status and records completion.
