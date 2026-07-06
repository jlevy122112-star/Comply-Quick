-- Comply-Quick — PMF Validation tooling ([Up11]).
--
-- Two capture tables that feed the PMF dashboard:
--   * nps_responses  — Net Promoter Score survey (0–10 + optional comment)
--   * churn_surveys  — cancellation "exit survey" reason + optional comment
--
-- Both carry an acquisition `channel` so retention/NPS can be segmented by
-- channel (organic / ads / affiliate / …). Rows are user-scoped: users may
-- insert their own response; only the service-role client (behind an admin
-- allowlist) reads aggregates for the dashboard.
--
-- Numbered 0016 to leave 0015 for the in-flight legal-review migration.

-- ─── NPS responses ───────────────────────────────────────────────────────────
create table if not exists public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  score smallint not null check (score between 0 and 10),
  comment text not null default '',
  channel text,
  created_at timestamptz not null default now()
);

create index if not exists nps_responses_created_idx on public.nps_responses (created_at);
create index if not exists nps_responses_channel_idx on public.nps_responses (channel);

alter table public.nps_responses enable row level security;

-- A signed-in user may submit their own NPS response.
drop policy if exists nps_insert_own on public.nps_responses;
create policy nps_insert_own on public.nps_responses
  for insert to authenticated
  with check (auth.uid() = user_id);

-- ─── Churn / exit surveys ────────────────────────────────────────────────────
create table if not exists public.churn_surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  reason text not null check (
    reason in ('too_expensive', 'missing_features', 'not_using', 'switched_tool', 'one_time_need', 'other')
  ),
  comment text not null default '',
  channel text,
  created_at timestamptz not null default now()
);

create index if not exists churn_surveys_created_idx on public.churn_surveys (created_at);
create index if not exists churn_surveys_reason_idx on public.churn_surveys (reason);

alter table public.churn_surveys enable row level security;

drop policy if exists churn_insert_own on public.churn_surveys;
create policy churn_insert_own on public.churn_surveys
  for insert to authenticated
  with check (auth.uid() = user_id);
