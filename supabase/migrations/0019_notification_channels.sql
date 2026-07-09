-- Notification channels: mobile push tokens + per-user channel preferences.
--
-- The in-app `notifications` table (0002) stays the source of truth; these tables
-- let the dispatch layer fan every app change out to email and mobile push, with
-- per-category opt-outs. Populated by the app (RLS-scoped to the owner); the
-- cron/service role reads them to deliver.

-- ─── push tokens ────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Expo push token for the user's registered device.
  token text not null,
  platform text not null default 'unknown' check (platform in ('ios', 'android', 'web', 'unknown')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- ─── notification preferences ─────────────────────────────────────────────────
-- One row per user. `muted_categories` is a text[] of NotificationCategory values
-- the user has opted out of; empty = receive everything. Absent row = defaults.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  muted_categories text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.push_tokens enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "push_tokens_rw_own" on public.push_tokens;
create policy "push_tokens_rw_own"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notification_preferences_rw_own" on public.notification_preferences;
create policy "notification_preferences_rw_own"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
