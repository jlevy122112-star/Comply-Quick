-- Comply-Quick — Agency document file uploads.
--
-- Adds a private `agency-documents` storage bucket and file metadata columns
-- to `agency_documents` so white-label documents can be backed by uploaded
-- PDFs, Word docs, text files, and images.

-- Storage bucket for agency documents. Private by default; public share pages
-- generate short-lived signed URLs server-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agency-documents',
  'agency-documents',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- File metadata on agency documents.
alter table public.agency_documents
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists size_bytes integer,
  add column if not exists uploaded_by uuid references auth.users (id) on delete set null,
  add constraint agency_documents_size_check check (size_bytes is null or size_bytes > 0);

-- A stored file path must be unique when set.
create unique index if not exists agency_documents_storage_path_idx
  on public.agency_documents (storage_path)
  where storage_path is not null;

-- Storage RLS: agency members may upload under their agency folder.
drop policy if exists "agency_documents_objects_insert" on storage.objects;
create policy "agency_documents_objects_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'agency-documents'
    and public.is_agency_member(split_part(storage.objects.name, '/', 1)::uuid)
  );

-- Storage RLS: agency members may read/delete objects referenced by documents
-- in agencies they belong to.
drop policy if exists "agency_documents_objects_select" on storage.objects;
create policy "agency_documents_objects_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'agency-documents'
    and exists (
      select 1 from public.agency_documents d
      where d.storage_path = storage.objects.name
        and public.is_agency_member(d.agency_id)
    )
  );

drop policy if exists "agency_documents_objects_delete" on storage.objects;
create policy "agency_documents_objects_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'agency-documents'
    and exists (
      select 1 from public.agency_documents d
      where d.storage_path = storage.objects.name
        and public.is_agency_member(d.agency_id)
    )
  );
