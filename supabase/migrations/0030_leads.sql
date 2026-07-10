-- Landing-page lead capture.
--
-- Stores marketing leads collected from the public landing page (email + UTM
-- attribution). Writes happen exclusively through the service-role client in
-- the /api/leads route, so RLS is enabled with NO public policies — anon/auth
-- roles can neither read nor write, and the service role bypasses RLS. This
-- keeps the email list private while allowing the funnel to record leads.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'landing',
  -- First-touch attribution captured from the landing page query string.
  utm_source text,
  utm_medium text,
  utm_campaign text,
  -- Marks whether the welcome/lead-magnet email was dispatched.
  welcomed boolean not null default false,
  -- True for the first N signups (Founding 100 giveaway). Set at insert time.
  founding_member boolean not null default false,
  created_at timestamptz not null default now(),
  unique (email)
);

create index if not exists leads_created_idx on public.leads (created_at desc);

alter table public.leads enable row level security;
-- Intentionally no policies: only the service role (which bypasses RLS) touches
-- this table. Anon/authenticated clients have no read or write access.
