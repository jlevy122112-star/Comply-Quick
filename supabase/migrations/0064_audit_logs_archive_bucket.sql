-- Comply-Quick — encrypted archive storage for system audit logs.
--
-- Monthly gzip JSONL dumps of logs older than 90 days, retained 1-3 years in
-- encrypted cloud storage for SOC 2 / legal discovery. No public or
-- authenticated access; only the service role can upload/download.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audit-logs',
  'audit-logs',
  false,
  524288000, -- 500 MB per archive file
  array['application/gzip', 'application/x-gzip', 'application/json']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Explicitly block authenticated users; service role bypasses RLS.
drop policy if exists "audit_logs_archive_select" on storage.objects;
create policy "audit_logs_archive_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'audit-logs' and false);

drop policy if exists "audit_logs_archive_insert" on storage.objects;
create policy "audit_logs_archive_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audit-logs' and false);

drop policy if exists "audit_logs_archive_update" on storage.objects;
create policy "audit_logs_archive_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'audit-logs' and false)
  with check (bucket_id = 'audit-logs' and false);

drop policy if exists "audit_logs_archive_delete" on storage.objects;
create policy "audit_logs_archive_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audit-logs' and false);
