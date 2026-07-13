# Comply-Quick Emergency Revert Plan

This runbook is the fastest safe path to restore service when a deployment breaks the application.

## 1. Trigger Conditions

Start this procedure immediately when any of the following occur after release:

- Production outage or major degradation (Sev-1/Sev-2).
- Authentication, billing, or core dashboard flow failure.
- Elevated 5xx error rates or sustained crash loops.
- Data integrity risk from a faulty release.

## 2. First 10 Minutes

1. **Declare incident** and assign Incident Commander.
2. **Freeze further deploys** until recovery.
3. **Confirm blast radius**: affected routes, tenants, and systems.
4. **Choose rollback type**:
   - App code rollback (default and fastest)
   - Config/secret rollback
   - Forward migration fix (if schema issue)

## 3. Fastest Recovery Path (App Code Rollback)

1. In Vercel production project, open deployments.
2. Identify the last known-good deployment before the incident.
3. Promote that deployment to production.
4. Verify critical paths:
   - Landing page load
   - Login/auth
   - Dashboard/home
   - Checkout/billing flow
   - API health endpoints

## 4. Config/Secret Rollback

Use when breakage is caused by environment/config changes:

1. Restore previous known-good env values in platform settings.
2. Redeploy (or restart) to apply values.
3. Re-run smoke checks on auth, API, and billing.

## 5. Database Change Rollback Strategy

Applied migrations are not manually reverted in production.

1. Keep app on last good code.
2. Ship a **new forward migration** that neutralizes or corrects bad schema behavior.
3. Validate with targeted SQL checks and application smoke tests.

## 6. Verification Checklist (must pass before incident closure)

- [ ] Error rates returned to normal baseline.
- [ ] Core user journeys working.
- [ ] No new data corruption indicators.
- [ ] Monitoring and alerting stable for 30+ minutes.
- [ ] Incident timeline recorded.

## 7. Communication

- Provide internal status updates at meaningful milestones.
- For customer-impact incidents, send a clear summary: impact, duration, resolution, next steps.

## 8. Post-Incident Actions (within 5 business days)

1. Complete postmortem.
2. Create corrective actions with owners/dates.
3. Update tests/feature flags to prevent recurrence.
4. Update this runbook if gaps were discovered.

_Last reviewed: 2026-07-12._
