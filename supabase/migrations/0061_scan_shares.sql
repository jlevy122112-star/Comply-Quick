-- Comply-Quick — Branded scanner report sharing.
--
-- Adds public share tokens, share/email timestamps, and an optional client link
-- to scans so agency/enterprise users can brand, email, print, and share
-- compliance scan reports with their customers.

alter table public.scans
  add column if not exists client_id uuid references public.agency_clients (id) on delete set null,
  add column if not exists shared_token text,
  add column if not exists shared_at timestamptz,
  add column if not exists emailed_at timestamptz;

-- Public share token must be unique when set.
create unique index if not exists scans_shared_token_idx
  on public.scans (shared_token)
  where shared_token is not null;

create index if not exists scans_client_idx
  on public.scans (client_id, created_at desc);

-- Allow users to update their own scans to set share/email metadata.
drop policy if exists "scans_update_own" on public.scans;
create policy "scans_update_own"
  on public.scans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
