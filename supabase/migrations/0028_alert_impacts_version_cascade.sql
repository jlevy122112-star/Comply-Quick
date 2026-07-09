-- Alert impacts: version_id FK ON DELETE CASCADE (fixes stranded penalties).
--
-- 0025 declared `version_id ... on delete set null`. But an open impact is
-- resolved only via `resolveImpactsForVersion` (WHERE version_id = $1), which
-- can never match NULL. So if a linked `document_versions` row were deleted,
-- SET NULL would leave the impact open forever, permanently penalizing the
-- displayed compliance score with no way for the user to clear it. An impact is
-- meaningless once its proposal version is gone, so cascade the delete instead.

alter table public.alert_impacts
  drop constraint if exists alert_impacts_version_id_fkey;

alter table public.alert_impacts
  add constraint alert_impacts_version_id_fkey
  foreign key (version_id) references public.document_versions (id) on delete cascade;

-- Clear any already-stranded rows (open impact with no resolvable version) so a
-- prior SET NULL can't keep suppressing a project's score.
update public.alert_impacts
  set status = 'resolved', resolved_at = now()
  where status = 'open' and version_id is null;
