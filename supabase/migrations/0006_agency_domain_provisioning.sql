-- Phase 5 follow-up: custom-domain provisioning metadata.
--
-- Records which backend provisioned each white-label domain and the DNS records
-- the client must create. Additive and backward compatible — existing rows get
-- provider = null and dns = [].

alter table public.agency_domains
  -- Which backend provisioned the domain (e.g. 'vercel', 'cloudflare').
  add column if not exists provider text,
  -- DNS records the domain owner must create, as returned by the provider:
  -- [{ "type": "CNAME", "name": "compliance.acme.com", "value": "…" }, …].
  add column if not exists dns jsonb not null default '[]'::jsonb;
