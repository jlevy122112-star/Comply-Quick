-- Comply-Quick — Phase 6: Template Marketplace (Creator accounts + Stripe Connect)
-- Lets premium users publish reusable compliance templates that other users can
-- browse, preview, and buy. Payouts to creators run through Stripe Connect
-- (destination charges with a platform application fee). Additive + backward
-- compatible: no existing table is altered.

-- ─── marketplace_creators ────────────────────────────────────────────────────
-- A seller profile, one per user. `stripe_account_id` is the connected Stripe
-- account; `payouts_enabled` mirrors Stripe's charges_enabled and is flipped by
-- the account.updated webhook once onboarding completes.
create table if not exists public.marketplace_creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  slug text not null unique,
  bio text not null default '',
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One seller profile per user.
  unique (user_id)
);

create index if not exists marketplace_creators_user_idx on public.marketplace_creators (user_id);

-- ─── marketplace_templates ───────────────────────────────────────────────────
-- A listing. `content` holds the reusable wizard preset (framework, pixels,
-- regions, modules) applied on purchase. `price_cents` = 0 means free. Only
-- `published` listings are publicly visible; `sales_count` is denormalized for
-- cheap sorting/browse.
create table if not exists public.marketplace_templates (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.marketplace_creators (id) on delete cascade,
  title text not null,
  slug text not null unique,
  summary text not null default '',
  description text not null default '',
  category text not null default 'general'
    check (category in ('general', 'ecommerce', 'saas', 'healthcare', 'finance', 'agency')),
  price_cents integer not null default 0
    check (price_cents >= 0 and price_cents <= 1000000),
  currency text not null default 'usd',
  content jsonb not null default '{}'::jsonb,
  preview text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'unlisted')),
  sales_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketplace_templates_creator_idx
  on public.marketplace_templates (creator_id, created_at desc);
-- Browse/search: published listings ordered by popularity.
create index if not exists marketplace_templates_published_idx
  on public.marketplace_templates (status, sales_count desc)
  where status = 'published';

-- ─── marketplace_purchases ───────────────────────────────────────────────────
-- A buyer's entitlement to a template. Created `pending` when checkout starts
-- and flipped to `paid` by the checkout.session.completed webhook. `platform_
-- fee_cents` records the application fee we retained. A buyer owns a template
-- at most once.
create table if not exists public.marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.marketplace_templates (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  amount_cents integer not null default 0,
  platform_fee_cents integer not null default 0,
  currency text not null default 'usd',
  stripe_session_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, buyer_id)
);

create index if not exists marketplace_purchases_buyer_idx
  on public.marketplace_purchases (buyer_id, created_at desc);
create index if not exists marketplace_purchases_template_idx
  on public.marketplace_purchases (template_id);

-- ─── RLS helpers (SECURITY DEFINER to avoid policy recursion) ─────────────────
-- True when the caller owns the creator profile that owns the template. Runs as
-- definer so it can read creators/templates without recursing into their RLS.
create or replace function public.owns_template(t_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.marketplace_templates t
    join public.marketplace_creators c on c.id = t.creator_id
    where t.id = t_id and c.user_id = auth.uid()
  );
$$;

-- Atomically bumps a template's denormalized sales counter. SECURITY DEFINER so
-- the webhook (service-role) and free-claim path can call it without a policy.
create or replace function public.increment_template_sales(t_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.marketplace_templates set sales_count = sales_count + 1 where id = t_id;
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.marketplace_creators enable row level security;
alter table public.marketplace_templates enable row level security;
alter table public.marketplace_purchases enable row level security;

-- creators: profiles are publicly readable (needed to show the seller on a
-- listing); only the owner may write their own row.
drop policy if exists "creators_select_all" on public.marketplace_creators;
create policy "creators_select_all"
  on public.marketplace_creators for select
  using (true);

drop policy if exists "creators_insert_own" on public.marketplace_creators;
create policy "creators_insert_own"
  on public.marketplace_creators for insert
  with check (user_id = auth.uid());

drop policy if exists "creators_update_own" on public.marketplace_creators;
create policy "creators_update_own"
  on public.marketplace_creators for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- templates: published listings are public; a creator additionally sees and
-- fully manages their own (any status).
drop policy if exists "templates_select_published_or_own" on public.marketplace_templates;
create policy "templates_select_published_or_own"
  on public.marketplace_templates for select
  using (
    status = 'published'
    or exists (
      select 1 from public.marketplace_creators c
      where c.id = creator_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "templates_insert_own" on public.marketplace_templates;
create policy "templates_insert_own"
  on public.marketplace_templates for insert
  with check (
    exists (select 1 from public.marketplace_creators c where c.id = creator_id and c.user_id = auth.uid())
  );

drop policy if exists "templates_update_own" on public.marketplace_templates;
create policy "templates_update_own"
  on public.marketplace_templates for update
  using (public.owns_template(id))
  with check (public.owns_template(id));

drop policy if exists "templates_delete_own" on public.marketplace_templates;
create policy "templates_delete_own"
  on public.marketplace_templates for delete
  using (public.owns_template(id));

-- purchases: a buyer sees their own; a creator sees purchases of their listings
-- (for the sales view). Writes go through the service-role webhook, so no
-- insert/update policy is granted to end users.
drop policy if exists "purchases_select_buyer_or_seller" on public.marketplace_purchases;
create policy "purchases_select_buyer_or_seller"
  on public.marketplace_purchases for select
  using (buyer_id = auth.uid() or public.owns_template(template_id));
