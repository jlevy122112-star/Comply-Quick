# Service Level Agreement (SLA)

This document states Comply-Quick's target availability and support response
commitments by plan. It is a **template/policy** to attach to enterprise
agreements; the binding terms for any given customer are those in that customer's
signed order form or master agreement, which override anything here.

## 1. Availability commitment

| Plan | Monthly uptime target | Measurement |
| --- | --- | --- |
| Free / Starter | Best effort, no credit | — |
| Pro / Agency | 99.5% | Monthly, excluding exclusions below. |
| Enterprise | 99.9% | Monthly, excluding exclusions below. |

**Uptime** = (total minutes − downtime minutes) ÷ total minutes, where
*downtime* is a period during which the core application (authentication, the
dashboard, and the scan/generate APIs) is unavailable due to a fault within
Comply-Quick's control.

### Exclusions
Downtime does **not** include: scheduled maintenance announced ≥ 48 h ahead;
force majeure; failures of upstream providers outside our control (Supabase,
Vercel, Stripe, Sentry) beyond their own SLAs; customer-side network/config
issues; misuse or use outside documented limits; and beta/preview features.

## 2. Support response targets

| Severity | Free/Starter | Pro/Agency | Enterprise |
| --- | --- | --- | --- |
| Sev-1 (production down / data exposure) | Best effort | < 4 business hours | < 1 hour, 24/7 |
| Sev-2 (major degradation) | Best effort | < 1 business day | < 4 business hours |
| Sev-3 (minor / question) | Community/email | < 2 business days | < 1 business day |

These are **response** (first meaningful human reply) targets, not resolution
guarantees. Resolution time depends on the issue. See `SUPPORT.md` for channels.

## 3. Service credits (Enterprise)

If monthly uptime falls below the Enterprise target due to a fault within our
control, the customer may request a service credit against the next invoice:

| Monthly uptime | Credit (% of that month's fee) |
| --- | --- |
| < 99.9% and ≥ 99.0% | 10% |
| < 99.0% and ≥ 95.0% | 25% |
| < 95.0% | 50% |

Credits are the sole and exclusive remedy for availability shortfalls, must be
requested within 30 days of the affected month, and are capped at 50% of the
monthly fee. Credits do not apply to accounts with overdue balances.

## 4. Maintenance

Routine deploys are zero/near-zero downtime (Vercel immutable deployments,
forward-safe migrations — see `CHANGE_MANAGEMENT.md`). Any maintenance expected
to cause downtime is announced ≥ 48 h in advance to Enterprise customers.

## 5. Legal framing

This SLA covers **service availability and support**. It is not a warranty that
use of Comply-Quick makes a customer legally compliant: generated documents,
scores, deadlines, and remediation suggestions are engineering aids, not legal
advice, and compliance depends on the customer's own facts, configuration, and
jurisdiction.

_Last reviewed: 2026-07-12._
