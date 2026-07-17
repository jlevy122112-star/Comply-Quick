-- Allow organization members to reconcile shared canonical findings/evidence.
--
-- Existing own-row policies remain in place, while the restrictive policies
-- from 0043 continue to require membership for organization-tagged writes.

drop policy if exists findings_org_member_update on public.findings;
create policy findings_org_member_update on public.findings
  as permissive
  for update
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );

drop policy if exists evidence_records_org_member_update on public.evidence_records;
create policy evidence_records_org_member_update on public.evidence_records
  as permissive
  for update
  using (
    organization_id is not null
    and public.is_org_member(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_org_member(organization_id)
  );
