-- Organization-scoped tenancy foundation.
--
-- This migration is additive and backward-compatible: it adds nullable columns,
-- backfills organizations, and supports write-tagging only. Existing RLS and
-- read behavior are unchanged; org-scoped read policies are deferred.

alter table public.scans
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.findings
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.evidence_records
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.alert_impacts
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.compliance_tasks
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.integrations
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;
alter table public.audit_logs
  add column if not exists organization_id uuid references public.organizations (id) on delete set null;

create index if not exists scans_organization_idx on public.scans (organization_id);
create index if not exists findings_organization_idx on public.findings (organization_id);
create index if not exists evidence_records_organization_idx on public.evidence_records (organization_id);
create index if not exists alert_impacts_organization_idx on public.alert_impacts (organization_id);
create index if not exists compliance_tasks_organization_idx on public.compliance_tasks (organization_id);
create index if not exists integrations_organization_idx on public.integrations (organization_id);
create index if not exists audit_logs_organization_idx on public.audit_logs (organization_id);

-- Give existing users a deterministic personal organization. The explicit plan
-- prevents the organizations table's enterprise default from being applied.
insert into public.organizations (owner_id, name, slug, plan)
select u.id, 'My Organization', 'org-' || replace(u.id::text, '-', ''), 'free'
from auth.users u
where not exists (
  select 1
  from public.organizations o
  where o.owner_id = u.id
)
on conflict (slug) do nothing;

insert into public.organization_members (organization_id, user_id, role)
select o.id, o.owner_id, 'owner'
from public.organizations o
where not exists (
  select 1
  from public.organization_members m
  where m.organization_id = o.id
    and m.user_id = o.owner_id
)
on conflict (organization_id, user_id) do nothing;

update public.projects p
set organization_id = o.id
from public.organizations o
where p.organization_id is null
  and o.owner_id = p.user_id;

update public.scans s
set organization_id = o.id
from public.organizations o
where s.organization_id is null
  and o.owner_id = s.user_id;

update public.findings f
set organization_id = o.id
from public.organizations o
where f.organization_id is null
  and o.owner_id = f.user_id;

update public.evidence_records e
set organization_id = o.id
from public.organizations o
where e.organization_id is null
  and o.owner_id = e.user_id;

update public.alert_impacts a
set organization_id = o.id
from public.organizations o
where a.organization_id is null
  and o.owner_id = a.user_id;

update public.compliance_tasks t
set organization_id = o.id
from public.organizations o
where t.organization_id is null
  and o.owner_id = t.user_id;

update public.integrations i
set organization_id = o.id
from public.organizations o
where i.organization_id is null
  and o.owner_id = i.user_id;

update public.audit_logs a
set organization_id = o.id
from public.organizations o
where a.organization_id is null
  and o.owner_id = a.user_id;
