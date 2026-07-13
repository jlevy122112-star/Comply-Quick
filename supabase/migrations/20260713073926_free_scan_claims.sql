-- One complimentary public scan per normalized email address.
-- This table is accessed only by trusted server routes through the service role.
create table public.free_scan_claims (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'exit_intent',
  token uuid not null default gen_random_uuid(),
  claimed_at timestamptz not null default now(),
  used_at timestamptz,
  constraint free_scan_claims_email_key unique (email),
  constraint free_scan_claims_token_key unique (token),
  constraint free_scan_claims_normalized_email_check check (email = lower(email))
);

create index free_scan_claims_available_token_idx
  on public.free_scan_claims (token)
  where used_at is null;

alter table public.free_scan_claims enable row level security;
-- Intentionally no policies: the service role alone issues and consumes claims.