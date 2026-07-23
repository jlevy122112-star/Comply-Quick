-- Stripe synchronization state for organization billing accounts and invoices.
-- Secrets and bank details are never stored in this table.

alter table public.billing_accounts
  add column if not exists ach_setup_intent_id text,
  add column if not exists ach_payment_method_id text,
  add column if not exists ach_mandate_id text,
  add column if not exists ach_status text;

alter table public.invoices
  add column if not exists stripe_invoice_status text,
  add column if not exists hosted_invoice_url text;

create index if not exists billing_accounts_stripe_customer_idx
  on public.billing_accounts (stripe_customer_id);

create index if not exists invoices_stripe_invoice_idx
  on public.invoices (stripe_invoice_id);
