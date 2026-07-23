-- Per-client Account Manager assignments within an agency.
create table if not exists public.agency_client_account_managers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  client_id uuid not null references public.agency_clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (client_id, user_id)
);

create index if not exists agency_client_account_managers_agency_idx
  on public.agency_client_account_managers (agency_id);
create index if not exists agency_client_account_managers_user_idx
  on public.agency_client_account_managers (user_id);

create or replace function public.is_agency_admin(a_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.agencies a
    where a.id = a_id
      and a.owner_id = auth.uid()
  ) or exists (
    select 1
    from public.agency_members m
    where m.agency_id = a_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

alter table public.agency_client_account_managers enable row level security;

drop policy if exists "agency_client_account_managers_select_member"
  on public.agency_client_account_managers;
create policy "agency_client_account_managers_select_member"
  on public.agency_client_account_managers for select
  using (public.is_agency_member(agency_id));

drop policy if exists "agency_client_account_managers_insert_admin"
  on public.agency_client_account_managers;
create policy "agency_client_account_managers_insert_admin"
  on public.agency_client_account_managers for insert
  with check (
    public.is_agency_admin(agency_id)
    and assigned_by = auth.uid()
  );

drop policy if exists "agency_client_account_managers_delete_admin"
  on public.agency_client_account_managers;
create policy "agency_client_account_managers_delete_admin"
  on public.agency_client_account_managers for delete
  using (public.is_agency_admin(agency_id));
