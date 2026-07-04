-- Comply-Quick initial schema
-- Users are managed by Supabase Auth (auth.users). We keep app-level data in public tables
-- keyed by the auth user id, protected by Row Level Security.

-- ─── subscriptions ───────────────────────────────────────────────────────────
-- One row per user capturing their current paid entitlement. Written by the
-- Stripe webhook (service role), read by the app to gate premium content.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'single', 'agency', 'enterprise')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

-- ─── projects ────────────────────────────────────────────────────────────────
-- Saved compliance packages, one row per generated project, scoped per user.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  framework text not null,
  tracking_pixels text[] not null default '{}',
  target_regions text[] not null default '{}',
  compliance_modules text[] not null default '{}',
  compliance_score jsonb not null,
  status text not null default 'current' check (status in ('current', 'outdated', 'action_needed')),
  package_markdown text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_created_at_idx
  on public.projects (user_id, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;
alter table public.projects enable row level security;

-- subscriptions: a user can read only their own row. Writes happen via the
-- service role (Stripe webhook), which bypasses RLS, so no write policy is granted
-- to authenticated users.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- projects: full CRUD limited to the owning user.
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ─── auto-provision a free subscription row on signup ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, tier, status)
  values (new.id, 'free', 'inactive')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
