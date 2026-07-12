# Incident Response Runbook

How Comply-Quick detects, triages, contains, resolves, and communicates
security and availability incidents. When an incident involves personal data,
this runbook hands off to the in-product **personal-data breach register &
notification-deadline** workflow — see "Personal-data breaches" below.

## 1. Severity levels

| Sev | Definition | Examples | Target response |
| --- | --- | --- | --- |
| **Sev-1** | Confirmed data exposure, full outage, or active exploitation. | Unauthorized DB access, credential leak, production down. | Acknowledge < 30 min, 24/7. |
| **Sev-2** | Major degradation, no confirmed data exposure. | Scans failing, checkout broken, elevated error rate. | Acknowledge < 2 h, business hours. |
| **Sev-3** | Minor / single-tenant issue with a workaround. | One integration failing, cosmetic breakage. | Next business day. |

## 2. Roles

- **Incident Commander (IC):** runs the incident, owns decisions and comms.
  Default = on-call engineer.
- **Scribe:** timestamps every action in the incident log (can be the IC in a
  small team).
- **Comms:** drafts customer/authority messages (see communication templates).

## 3. Detection sources

- **Sentry** alerts (error spikes, new fatal issues) — see `MONITORING.md`.
- **Vercel** deployment / availability alerts.
- **Supabase** logs and project health.
- **Stripe** webhook failure notifications.
- Customer report via `support@comply-quick.com`.
- GitHub Actions / CodeQL security findings.

## 4. Response procedure

1. **Declare.** Anyone may declare an incident. Open an incident log entry with
   UTC start time, detection source, and initial severity. Assign an IC.
2. **Assess.** Determine blast radius: which tenants/orgs, whether personal data
   is involved, whether credentials are exposed.
3. **Contain.** Stop the bleeding before fixing the root cause:
   - Suspected credential leak → rotate the secret immediately (Supabase
     service-role key, Stripe keys, `SUPABASE_ACCESS_TOKEN`, SCIM tokens,
     API keys) and invalidate sessions if needed.
   - Bad deploy → roll back via Vercel (promote the previous production
     deployment) — see `CHANGE_MANAGEMENT.md` §Rollback.
   - Abusive traffic → tighten rate limits / block at the edge.
   - Compromised SCIM/API token → revoke it from the dashboard (revocation is
     immediate; tokens are stored only as hashes).
4. **Eradicate & recover.** Fix the root cause, deploy the fix through the
   normal reviewed pipeline (emergency changes are still reviewed — see
   change-management §Emergency), and confirm recovery via monitoring.
5. **Communicate.** See §5.
6. **Close.** Recovery confirmed, monitoring nominal, customers informed.

## 5. Communication

- **Sev-1/Sev-2:** post initial status ASAP after containment starts, then
  updates at least hourly (Sev-1) or at meaningful change (Sev-2), and a final
  "resolved" note. Channels: email to affected orgs and, where configured, the
  in-app alerts surface. (Slack is intentionally not used — it was removed from
  the product.)
- Be factual: what happened, what data/tenants were affected, what we did, what
  the customer should do. Do not speculate on cause before it is confirmed.

## 6. Personal-data breaches

If an incident involves unauthorized access to, loss of, or disclosure of
**personal data**, it is also a *personal-data breach* with statutory notification
timelines (e.g. GDPR Art. 33 — 72 hours to the supervisory authority; various US
state deadlines). Do **not** track this informally:

1. Record it in the in-product **breach register** with the discovery timestamp.
2. The register computes the applicable notification deadlines as an **aid** —
   verify them against the actual controlling law and DPA obligations; the
   calculation is not legal advice or a guarantee.
3. Notify affected controllers/customers per your DPA and the law.
4. Attach the incident log and remediation evidence for the audit trail.

## 7. Post-incident review (blameless)

Within 5 business days of a Sev-1/Sev-2, write a post-mortem: timeline, root
cause, what went well, what didn't, and dated action items with owners. Feed
action items back into monitoring, change management, and these runbooks.

## Quick reference — what to rotate on suspected compromise

| Secret | Where | Effect of rotation |
| --- | --- | --- |
| Supabase service-role key | Supabase dashboard → API | Invalidates server-only trusted client; redeploy with new value. |
| Stripe secret / webhook signing key | Stripe dashboard | Breaks billing until env updated. |
| SCIM tokens | App dashboard → org settings → SCIM | Immediate; IdP sync stops until re-issued. |
| Public API keys | App dashboard → API keys | Immediate; API clients must update. |

_Last reviewed: 2026-07-12._
