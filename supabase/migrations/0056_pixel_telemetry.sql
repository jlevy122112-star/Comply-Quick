-- Comply-Quick — Headless compliance pixel telemetry.
--
-- Provides a lightweight JS snippet (`/api/compliance-agent.js`) that agency
-- clients can install on their sites. Events are sent back to `/api/pixel`
-- using an API key from the `api_keys` table and stored here, RLS-isolated by
-- the key owner.

create table if not exists public.pixel_events (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  title text,
  referrer text,
  -- Free-form metadata from the pixel (e.g. consent state, path, viewport).
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pixel_events_user_created_idx
  on public.pixel_events (user_id, created_at desc);
create index if not exists pixel_events_api_key_created_idx
  on public.pixel_events (api_key_id, created_at desc);

alter table public.pixel_events enable row level security;

-- Users can only read their own pixel events.
drop policy if exists "pixel_events_select_own" on public.pixel_events;
create policy "pixel_events_select_own"
  on public.pixel_events for select
  using (user_id = auth.uid());
