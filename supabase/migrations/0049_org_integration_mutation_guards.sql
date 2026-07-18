-- Enforce organization integration administration at the RLS layer.
--
-- Personal/null-organization integrations retain their existing own-row
-- policies. Organization-tagged integrations require an organization admin
-- for both updates and deletes.

drop policy if exists integrations_org_admin_update_guard on public.integrations;
create policy integrations_org_admin_update_guard on public.integrations
  as restrictive
  for update
  using (
    organization_id is null
    or public.is_org_admin(organization_id)
  )
  with check (
    organization_id is null
    or public.is_org_admin(organization_id)
  );

drop policy if exists integrations_org_admin_delete_guard on public.integrations;
create policy integrations_org_admin_delete_guard on public.integrations
  as restrictive
  for delete
  using (
    organization_id is null
    or public.is_org_admin(organization_id)
  );
