-- Fix connector RLS helper resolution after moving connector tables into the
-- connector schema, and grant the fresh connector tables the same privileges
-- as connector.connector_connections.

create or replace function public.connector_caller_owns_connection(c_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from connector.connector_connections c
    where c.id = c_id and public.is_org_member(c.agency_org_id)
  );
$$;

grant all privileges on table connector.platform_webhook_events
  to anon, authenticated, service_role;

grant all privileges on table connector.github_findings
  to anon, authenticated, service_role;
