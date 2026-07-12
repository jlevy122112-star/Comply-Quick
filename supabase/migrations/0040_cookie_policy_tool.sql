-- Comply-Quick — allow the Cookie Policy generator as a tracked quick tool.
--
-- The tool_usage_events check constraint (0018) enumerated the quick tools whose
-- usage is tracked as an activation signal. The Cookie Policy generator is a new
-- quick tool (companion to the Cookie Consent Banner), so extend the allowed set
-- to include 'cookie_policy'. Existing rows are unaffected.

alter table public.tool_usage_events
  drop constraint if exists tool_usage_events_tool_check;

alter table public.tool_usage_events
  add constraint tool_usage_events_tool_check
  check (tool in ('cookie_banner', 'cookie_policy', 'dpa', 'subprocessors'));
