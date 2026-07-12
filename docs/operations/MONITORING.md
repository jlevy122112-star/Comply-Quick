# Monitoring Runbook

What Comply-Quick watches, where the signals come from, and how alerts turn into
action. Monitoring feeds `INCIDENT_RESPONSE.md` (detection) and the post-incident
review loop.

## 1. Signals

| Domain | Tool | What it tells us |
| --- | --- | --- |
| **Application errors** | Sentry (server + edge; `sentry.*.config.ts`) | Exceptions, fatal issues, error-rate spikes, release regressions. Ingest is tunneled through `/monitoring` so ad-blockers don't drop events. |
| **Availability & performance** | Vercel | Deploy health, function errors, latency, traffic. |
| **Database** | Supabase | Connections, slow queries, storage, project health, auth activity. |
| **Billing** | Stripe | Webhook delivery/failures, payment errors, subscription lifecycle. |
| **Supply chain / code security** | GitHub Actions + CodeQL | Vulnerable patterns, dependency alerts on every PR. |
| **Product usage / limits** | App (usage ledger) | Scan/seat overage, entitlement enforcement. |

## 2. Alert routing

- Sentry issue alerts and Vercel alerts route to the on-call engineer via email
  (and any additional destination configured on those platforms).
- Stripe webhook failures surface in the Stripe dashboard and are reconciled
  server-side; repeated failures should page on-call.
- There is **no Slack integration** (removed from the product by design); alerts
  use email / platform-native notifications.

## 3. What "good" looks like (baselines)

Establish and periodically revisit baselines so alerts are meaningful:

- Error rate at or below the trailing 7-day median; **no** new unresolved fatal
  Sentry issues after a deploy.
- Checkout / Stripe webhook success ~100% (excluding customer card declines).
- No RLS-denied errors on legitimate authenticated paths (a spike can indicate a
  policy regression).

## 4. Triage flow

1. Alert fires → on-call acknowledges.
2. Classify severity per `INCIDENT_RESPONSE.md` §1.
3. If a recent deploy correlates, consider immediate rollback
   (`CHANGE_MANAGEMENT.md` §5) before deep debugging.
4. If personal data may be affected, open the breach register entry.
5. Record actions in the incident log.

## 5. Health checks

- Vercel deployment status per release.
- A lightweight app route can be polled by an external uptime checker; if/when
  added, document the endpoint and checker here.
- CI (`quality`, `CodeQL`, `Analyze`) acts as pre-production monitoring — a red
  gate blocks the change.

## 6. Review

Revisit alert thresholds and baselines quarterly and after any Sev-1/Sev-2 so we
neither miss real incidents nor drown in noise.

_Last reviewed: 2026-07-12._
