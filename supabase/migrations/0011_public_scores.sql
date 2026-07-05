-- Comply-Quick — Public score pages & embeddable badges (Phase 4 / [Up4]).
--
-- Lets a user publish a shareable, public compliance-score page + badge from
-- one of their scans:
--   • published_scores — an opt-in, revocable snapshot of a scan's score,
--                        addressed by an unguessable public `slug`. The score
--                        and url are copied at publish time so the public page
--                        is stable even if the underlying scan is deleted or
--                        re-run. Revoking sets `revoked_at` (soft delete) so
--                        badges embedded elsewhere degrade to "revoked".
--
-- Numbered 0011 to sit after metered API (0010).

create table if not exists public.published_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_id uuid not null references public.scans (id) on delete cascade,
  -- Unguessable public identifier used in /score/<slug> and the badge URL.
  slug text not null unique,
  -- Snapshot at publish time — the public page never reads the live scan.
  url text not null,
  label text,
  score integer not null check (score between 0 and 100),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists published_scores_user_idx
  on public.published_scores (user_id, created_at desc);

-- A user publishes at most one live page per scan; revoked rows don't count.
create unique index if not exists published_scores_scan_live_idx
  on public.published_scores (scan_id)
  where revoked_at is null;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.published_scores enable row level security;

-- Owners manage (create/read/revoke) their own published scores.
drop policy if exists "published_scores_all_own" on public.published_scores;
create policy "published_scores_all_own"
  on public.published_scores for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anyone (including anonymous visitors) may read a live, non-revoked page.
-- This is intentional: published scores are public by design.
drop policy if exists "published_scores_public_read" on public.published_scores;
create policy "published_scores_public_read"
  on public.published_scores for select
  to anon, authenticated
  using (revoked_at is null);
