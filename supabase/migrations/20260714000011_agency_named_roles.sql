-- Persist the named agency roles while retaining legacy owner/admin/member rows.
alter table public.agency_members
  drop constraint if exists agency_members_role_check;

alter table public.agency_members
  add constraint agency_members_role_check
  check (role in ('owner', 'admin', 'member', 'account_manager', 'client_viewer'));
