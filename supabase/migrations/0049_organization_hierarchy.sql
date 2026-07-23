-- Enterprise organization hierarchy: sub-orgs, regions, and departments.
--
-- This migration combines the original hierarchy helpers with the later
-- hierarchy-management additions. The two source migrations both attempted
-- to create the parent column, index, and self-parent constraint.

alter table public.organizations
  add column if not exists parent_organization_id uuid
    references public.organizations (id) on delete set null,
  add column if not exists kind text;

alter table public.organizations
  drop constraint if exists organizations_no_self_parent;

alter table public.organizations
  drop constraint if exists organizations_parent_not_self;

alter table public.organizations
  add constraint organizations_parent_not_self
  check (parent_organization_id is null or parent_organization_id <> id);

alter table public.organizations
  drop constraint if exists organizations_kind_check;

alter table public.organizations
  add constraint organizations_kind_check
  check (kind is null or kind in ('organization', 'department', 'region'));

create index if not exists organizations_parent_idx
  on public.organizations (parent_organization_id);

create or replace function public.is_org_member(o_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with recursive ancestors as (
    select id, parent_organization_id, 0 as depth
    from public.organizations
    where id = o_id
    union all
    select o.id, o.parent_organization_id, a.depth + 1
    from public.organizations o
    join ancestors a on o.id = a.parent_organization_id
    where a.depth < 100 and o.id is not null
  )
  select exists (
    select 1
    from ancestors a
    where a.id in (
      select m.organization_id from public.organization_members m where m.user_id = auth.uid()
      union
      select o2.id from public.organizations o2 where o2.owner_id = auth.uid()
    )
  );
$$;

create or replace function public.org_role(o_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  with recursive ancestors as (
    select id, parent_organization_id, 0 as depth
    from public.organizations
    where id = o_id
    union all
    select o.id, o.parent_organization_id, a.depth + 1
    from public.organizations o
    join ancestors a on o.id = a.parent_organization_id
    where a.depth < 100 and o.id is not null
  ),
  roles as (
    select m.role as role
    from public.organization_members m
    join ancestors a on m.organization_id = a.id
    where m.user_id = auth.uid()
    union all
    select 'owner' as role
    from ancestors a
    where a.id in (select o2.id from public.organizations o2 where o2.owner_id = auth.uid())
  )
  select case
    when not exists (select 1 from roles) then null
    else (
      select r.role
      from roles r
      order by case r.role
        when 'owner' then 4
        when 'admin' then 3
        when 'manager' then 2
        when 'member' then 1
        when 'viewer' then 0
      end desc
      limit 1
    )
  end;
$$;

create or replace function public.is_org_admin(o_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.org_role(o_id) in ('owner', 'admin');
$$;

create or replace function public.is_org_descendant(ancestor uuid, candidate uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  with recursive chain as (
    select id, parent_organization_id, 0 as depth
    from public.organizations
    where id = candidate
    union all
    select o.id, o.parent_organization_id, c.depth + 1
    from public.organizations o
    join chain c on o.id = c.parent_organization_id
    where c.depth < 100 and o.id is not null
  )
  select
    (public.is_org_member(ancestor) or public.is_org_member(candidate))
    and exists (select 1 from chain where id = ancestor);
$$;

create or replace function public.get_org_ancestors(o_id uuid)
returns table(id uuid, depth integer)
language sql
security definer
stable
set search_path = public
as $$
  with recursive chain as (
    select id, parent_organization_id, 0 as depth
    from public.organizations
    where id = o_id
    union all
    select o.id, o.parent_organization_id, c.depth + 1
    from public.organizations o
    join chain c on o.id = c.parent_organization_id
    where c.depth < 100 and o.id is not null
  )
  select chain.id, chain.depth
  from chain
  where public.is_org_member(o_id)
  order by depth desc;
$$;

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
  if (
    (tg_op = 'INSERT' and new.parent_organization_id is not null)
    or (
      tg_op = 'UPDATE'
      and new.parent_organization_id is distinct from old.parent_organization_id
      and new.parent_organization_id is not null
    )
  ) then
    if coalesce(new.is_personal, false)
      or exists (
        select 1
        from public.organizations parent
        where parent.id = new.parent_organization_id
          and parent.is_personal
      )
      or not public.is_org_hierarchy_admin(new.parent_organization_id) then
      raise exception 'Only hierarchy admins can attach non-personal organizations to non-personal parents';
    end if;
  end if;

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

drop policy if exists organizations_insert_parent_admin on public.organizations;
drop policy if exists organizations_update_parent_admin on public.organizations;
drop policy if exists organizations_select_hierarchy on public.organizations;
drop policy if exists organizations_hierarchy_insert_guard on public.organizations;
drop policy if exists organizations_hierarchy_update_guard on public.organizations;
drop policy if exists organizations_update_hierarchy on public.organizations;

create policy organizations_select_hierarchy
  on public.organizations for select
  using (public.is_org_hierarchy_admin(id));

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

create policy organizations_update_hierarchy
  on public.organizations for update
  using (public.is_org_hierarchy_admin(id))
  with check (public.is_org_hierarchy_admin(id));
