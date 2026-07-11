-- Remove Slack as a supported integration kind.
--
-- Slack alerting/integration has been removed from the product. This migration
-- deletes any existing Slack integration rows and tightens the
-- `integrations.kind` check constraint so only generic webhooks are allowed
-- going forward. Idempotent and safe to re-run.

-- 1. Drop any stored Slack integrations (webhook rows are unaffected).
delete from public.integrations where kind = 'slack';

-- 2. Restrict the allowed kinds to 'webhook' only.
alter table public.integrations
  drop constraint if exists integrations_kind_check;

alter table public.integrations
  add constraint integrations_kind_check check (kind in ('webhook'));
