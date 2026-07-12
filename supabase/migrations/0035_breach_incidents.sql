-- Breach incidents — personal-data breach register & notification workflow.
--
-- GDPR Art. 33 requires notifying the supervisory authority within 72 hours of
-- becoming aware of a personal-data breach; Art. 34 requires notifying affected
-- data subjects without undue delay when the breach is likely to result in a
-- high risk. US state breach-notification laws and HIPAA impose their own
-- deadlines. This table is the controller's breach register: the durable record
-- of what happened, when it was discovered, who/what was affected, and when the
-- required notifications were made — the evidence of a compliant response.
--
-- `user_id` is intentionally a plain uuid (NOT a cascading FK to auth.users):
-- like the data_subject_requests ledger, a breach record is accountability
-- evidence that should survive account changes rather than vanish. RLS scopes
-- every row to its owner via auth.uid().

create table if not exists public.breach_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  description text,
  severity text not null default 'medium'
    check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'contained', 'notifying', 'resolved', 'closed')),
  -- When the controller became aware of the breach — the clock for Art. 33 72h.
  discovered_at timestamptz not null default now(),
  -- When the breach actually occurred, if known (may precede discovery).
  occurred_at timestamptz,
  contained_at timestamptz,
  affected_individuals integer not null default 0 check (affected_individuals >= 0),
  -- Categories of personal data involved (e.g. contact, financial, health).
  data_categories text[] not null default '{}',
  -- Affected jurisdictions, using the canonical TargetRegion ids.
  regions text[] not null default '{}',
  -- Whether the breach is likely to result in a high risk to individuals
  -- (drives the Art. 34 duty to notify data subjects).
  high_risk boolean not null default false,
  -- Timestamps recording that the required notifications were made.
  authority_notified_at timestamptz,
  individuals_notified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists breach_incidents_user_idx
  on public.breach_incidents (user_id, discovered_at desc);

alter table public.breach_incidents enable row level security;

-- Owners manage their own breach register: read, file, and update their rows.
drop policy if exists breach_select_own on public.breach_incidents;
create policy breach_select_own on public.breach_incidents
  for select
  using (auth.uid() = user_id);

drop policy if exists breach_insert_own on public.breach_incidents;
create policy breach_insert_own on public.breach_incidents
  for insert
  with check (auth.uid() = user_id);

drop policy if exists breach_update_own on public.breach_incidents;
create policy breach_update_own on public.breach_incidents
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Intentionally no delete policy: the register is kept as durable evidence of
-- the incident and the response. Status moves to 'closed' rather than deletion.
