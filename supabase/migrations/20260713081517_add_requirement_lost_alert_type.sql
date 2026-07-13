-- Make a previously-satisfied requirement becoming absent a first-class monitoring alert.
alter table public.compliance_alerts drop constraint if exists compliance_alerts_type_check;
alter table public.compliance_alerts add constraint compliance_alerts_type_check check (type in ('score_drop', 'new_tracker', 'new_critical', 'requirement_lost', 'scan_failed', 'info'));
