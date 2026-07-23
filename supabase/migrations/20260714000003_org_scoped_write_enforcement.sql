-- Organization-scoped write enforcement.
--
-- These additive restrictive policies enforce organization membership on new
-- organization_id values without changing read behavior or existing permissive
-- user/owner policies. organization_id remains nullable; the NOT NULL contract
-- is deferred to a later slice.

drop policy if exists projects_org_write_insert on public.projects;
create policy projects_org_write_insert on public.projects
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists projects_org_write_update on public.projects;
create policy projects_org_write_update on public.projects
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists scans_org_write_insert on public.scans;
create policy scans_org_write_insert on public.scans
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists scans_org_write_update on public.scans;
create policy scans_org_write_update on public.scans
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists findings_org_write_insert on public.findings;
create policy findings_org_write_insert on public.findings
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists findings_org_write_update on public.findings;
create policy findings_org_write_update on public.findings
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists evidence_records_org_write_insert on public.evidence_records;
create policy evidence_records_org_write_insert on public.evidence_records
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists evidence_records_org_write_update on public.evidence_records;
create policy evidence_records_org_write_update on public.evidence_records
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists alert_impacts_org_write_insert on public.alert_impacts;
create policy alert_impacts_org_write_insert on public.alert_impacts
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists alert_impacts_org_write_update on public.alert_impacts;
create policy alert_impacts_org_write_update on public.alert_impacts
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists compliance_tasks_org_write_insert on public.compliance_tasks;
create policy compliance_tasks_org_write_insert on public.compliance_tasks
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists compliance_tasks_org_write_update on public.compliance_tasks;
create policy compliance_tasks_org_write_update on public.compliance_tasks
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists integrations_org_write_insert on public.integrations;
create policy integrations_org_write_insert on public.integrations
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists integrations_org_write_update on public.integrations;
create policy integrations_org_write_update on public.integrations
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists audit_logs_org_write_insert on public.audit_logs;
create policy audit_logs_org_write_insert on public.audit_logs
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_member(organization_id));

drop policy if exists audit_logs_org_write_update on public.audit_logs;
create policy audit_logs_org_write_update on public.audit_logs
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_member(organization_id));
