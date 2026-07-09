-- Comply-Quick — Quick-tool usage tracking.
--
-- Records when a signed-in user generates output from a quick tool (cookie
-- consent banner, DPA, subprocessor map). This is the activation signal that
-- drives the onboarding-completion tracker and "next best action" guidance on
-- the Command Center — previously those tool steps could never complete because
-- nothing persisted their use.
--
-- Rows are user-scoped: a user may insert and read only their own events.
--
-- One row per (user, tool): the consumer only cares about the distinct set of
-- tools a user has used, so the unique constraint caps storage at 3 rows/user
-- (via ON CONFLICT DO NOTHING at the write) while preserving the first-use
-- timestamp for activation analytics.

create table if not exists public.tool_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (tool in ('cookie_banner', 'dpa', 'subprocessors')),
  created_at timestamptz not null default now(),
  constraint tool_usage_events_user_tool_key unique (user_id, tool)
);

create index if not exists tool_usage_events_user_idx on public.tool_usage_events (user_id);

alter table public.tool_usage_events enable row level security;

-- A signed-in user may record their own tool usage.
drop policy if exists tool_usage_insert_own on public.tool_usage_events;
create policy tool_usage_insert_own on public.tool_usage_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- A signed-in user may read their own tool usage.
drop policy if exists tool_usage_select_own on public.tool_usage_events;
create policy tool_usage_select_own on public.tool_usage_events
  for select to authenticated
  using (auth.uid() = user_id);
