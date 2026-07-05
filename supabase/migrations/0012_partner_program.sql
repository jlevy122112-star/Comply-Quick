-- Comply-Quick — Partner Program (Phase 8 / [Up8]).
--
-- Low-CAC referral channel: anyone can become a partner, share a referral link,
-- and earn a recurring 30% share of every subscription payment made by a
-- customer they referred. Payouts run through Stripe Connect (Express), reusing
-- the same connected-account model as the marketplace.
--
--   • partners            — one row per user who joined the program. Holds their
--                           unguessable `referral_code` and (optional) Stripe
--                           connected account for payouts.
--   • partner_referrals   — first-touch attribution: maps a referred user to the
--                           partner who referred them. Unique on referred_user_id
--                           so a customer is credited to exactly one partner.
--   • partner_commissions — an idempotent ledger row per paid Stripe invoice
--                           (unique on stripe_invoice_id), recording the gross
--                           payment and the partner's 30% commission.
--
-- Numbered 0012 to sit after public scores (0011).

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Public, unguessable code used in ?ref=<code> referral links.
  referral_code text not null unique,
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  -- A referred customer is attributed to exactly one partner (first touch wins).
  referred_user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists partner_referrals_partner_idx
  on public.partner_referrals (partner_id, created_at desc);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  referred_user_id uuid references auth.users (id) on delete set null,
  -- One commission per Stripe invoice — makes webhook replays idempotent.
  stripe_invoice_id text not null unique,
  gross_cents integer not null check (gross_cents >= 0),
  commission_cents integer not null check (commission_cents >= 0),
  currency text not null default 'usd',
  -- accrued → owed to the partner; paid → transferred out via Connect.
  status text not null default 'accrued' check (status in ('accrued', 'paid')),
  created_at timestamptz not null default now()
);

create index if not exists partner_commissions_partner_idx
  on public.partner_commissions (partner_id, created_at desc);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.partners enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_commissions enable row level security;

-- A partner manages (reads/creates/updates) only their own partner row.
drop policy if exists "partners_all_own" on public.partners;
create policy "partners_all_own"
  on public.partners for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A partner reads the referrals attributed to them. Rows are written by the
-- Stripe webhook / checkout using the service-role client (bypasses RLS), so no
-- insert policy is granted here — a referred user must never see who referred
-- them, and partners must not forge attributions.
drop policy if exists "partner_referrals_read_own" on public.partner_referrals;
create policy "partner_referrals_read_own"
  on public.partner_referrals for select
  using (
    partner_id in (select id from public.partners where user_id = auth.uid())
  );

-- A partner reads their own commission ledger. Writes are service-role only.
drop policy if exists "partner_commissions_read_own" on public.partner_commissions;
create policy "partner_commissions_read_own"
  on public.partner_commissions for select
  using (
    partner_id in (select id from public.partners where user_id = auth.uid())
  );
