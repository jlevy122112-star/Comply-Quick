-- Agency client organization bridge.
--
-- Existing agency clients remain valid without an organization. Provisioning
-- can link a client to one organization so the existing organization/workspace
-- tenancy, membership, active-organization, and shared-read foundations can be
-- reused without introducing a parallel client hierarchy.

alter table public.agency_clients
  add column if not exists organization_id uuid
    references public.organizations (id) on delete set null;

create unique index if not exists agency_clients_organization_uidx
  on public.agency_clients (organization_id)
  where organization_id is not null;
