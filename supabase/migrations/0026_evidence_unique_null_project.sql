-- Fix: evidence_records duplicate rows for account-wide packs (project_id IS NULL).
--
-- The composite unique constraint `unique (user_id, framework, control_id,
-- project_id)` from 0022 does not prevent duplicates when project_id is NULL,
-- because PostgreSQL treats NULL as distinct from NULL in unique constraints.
-- The default "compile pack" path always passes project_id = NULL, so every
-- re-compile inserted a full duplicate set of control rows. This partial unique
-- index closes that gap for the NULL-scope case; the existing constraint still
-- covers project-scoped rows.

create unique index if not exists evidence_records_user_fw_ctrl_no_project
  on public.evidence_records (user_id, framework, control_id)
  where project_id is null;
