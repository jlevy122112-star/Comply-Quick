-- Alert impacts (framework §3.7 / C11).
--
-- When the Autopilot pipeline detects a regulatory change and opens a per-project
-- remediation proposal, it also records an `alert_impacts` row capturing exactly
-- which project the change hit and how many points it costs the displayed
-- compliance score until the user approves the fix. This makes regulatory
-- exposure first-class and queryable per project (instead of only implied by a
-- proposal), and drives the score penalty that urges re-engagement.

create table if not exists public.alert_impacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  version_id uuid references public.document_versions (id) on delete set null,
  regulation_id text not null default '',
  regulation_name text not null default '',
  risk_level text not null default 'medium'
    check (risk_level in ('low', 'medium', 'high')),
  score_penalty integer not null default 0,
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists alert_impacts_user_status_idx
  on public.alert_impacts (user_id, status, created_at desc);
create index if not exists alert_impacts_project_idx
  on public.alert_impacts (project_id, status);

alter table public.alert_impacts enable row level security;

-- Owner may read their own impact rows. Writes happen via the service-role
-- admin client (the cron pipeline) and the resolve flow, both owner-scoped.
drop policy if exists "alert_impacts_select_own" on public.alert_impacts;
create policy "alert_impacts_select_own"
  on public.alert_impacts for select
  using (user_id = auth.uid());

drop policy if exists "alert_impacts_update_own" on public.alert_impacts;
create policy "alert_impacts_update_own"
  on public.alert_impacts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Members of a shared project may read its impacts (mirrors the additive
-- member-read policies added in 0024).
drop policy if exists "alert_impacts_select_member" on public.alert_impacts;
create policy "alert_impacts_select_member"
  on public.alert_impacts for select
  using (public.is_project_member(project_id));
