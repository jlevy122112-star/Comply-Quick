-- Durable, organization-scoped background jobs.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  priority integer not null default 0,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_claim_idx
  on public.jobs (status, run_after, priority desc, created_at asc);
create index if not exists jobs_organization_status_idx
  on public.jobs (organization_id, status);

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_org_member" on public.jobs;
create policy "jobs_select_org_member"
  on public.jobs for select
  using (public.is_org_member(organization_id));

create or replace function public.claim_jobs(
  worker_id text,
  batch_size integer,
  per_org_limit integer
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.jobs;
  running_count integer;
  claimed_count integer := 0;
begin
  if worker_id is null or length(trim(worker_id)) = 0 then
    raise exception 'worker_id is required';
  end if;
  if batch_size is null or batch_size <= 0 then
    return;
  end if;
  if per_org_limit is null or per_org_limit <= 0 then
    raise exception 'per_org_limit must be positive';
  end if;

  /*
   * The advisory lock serializes claims for each organization. Without it,
   * two workers could both observe the same below-limit running count and
   * exceed the tenant cap concurrently. The row lock still prevents a job
   * from being claimed twice, while SKIP LOCKED keeps unrelated tenants
   * flowing when another worker is busy.
   */
  for candidate in
    select j.*
    from public.jobs j
    where j.status = 'queued'
      and j.run_after <= now()
    order by j.priority desc, j.created_at asc
    for update skip locked
  loop
    perform pg_advisory_xact_lock(hashtext(candidate.organization_id::text));

    select count(*)
      into running_count
      from public.jobs running
     where running.organization_id = candidate.organization_id
       and running.status = 'running';

    if running_count >= per_org_limit then
      continue;
    end if;

    update public.jobs
       set status = 'running',
           locked_at = now(),
           locked_by = worker_id,
           updated_at = now()
     where id = candidate.id
     returning * into candidate;

    claimed_count := claimed_count + 1;
    return next candidate;

    exit when claimed_count >= batch_size;
  end loop;
end;
$$;

revoke all on function public.claim_jobs(text, integer, integer) from public;
grant execute on function public.claim_jobs(text, integer, integer) to service_role;
