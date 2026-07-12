-- Comply-Quick — Agency client onboarding intake.
-- Stores the structured pre-project intake an agency collects from a new client
-- (business discovery, assets, technical, logistics, compliance context) as one
-- record per agency_client. Answers live in a validated jsonb blob so the intake
-- schema can evolve in app code without a migration per field; status/timestamps
-- are typed columns for querying and workflow.

create table if not exists public.agency_onboarding_intake (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.agency_clients (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One intake per client.
  unique (client_id)
);

create index if not exists agency_onboarding_intake_agency_idx
  on public.agency_onboarding_intake (agency_id);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Same membership scope as agency_clients: any member of the owning agency has
-- full CRUD. Reuses the SECURITY DEFINER helper from 0005 to avoid recursion.
alter table public.agency_onboarding_intake enable row level security;

drop policy if exists "agency_onboarding_intake_all_member" on public.agency_onboarding_intake;
create policy "agency_onboarding_intake_all_member"
  on public.agency_onboarding_intake for all
  using (public.is_agency_member(agency_id))
  with check (public.is_agency_member(agency_id));
