-- Comply-Quick — Persisted accessibility scan results.
--
-- Accessibility is a separate scored dimension from the privacy/compliance
-- score. Existing scans remain valid with a null value.

alter table public.scans
  add column if not exists accessibility jsonb;
