# Comply-Quick Operational Runbooks

This directory holds the operational controls Comply-Quick runs the service by:
incident response, change management, backup & restore, and monitoring. Together
with the SLA and support policies they form the "Operational" and enterprise
"SLA / dedicated support" evidence set an auditor (e.g. SOC 2) expects to see.

## Index

| Runbook | Purpose |
| --- | --- |
| [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) | Detect, triage, contain, and communicate security & availability incidents; hand off to the personal-data breach workflow when personal data is involved. |
| [CHANGE_MANAGEMENT.md](./CHANGE_MANAGEMENT.md) | How code and schema changes are proposed, reviewed, tested, deployed, and rolled back. |
| [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) | What is backed up, how often, and the tested restore procedure. |
| [MONITORING.md](./MONITORING.md) | What we watch (errors, availability, CI, usage) and how alerts are routed. |
| [SLA.md](./SLA.md) | Availability target, support response times, and credit terms by plan. |
| [SUPPORT.md](./SUPPORT.md) | Support channels, hours, escalation, and the dedicated-support offering. |

## Ownership

- **Service owner / on-call:** the founder (currently a single-maintainer team).
  As the team grows, replace "the on-call engineer" below with the rota.
- **Review cadence:** these runbooks are reviewed at least annually and after any
  Sev-1 incident or major architecture change. Record the review date at the
  bottom of each file.

## The stack these runbooks assume

| Layer | Provider | Notes |
| --- | --- | --- |
| App | Next.js (App Router) on **Vercel** | Preview deploy per PR; production on `main`. |
| Database & Auth | **Supabase** (Postgres + Row Level Security) | Migrations in `supabase/migrations/` auto-apply via the Supabase GitHub integration on merge. |
| Error monitoring | **Sentry** | Server/edge configs in `sentry.*.config.ts`; ingest tunneled through `/monitoring`. |
| Billing | **Stripe** | Webhooks reconciled server-side. |
| CI | **GitHub Actions** | `quality`, `CodeQL`, and `Analyze` gates on every PR. |

## Legal framing

These are **internal operational controls**, not a compliance certification.
Documenting a control is evidence the control exists; it is not a guarantee of an
outcome, and it is not legal advice. "SOC 2 readiness" means the controls are
designed and documented — it is **not** a completed SOC 2 audit or report.
Availability, breach, and notification obligations ultimately depend on the
customer's own facts, configuration, contracts, and jurisdiction.

_Last reviewed: 2026-07-12._
