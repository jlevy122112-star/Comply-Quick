-- Comply-Quick — brand logo storage bucket.
-- A public-read bucket for company/agency logos uploaded at signup or from the
-- agency branding settings. Public read is required so the hosted URL can be
-- rendered on client-facing briefs and public score pages. Writes are limited
-- to authenticated users, and each user may only write under their own uid
-- folder ("<uid>/..."), so no one can overwrite another tenant's asset.
--
-- File type and size are enforced server-side by the bucket itself
-- (file_size_limit + allowed_mime_types), so a spoofed client-side content-type
-- cannot smuggle an executable/HTML/SVG payload into this public bucket. The
-- client-side validateLogoFile() check is purely for fast UX feedback.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-logos',
  'brand-logos',
  true,
  2097152, -- 2 MB, matches MAX_LOGO_BYTES in src/lib/storage/brand.ts
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "brand_logos_public_read" on storage.objects;
create policy "brand_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'brand-logos');

drop policy if exists "brand_logos_owner_insert" on storage.objects;
create policy "brand_logos_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "brand_logos_owner_update" on storage.objects;
create policy "brand_logos_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "brand_logos_owner_delete" on storage.objects;
create policy "brand_logos_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
