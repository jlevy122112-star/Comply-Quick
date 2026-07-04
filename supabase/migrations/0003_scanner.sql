-- Comply-Quick — Phase 3: Compliance Scanner
-- Stores the result of scanning a public website for tracking tools and
-- compliance gaps. One row per scan; owned by the user who ran it. Free-tier
-- users get a monthly scan quota (enforced in app code); Pro is unlimited.

-- ─── scans ───────────────────────────────────────────────────────────────────
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  status text not null default 'completed'
    check (status in ('completed', 'failed')),
  score integer, -- 0-100 compliance score; null on failure
  detected_tools jsonb not null default '[]'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  summary text not null default '',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists scans_user_created_idx
  on public.scans (user_id, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.scans enable row level security;

-- A user reads, inserts, and deletes only their own scans.
drop policy if exists "scans_select_own" on public.scans;
create policy "scans_select_own"
  on public.scans for select
  using (auth.uid() = user_id);

drop policy if exists "scans_insert_own" on public.scans;
create policy "scans_insert_own"
  on public.scans for insert
  with check (auth.uid() = user_id);

drop policy if exists "scans_delete_own" on public.scans;
create policy "scans_delete_own"
  on public.scans for delete
  using (auth.uid() = user_id);
