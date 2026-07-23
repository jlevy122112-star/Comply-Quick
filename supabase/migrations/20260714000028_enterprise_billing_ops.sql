-- Enterprise billing operations data model.
-- Stripe identifiers remain nullable and unused until the later Stripe slice.

create sequence if not exists public.invoice_number_seq;

create table if not exists public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  billing_email text,
  billing_address jsonb not null default '{}'::jsonb,
  tax_id text,
  collection_method text not null default 'charge_automatically'
    check (collection_method in ('charge_automatically', 'send_invoice')),
  payment_terms text not null default 'due_on_receipt'
    check (payment_terms in ('due_on_receipt', 'net_15', 'net_30', 'net_60')),
  po_required boolean not null default false,
  default_po_number text,
  currency text not null default 'usd',
  status text not null default 'active'
    check (status in ('active', 'past_due', 'suspended')),
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  billing_account_id uuid not null references public.billing_accounts (id) on delete restrict,
  invoice_number text not null unique default (
    'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')
  ),
  status text not null default 'draft'
    check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  currency text not null default 'usd',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  po_number text,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  stripe_invoice_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount_cents integer not null default 0 check (unit_amount_cents >= 0),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.manual_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tier text check (tier in ('free', 'solo', 'agency', 'enterprise')),
  seats integer check (seats is null or seats >= 0),
  scan_limit integer check (scan_limit is null or scan_limit >= 0),
  managed_clients integer check (managed_clients is null or managed_clients >= 0),
  reason text not null,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid not null references auth.users (id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > effective_at)
);

create index if not exists billing_accounts_status_idx
  on public.billing_accounts (status);
create index if not exists invoices_org_status_idx
  on public.invoices (organization_id, status);
create index if not exists invoice_line_items_invoice_position_idx
  on public.invoice_line_items (invoice_id, position);
create index if not exists manual_entitlement_overrides_active_idx
  on public.manual_entitlement_overrides (organization_id, active, effective_at desc);

alter table public.billing_accounts enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.manual_entitlement_overrides enable row level security;

drop policy if exists billing_accounts_select_org_member on public.billing_accounts;
create policy billing_accounts_select_org_member on public.billing_accounts
  for select using (public.is_org_member(organization_id));

drop policy if exists invoices_select_org_member on public.invoices;
create policy invoices_select_org_member on public.invoices
  for select using (public.is_org_member(organization_id));

drop policy if exists invoice_line_items_select_org_member on public.invoice_line_items;
create policy invoice_line_items_select_org_member on public.invoice_line_items
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and public.is_org_member(i.organization_id)
    )
  );

-- No policies are intentional: overrides are service-role/platform-admin only.
