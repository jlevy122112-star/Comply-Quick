-- Organization-scoped shared reads.
--
-- Organization members can see shared project, scan, finding, evidence, task,
-- alert-impact, and audit-log rows. Integrations remain restricted to
-- organization admins because they may contain webhook destinations and
-- credentials. Existing user/owner policies remain unchanged; these policies
-- are additive and the application also scopes reads to the active organization.

drop policy if exists projects_select_org_member on public.projects;
create policy projects_select_org_member on public.projects
  for select
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists scans_select_org_member on public.scans;
create policy scans_select_org_member on public.scans
  for select
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists findings_select_org_member on public.findings;
create policy findings_select_org_member on public.findings
  for select
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists evidence_records_select_org_member on public.evidence_records;
create policy evidence_records_select_org_member on public.evidence_records
  for select
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists compliance_tasks_select_org_member on public.compliance_tasks;
create policy compliance_tasks_select_org_member on public.compliance_tasks
  for select
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists alert_impacts_select_org_member on public.alert_impacts;
create policy alert_impacts_select_org_member on public.alert_impacts
  for select
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists audit_logs_select_org_member on public.audit_logs;
create policy audit_logs_select_org_member on public.audit_logs
  for select
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists integrations_select_org_admin on public.integrations;
create policy integrations_select_org_admin on public.integrations
  for select
  using (organization_id is not null and public.is_org_admin(organization_id));

drop policy if exists integrations_org_admin_write_insert on public.integrations;
create policy integrations_org_admin_write_insert on public.integrations
  as restrictive
  for insert
  with check (organization_id is null or public.is_org_admin(organization_id));

drop policy if exists integrations_org_admin_write_update on public.integrations;
create policy integrations_org_admin_write_update on public.integrations
  as restrictive
  for update
  using (true)
  with check (organization_id is null or public.is_org_admin(organization_id));
