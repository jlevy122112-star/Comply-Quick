-- Comply-Quick — Agency/Enterprise white-label custom documents.
--
-- Lets an agency workspace store reusable compliance/policy documents that can be
-- surfaced on white-labeled client portals. Each document belongs to an agency
-- and is scoped to agency members via RLS.

create table if not exists public.agency_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  regulation_name text,
  summary text,
  content text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_documents_agency_idx
  on public.agency_documents (agency_id, updated_at desc);

-- Keep updated_at current on edits.
create or replace function public.set_agency_document_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agency_documents_updated_at on public.agency_documents;
create trigger agency_documents_updated_at
  before update on public.agency_documents
  for each row
  execute function public.set_agency_document_updated_at();

-- RLS: members of the owning agency can manage documents.
alter table public.agency_documents enable row level security;

drop policy if exists "agency_documents_all_member" on public.agency_documents;
create policy "agency_documents_all_member"
  on public.agency_documents for all
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));
