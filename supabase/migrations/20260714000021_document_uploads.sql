-- Comply-Quick — Direct document upload and evidence pipeline.
--
-- Adds a private `project-documents` storage bucket and a project_documents
-- table that links uploaded files to projects for audit/evidence workflows.

-- Storage bucket for project documents. Private by default; RLS below gates access.
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

-- Project document evidence records.
create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes integer not null check (size_bytes > 0),
  mime_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_documents_project_idx
  on public.project_documents (project_id, created_at desc);

alter table public.project_documents enable row level security;

drop policy if exists project_documents_select on public.project_documents;
create policy project_documents_select on public.project_documents
  for select using (public.is_project_member(project_id));

drop policy if exists project_documents_insert on public.project_documents;
create policy project_documents_insert on public.project_documents
  for insert with check (
    public.is_project_member(project_id)
    and uploaded_by = auth.uid()
  );

drop policy if exists project_documents_delete on public.project_documents;
create policy project_documents_delete on public.project_documents
  for delete using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())
  );

-- Storage objects RLS: project members can manage documents in the bucket for their projects.
drop policy if exists project_documents_objects_select on storage.objects;
create policy project_documents_objects_select on storage.objects
  for select using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from public.project_documents d
      where d.storage_path = storage.objects.name
        and public.is_project_member(d.project_id)
    )
  );

drop policy if exists project_documents_objects_insert on storage.objects;
create policy project_documents_objects_insert on storage.objects
  for insert with check (
    bucket_id = 'project-documents'
  );

drop policy if exists project_documents_objects_delete on storage.objects;
create policy project_documents_objects_delete on storage.objects
  for delete using (
    bucket_id = 'project-documents'
    and exists (
      select 1 from public.project_documents d
      where d.storage_path = storage.objects.name
        and (d.uploaded_by = auth.uid() or exists (
          select 1 from public.projects p where p.id = d.project_id and p.user_id = auth.uid()
        ))
    )
  );
