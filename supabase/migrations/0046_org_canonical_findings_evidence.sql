-- Organization-canonical findings and evidence.
--
-- Shared organization scans reconcile into one team finding/evidence row per
-- identity. Legacy rows with NULL organization_id retain their existing
-- per-user uniqueness and behavior.

create unique index if not exists findings_organization_key_unique
  on public.findings (organization_id, finding_key)
  where organization_id is not null;

create unique index if not exists evidence_records_organization_control_unique
  on public.evidence_records (organization_id, framework, control_id, project_id)
  where organization_id is not null;

drop policy if exists integrations_org_admin_update on public.integrations;
create policy integrations_org_admin_update on public.integrations
  as permissive
  for update
  using (
    organization_id is not null
    and public.is_org_admin(organization_id)
  )
  with check (
    organization_id is null
    or public.is_org_admin(organization_id)
  );

drop policy if exists integrations_org_admin_delete on public.integrations;
create policy integrations_org_admin_delete on public.integrations
  as permissive
  for delete
  using (
    organization_id is not null
    and public.is_org_admin(organization_id)
  );
