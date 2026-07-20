-- Enterprise organization hierarchy: sub-orgs, regions, and departments.
--
-- Adds a self-referential parent link and makes the existing RLS helpers
-- hierarchy-aware. Membership or ownership in any ancestor now grants the
-- corresponding role to all descendants, enabling delegated administration.

-- ─── schema ─────────────────────────────────────────────────────────────────
alter table public.organizations
  add column if not exists parent_organization_id uuid
    references public.organizations (id) on delete set null;

create index if not exists organizations_parent_idx
  on public.organizations (parent_organization_id);

-- Prevent an org from being its own parent. Deeper cycles are blocked at the
-- application layer and by the recursion guard in the helper functions below.
alter table public.organizations drop constraint if exists organizations_no_self_parent;
alter table public.organizations add constraint organizations_no_self_parent
  check (parent_organization_id is null or parent_organization_id <> id);

-- ─── hierarchy-aware RLS helpers ─────────────────────────────────────────────
-- Walk from the target org up to the root. If the caller is a member/owner of
-- any org in that path, they are considered a member of the target org.

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

-- Effective role in an org is the highest role held in the target org or any
-- ancestor. Returns null when the caller has no membership there.
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

-- True when the effective role is owner or admin (including inherited).
create or replace function public.is_org_admin(o_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.org_role(o_id) in ('owner', 'admin');
$$;

-- True when `candidate` is the same org as, or a descendant of, `ancestor`.
-- Used by the app to prevent moving an org under one of its own descendants.
-- Only exposed to callers who are members of at least one of the orgs.
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

-- Returns every ancestor of an org, ordered root-first. The first row is the
-- root of the tree and the last row is the requested org itself. Callers must
-- be members of the target org or one of its ancestors.
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

-- Restrict parent links so only admins of the target parent org can create or
-- move an organization under it.
drop policy if exists organizations_insert_parent_admin on public.organizations;
create policy organizations_insert_parent_admin
  on public.organizations as restrictive
  for insert
  with check (
    parent_organization_id is null or public.is_org_admin(parent_organization_id)
  );

drop policy if exists organizations_update_parent_admin on public.organizations;
create policy organizations_update_parent_admin
  on public.organizations as restrictive
  for update
  with check (
    parent_organization_id is null or public.is_org_admin(parent_organization_id)
  );
