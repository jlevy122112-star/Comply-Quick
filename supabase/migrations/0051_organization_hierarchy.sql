-- Additive organization hierarchy metadata. Hierarchy access is limited to
-- structure management; data RLS continues to use is_org_member/is_org_admin.
alter table public.organizations
  add column if not exists parent_organization_id uuid references public.organizations (id) on delete set null,
  add column if not exists kind text;

alter table public.organizations
  drop constraint if exists organizations_kind_check;

alter table public.organizations
  add constraint organizations_kind_check
  check (kind is null or kind in ('organization', 'department', 'region'));

alter table public.organizations
  drop constraint if exists organizations_parent_not_self;

alter table public.organizations
  add constraint organizations_parent_not_self
  check (parent_organization_id is null or parent_organization_id <> id);

create index if not exists organizations_parent_idx
  on public.organizations (parent_organization_id);

create or replace function public.is_org_hierarchy_admin(o_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with recursive lineage as (
    select o.id, o.parent_organization_id
    from public.organizations o
    where o.id = o_id
    union all
    select parent.id, parent.parent_organization_id
    from public.organizations parent
    join lineage child on child.parent_organization_id = parent.id
  )
  select exists (
    select 1
    from lineage l
    where public.is_org_admin(l.id)
  );
$$;

create or replace function public.prevent_organization_hierarchy_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cursor_id uuid := new.parent_organization_id;
begin
  while cursor_id is not null loop
    if cursor_id = new.id then
      raise exception 'Organization hierarchy cycles are not allowed';
    end if;
    select o.parent_organization_id
      into cursor_id
      from public.organizations o
      where o.id = cursor_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists organizations_prevent_hierarchy_cycle on public.organizations;
create trigger organizations_prevent_hierarchy_cycle
  before insert or update of parent_organization_id on public.organizations
  for each row
  execute function public.prevent_organization_hierarchy_cycle();

drop policy if exists organizations_select_hierarchy on public.organizations;
create policy organizations_select_hierarchy
  on public.organizations for select
  using (public.is_org_hierarchy_admin(id));

drop policy if exists organizations_hierarchy_insert_guard on public.organizations;
create policy organizations_hierarchy_insert_guard
  on public.organizations for insert
  as restrictive
  with check (
    owner_id = auth.uid()
    and (
      parent_organization_id is null
      or (
        not coalesce(is_personal, false)
        and not exists (
          select 1
          from public.organizations parent
          where parent.id = parent_organization_id
            and parent.is_personal
        )
        and public.is_org_hierarchy_admin(parent_organization_id)
      )
    )
  );

drop policy if exists organizations_hierarchy_update_guard on public.organizations;
create policy organizations_hierarchy_update_guard
  on public.organizations for update
  as restrictive
  using (public.is_org_hierarchy_admin(id))
  with check (
    not coalesce(is_personal, false)
    and (
      parent_organization_id is null
      or (
        not exists (
          select 1
          from public.organizations parent
          where parent.id = parent_organization_id
            and parent.is_personal
        )
        and public.is_org_hierarchy_admin(parent_organization_id)
      )
    )
  );
