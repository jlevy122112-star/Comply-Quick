-- Comply-Quick — Custom document sharing, branding, and email.
--
-- Adds per-client association, a public share token, and email/share timestamps
-- to agency_documents so white-label documents can be branded per client,
-- shared with customers via a public link, and emailed to clients.

alter table public.agency_documents
  add column if not exists client_id uuid references public.agency_clients (id) on delete set null,
  add column if not exists shared_token text,
  add column if not exists shared_at timestamptz,
  add column if not exists emailed_at timestamptz;

-- Public share token must be unique when set.
create unique index if not exists agency_documents_shared_token_idx
  on public.agency_documents (shared_token)
  where shared_token is not null;

create index if not exists agency_documents_client_idx
  on public.agency_documents (client_id, updated_at desc);
