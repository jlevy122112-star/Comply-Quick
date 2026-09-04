-- Phase 3 Step 1: workspace/organization-scoped Stripe subscription state.
--
-- Canonical billing source is organization-scoped, while legacy user-scoped
-- subscriptions remain readable during rollout for backward compatibility.

create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'solo', 'agency', 'enterprise')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions
  add column if not exists cancel_at timestamptz,
  add column if not exists canceled_at timestamptz;

create unique index if not exists organization_subscriptions_stripe_customer_uidx
  on public.organization_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists organization_subscriptions_stripe_subscription_uidx
  on public.organization_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists organization_subscriptions_owner_idx
  on public.organization_subscriptions (owner_user_id);

alter table public.organization_subscriptions enable row level security;

drop policy if exists organization_subscriptions_select_member on public.organization_subscriptions;
create policy organization_subscriptions_select_member
  on public.organization_subscriptions for select
  using (public.is_org_member(organization_id));

-- Backfill org-level rows from owner subscriptions where available.
-- Tier normalization: legacy single/pro keys map to solo.
insert into public.organization_subscriptions (
  organization_id,
  owner_user_id,
  tier,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_end,
  canceled_at,
  updated_at
)
select
  o.id,
  o.owner_id,
  case
    when s.tier in ('single', 'pro') then 'solo'
    when s.tier in ('free', 'solo', 'agency', 'enterprise') then s.tier
    when o.plan = 'free' then 'free'
    when o.plan = 'enterprise' then 'enterprise'
    else 'agency'
  end as tier,
  coalesce(s.status, 'inactive') as status,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.current_period_end,
  case when s.status = 'canceled' then now() else null end,
  now()
from public.organizations o
left join public.subscriptions s on s.user_id = o.owner_id
on conflict (organization_id) do update
set
  owner_user_id = excluded.owner_user_id,
  tier = excluded.tier,
  status = excluded.status,
  stripe_customer_id = coalesce(public.organization_subscriptions.stripe_customer_id, excluded.stripe_customer_id),
  stripe_subscription_id = coalesce(public.organization_subscriptions.stripe_subscription_id, excluded.stripe_subscription_id),
  current_period_end = coalesce(excluded.current_period_end, public.organization_subscriptions.current_period_end),
  canceled_at = coalesce(public.organization_subscriptions.canceled_at, excluded.canceled_at),
  updated_at = now();
