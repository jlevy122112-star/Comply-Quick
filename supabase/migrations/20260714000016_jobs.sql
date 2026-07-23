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

create or replace function public.org_job_concurrency_limit(p_org_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  org_tier text;
begin
  select lower(coalesce(s.tier, 'free'))
    into org_tier
    from public.organizations o
    left join public.subscriptions s
      on s.user_id = o.owner_id
     and s.status = 'active'
     and (s.current_period_end is null or s.current_period_end > now())
   where o.id = p_org_id;

  -- Keep this map in sync with JOB_CONCURRENCY_BY_TIER in src/lib/jobs/service.ts.
  return case org_tier
    when 'agency' then 5
    when 'enterprise' then 1000000
    when 'solo' then 1
    when 'single' then 1
    when 'pro' then 1
    else 1
  end;
end;
$$;

revoke all on function public.org_job_concurrency_limit(uuid) from public;
grant execute on function public.org_job_concurrency_limit(uuid) to service_role;

create or replace function public.claim_jobs(
  worker_id text,
  batch_size integer
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.jobs;
  running_count integer;
  org_limit integer;
  claimed_count integer := 0;
  org_key text;
  cached_org jsonb;
  org_cache jsonb := '{}'::jsonb;
begin
  if worker_id is null or length(trim(worker_id)) = 0 then
    raise exception 'worker_id is required';
  end if;
  if batch_size is null or batch_size <= 0 then
    return;
  end if;
  /*
   * The advisory lock serializes claims for each organization. Without it,
   * two workers could both observe the same below-limit running count and
   * exceed the tenant cap concurrently. The row lock still prevents a job
   * from being claimed twice, while SKIP LOCKED keeps unrelated tenants
   * flowing when another worker is busy.
   *
   * org_cache stores each candidate organization's resolved tier limit and
   * running count once per function call. The count is incremented locally
   * after each claim, so later jobs for that organization do not re-count.
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

    org_key := candidate.organization_id::text;
    cached_org := org_cache -> org_key;
    if cached_org is null or cached_org = 'null'::jsonb then
      org_limit := public.org_job_concurrency_limit(candidate.organization_id);
      select count(*)
        into running_count
        from public.jobs running
       where running.organization_id = candidate.organization_id
         and running.status = 'running';
      org_cache := jsonb_set(
        org_cache,
        array[org_key],
        jsonb_build_object('limit', org_limit, 'running', running_count),
        true
      );
    else
      org_limit := (cached_org ->> 'limit')::integer;
      running_count := (cached_org ->> 'running')::integer;
    end if;

    if running_count >= org_limit then
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
    org_cache := jsonb_set(
      org_cache,
      array[org_key],
      jsonb_build_object('limit', org_limit, 'running', running_count + 1),
      true
    );
    return next candidate;

    exit when claimed_count >= batch_size;
  end loop;
end;
$$;

revoke all on function public.claim_jobs(text, integer) from public;
grant execute on function public.claim_jobs(text, integer) to service_role;

create or replace function public.reclaim_stale_jobs(timeout_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  reclaimed_count integer;
begin
  if timeout_seconds is null or timeout_seconds <= 0 then
    raise exception 'timeout_seconds must be positive';
  end if;

  -- A crash does not represent a handler failure, so attempts are preserved.
  update public.jobs
     set status = 'queued',
         locked_at = null,
         locked_by = null,
         updated_at = now()
   where status = 'running'
     and locked_at < now() - make_interval(secs => timeout_seconds);

  get diagnostics reclaimed_count = row_count;
  return reclaimed_count;
end;
$$;

revoke all on function public.reclaim_stale_jobs(integer) from public;
grant execute on function public.reclaim_stale_jobs(integer) to service_role;
