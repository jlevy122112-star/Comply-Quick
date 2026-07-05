-- Comply-Quick — One-way calendar feed subscriptions (Phase 9 / [Up7]).
--
-- Lets a user link the compliance calendar to a personal or business calendar
-- of their choosing (Google / Outlook / Apple) via a subscribable ICS feed.
-- The flow is strictly one-way: OUR events are projected INTO the client's
-- calendar. Nothing is read back.
--
--   • calendar_feeds — an unguessable per-user `token` addressing a public,
--                      read-only ICS endpoint (/api/calendar/feed/<token>.ics).
--                      Revoking sets `revoked_at` (soft delete) so a leaked or
--                      rotated URL stops resolving. A user has at most one live
--                      feed; rotating revokes the old token and issues a new one.
--
-- Numbered 0014 to sit after the calendar table (0013).

create table if not exists public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Unguessable token embedded in the public subscription URL.
  token text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists calendar_feeds_user_idx
  on public.calendar_feeds (user_id, created_at desc);

-- At most one live (non-revoked) feed per user.
create unique index if not exists calendar_feeds_user_live_idx
  on public.calendar_feeds (user_id)
  where revoked_at is null;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.calendar_feeds enable row level security;

-- Owners manage (create/read/rotate/revoke) their own feed tokens. The public
-- ICS endpoint itself reads via the service-role client (keyed by token), so no
-- anonymous SELECT policy is granted here — the token is the capability.
drop policy if exists "calendar_feeds_all_own" on public.calendar_feeds;
create policy "calendar_feeds_all_own"
  on public.calendar_feeds for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
