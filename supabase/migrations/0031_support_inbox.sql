-- Support inbox for landing-page / customer email.
--
-- Inbound customer email (forwarded from support@ / info@ via a Cloudflare
-- Email Worker or a provider inbound webhook) is stored here, and outbound
-- replies sent through Resend are recorded on the same thread. Writes happen
-- exclusively through the service-role client (the inbound webhook and the
-- authenticated reply action), so RLS is enabled with NO public policies —
-- anon/authenticated roles can neither read nor write, and the service role
-- bypasses RLS. This keeps customer correspondence private.

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  -- The external customer this thread is with.
  customer_email text not null,
  subject text,
  -- Links the conversation to a captured marketing lead when the address matches.
  lead_id uuid references public.leads (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  -- Direction of the most recent message ('inbound' | 'outbound') for inbox sorting/badges.
  last_direction text not null default 'inbound' check (last_direction in ('inbound', 'outbound')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists support_threads_recent_idx on public.support_threads (last_message_at desc);
create index if not exists support_threads_customer_idx on public.support_threads (customer_email);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_email text not null,
  to_email text not null,
  subject text,
  body_text text,
  body_html text,
  -- Provider message id (Resend / inbound source) for dedupe and threading.
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_thread_idx on public.support_messages (thread_id, created_at);
-- Idempotency for inbound webhooks that may deliver the same message twice.
create unique index if not exists support_messages_provider_idx
  on public.support_messages (provider_message_id)
  where provider_message_id is not null;

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS) touches
-- these tables, via the inbound webhook and the authenticated reply action.
