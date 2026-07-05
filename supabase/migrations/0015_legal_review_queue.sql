-- Comply-Quick — Legal Review Queue ([Up10] Legal safeguards).
--
-- Scaffolding for the quarterly lawyer-review workflow. Tracks which pieces of
-- generated legal content (clause templates, regulation text, disclaimers, the
-- ToS) are due for professional review, their review status, reviewer, notes,
-- and the next scheduled review date.
--
-- This is internal, org-wide tooling — rows are NOT owned per end-user. RLS is
-- enabled with no permissive policies, so the anon/authenticated keys cannot
-- touch it; all access goes through the service-role client (createAdminClient)
-- behind an admin-email allowlist (LEGAL_REVIEW_ADMIN_EMAILS).
--
-- Numbered 0015 to sit after the calendar feeds (0014).

create table if not exists public.legal_review_items (
  id uuid primary key default gen_random_uuid(),
  -- Human-readable label for the artifact under review.
  title text not null,
  category text not null default 'clause_template'
    check (category in ('clause_template', 'regulation', 'disclaimer', 'tos')),
  -- Stable identifier of the reviewed artifact (e.g. clause key, regulation id).
  content_ref text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested')),
  -- Email/name of the professional who last reviewed the item.
  reviewer text,
  notes text not null default '',
  reviewed_at timestamptz,
  -- Next scheduled quarterly review (date-only).
  next_review_at date not null default (now() + interval '3 months')::date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists legal_review_items_status_idx
  on public.legal_review_items (status);
create index if not exists legal_review_items_next_review_idx
  on public.legal_review_items (next_review_at);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Enable RLS with no policies: only the service-role key (which bypasses RLS)
-- may read or write. The app gates access behind an admin allowlist in code.
alter table public.legal_review_items enable row level security;

-- ─── Seed the artifacts that ship today ──────────────────────────────────────
insert into public.legal_review_items (title, category, content_ref, next_review_at)
values
  ('Report disclaimer (mandatory)', 'disclaimer', 'REPORT_DISCLAIMER', (now() + interval '3 months')::date),
  ('Terms of Service — liability cap', 'tos', 'LIABILITY_CAP', (now() + interval '3 months')::date),
  ('Inward Contract Shield preambles', 'clause_template', 'LIABILITY_SHIFT_PREAMBLES', (now() + interval '3 months')::date),
  ('Framework liability clauses', 'clause_template', 'FRAMEWORK_LIABILITY_CLAUSES', (now() + interval '3 months')::date)
on conflict do nothing;
