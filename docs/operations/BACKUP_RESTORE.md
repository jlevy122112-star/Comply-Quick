# Backup & Restore Runbook

What Comply-Quick backs up, how often, where, and — most importantly — the
**tested** procedure to restore. An untested backup is not a backup.

## 1. What we back up

| Asset | Mechanism | Frequency | Retention |
| --- | --- | --- | --- |
| **Postgres database** (all tenant data) | Supabase automated backups + Point-in-Time Recovery (PITR) where the plan enables it. | Continuous (PITR) / daily snapshot. | Per Supabase plan; verify current window in the Supabase dashboard. |
| **Schema / migrations** | Git (`supabase/migrations/`). | Every merge. | Full history in Git. |
| **Application code** | Git + Vercel immutable deployments. | Every push/deploy. | Full history. |
| **Secrets/config** | Platform (Vercel/Supabase/GitHub) — **not** in backups. | N/A | Rotatable; documented in `INCIDENT_RESPONSE.md`. |
| **Object storage** (if/when used, e.g. exports) | Supabase Storage bucket policy. | Per bucket. | Per bucket policy. |

> Confirm the exact PITR window and snapshot retention in the Supabase project
> settings — it depends on the current plan and is the source of truth over this
> table.

## 2. Restore scenarios

### A. Point-in-time recovery (accidental mass delete / bad migration)
1. Identify the target timestamp (just before the bad event) from the incident
   log.
2. In the Supabase dashboard, restore the project (or a clone) to that
   timestamp using PITR.
3. Prefer restoring into a **new/clone** project first to verify integrity,
   then cut over — avoids destroying good data written after the event if the
   assessment was wrong.
4. Re-point the app (env `NEXT_PUBLIC_SUPABASE_URL` / keys) if cutting over to a
   clone, then redeploy.
5. Verify: row counts on key tables, RLS still enforced, a login + a scan + a
   billing read all succeed.

### B. Single-table / single-tenant recovery
1. Restore a snapshot into a scratch project.
2. Export only the affected rows (scoped by `organization_id`).
3. Re-import into production inside a transaction; verify tenant isolation.

### C. Full project loss
1. Provision a new Supabase project.
2. Restore the latest snapshot/PITR.
3. Apply any migrations newer than the snapshot (they live in Git).
4. Update platform env/secrets, redeploy on Vercel, run the verification
   checklist.

## 3. Restore verification checklist

- [ ] App boots and authentication works.
- [ ] RLS is enforced (a member of org A cannot read org B).
- [ ] A representative read/write on core tables succeeds.
- [ ] Stripe/webhook reconciliation is healthy.
- [ ] Error monitoring (Sentry) shows no restore-related fatal errors.

## 4. Restore drills

Run a restore drill (scenario A into a clone) **at least twice a year** and
after any change to the backup configuration. Record the drill date, the
measured restore time, and any issues here:

| Date | Scenario | Restore time | Notes |
| --- | --- | --- | --- |
| _pending first drill_ | | | |

## 5. Objectives (targets, not guarantees)

- **RPO (max data loss):** ≤ the PITR granularity (aim minutes, not hours).
- **RTO (max downtime to restore):** ≤ 4 hours for full project loss; faster for
  code rollback (near-instant via Vercel).

_Last reviewed: 2026-07-12._
