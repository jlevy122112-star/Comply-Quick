-- Consent records — server-side proof-of-consent audit trail.
--
-- The generated cookie banner stores a visitor's choice in their browser
-- (localStorage), but GDPR Art. 7(1) requires the controller to be able to
-- *demonstrate* that consent was given. This append-only ledger records each
-- consent decision captured from a merchant's site so the account owner has an
-- auditable record (who/when/what categories/which policy version), independent
-- of the visitor's device.
--
-- Rows are pseudonymous: `subject_ref` is an opaque id minted client-side, not
-- an account. Writes arrive from the public /api/consent endpoint via the
-- service-role client (bypasses RLS); reads are restricted by RLS to the owner
-- of the parent project.

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  -- Opaque, client-minted visitor id. Pseudonymous — not linkable to an account.
  subject_ref text not null,
  -- What the visitor chose.
  action text not null check (
    action in ('accept_all', 'reject_non_essential', 'custom', 'withdraw', 'do_not_sell')
  ),
  -- Categories consented to at decision time (e.g. ['analytics','advertising']).
  categories text[] not null default '{}',
  -- The consent model in force when the decision was made.
  consent_model text not null default 'opt-in' check (consent_model in ('opt-in', 'opt-out', 'notice')),
  -- Version of the privacy/cookie policy the visitor consented against.
  policy_version text,
  -- Coarse region label for the decision (e.g. 'eu', 'us-ca'), for audit.
  region text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists consent_records_project_idx
  on public.consent_records (project_id, created_at desc);
create index if not exists consent_records_subject_idx
  on public.consent_records (project_id, subject_ref, created_at desc);

alter table public.consent_records enable row level security;

-- The project owner can read their site's consent ledger.
drop policy if exists consent_select_owner on public.consent_records;
create policy consent_select_owner on public.consent_records
  for select
  using (
    exists (
      select 1
      from public.projects p
      where p.id = consent_records.project_id
        and p.user_id = auth.uid()
    )
  );

-- Intentionally no insert/update/delete policies: the ledger is written only by
-- the service role (public endpoint) and is immutable thereafter.
