-- Distinguish each user's personal organization from additional organizations
-- they may own, such as Agency-managed client organizations.

alter table public.organizations
  add column if not exists is_personal boolean not null default false;

-- Before client-organization provisioning shipped, every existing organization
-- was the owner's personal organization.
update public.organizations
set is_personal = true
where is_personal = false;

create unique index if not exists organizations_personal_owner_uidx
  on public.organizations (owner_id)
  where is_personal;
