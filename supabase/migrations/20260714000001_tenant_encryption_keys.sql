-- Enterprise field-level envelope encryption foundation.
--
-- Only wrapped data-encryption keys are persisted. Plaintext DEKs and the
-- key-encryption key remain in the application/KMS boundary.

create table if not exists public.tenant_encryption_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  wrapped_dek text not null,
  algorithm text not null default 'AES-256-GCM',
  kek_id text not null,
  kek_version text not null,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_rotated_at timestamptz,
  unique (organization_id)
);

create index if not exists tenant_encryption_keys_status_idx
  on public.tenant_encryption_keys (organization_id, status);

alter table public.tenant_encryption_keys enable row level security;

-- Service-role operations bypass RLS. Explicit deny policies document that
-- browser/session clients must never read or mutate wrapped tenant keys.
drop policy if exists tenant_encryption_keys_select_service_only on public.tenant_encryption_keys;
create policy tenant_encryption_keys_select_service_only on public.tenant_encryption_keys
  for select using (false);

drop policy if exists tenant_encryption_keys_insert_service_only on public.tenant_encryption_keys;
create policy tenant_encryption_keys_insert_service_only on public.tenant_encryption_keys
  for insert with check (false);

drop policy if exists tenant_encryption_keys_update_service_only on public.tenant_encryption_keys;
create policy tenant_encryption_keys_update_service_only on public.tenant_encryption_keys
  for update using (false) with check (false);

drop policy if exists tenant_encryption_keys_delete_service_only on public.tenant_encryption_keys;
create policy tenant_encryption_keys_delete_service_only on public.tenant_encryption_keys
  for delete using (false);
