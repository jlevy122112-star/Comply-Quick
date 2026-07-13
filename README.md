# Comply-Quick

Compliance automation SaaS for freelancers, agencies, and enterprise teams.

## Quality Gates

```bash
npm run typecheck
npm run lint
npm run test
NODE_OPTIONS=--max-old-space-size=4096 npm run build
npm run perf:budget
```

## Optimization Rollback Flags

The optimization work is feature-flagged so production can be rolled back quickly
without code reverts:

- `NEXT_PUBLIC_ENABLE_PROFIT_OPTIMIZATIONS` (default: `true`)
  - Enables pricing/paywall experiments and profitability nudges.
- `NEXT_PUBLIC_ENABLE_SPEED_OPTIMIZATIONS` (default: `true`)
  - Enables web-vitals telemetry and deferred third-party analytics loading.
- `NEXT_PUBLIC_ENABLE_CHURN_SAVE_OFFER` (default: `true`)
  - Enables the churn-save offer surface in cancellation flow.
- `NEXT_PUBLIC_EXPERIMENT_PRICING_V1_FORCE` (optional)
  - Force one variant globally: `control`, `annual_default`, `agency_first`, or `holdout`.

Set any flag to `false` (or `0`) to restore control behavior immediately.

## Still Need to Implement:

Upgrade Implementation Plan for CoPilot CLI

Files to Modify
| File | Purpose | Changes Needed |
|------|---------|----------------|
| supabase/migrations/*_free_scan_claims.sql | Private entitlement storage | Create one-time email claim records with unique email/token and RLS/no public policies. |
| src/app/api/free-scan/claim/route.ts | Claim endpoint | Validate email and atomically issue a one-use token or reject repeat claims. |
| src/app/api/public-scan/route.ts | Scan endpoint | Consume a supplied free-scan token before fetching a site. |
| src/app/free-scan/page.tsx | Free Scan screen | Render a dedicated token-gated scan page. |
| src/components/landing/LeadCaptureForm.tsx | Exit lead signup | Claim a free scan and redirect successful exit-intent signups. |
| src/components/landing/ExitIntentCapture.tsx | Exit popup | Enable free-scan claim behavior. |
| src/components/landing/HeroScan.tsx | Scanner form | Send the issued token and prevent a second UI scan. |

### Dependencies (may need updates)
| File | Relationship |
|------|--------------|
| src/lib/supabase/admin.ts | Service-role server access to the private claims table. |
| src/app/api/public-scan/route.ts | Existing rate-limited scanner becomes token-aware. |
| supabase/migrations/0030_leads.sql | Existing email capture informs private-table/RLS conventions. |

### Test Files
| Test | Coverage |
|------|----------|
| src/__tests__/free-scan-claim.test.ts | First claim, duplicate rejection, invalid input, unavailable persistence. |
| src/__tests__/public-scan.test.ts | Token consumption and rejected re-use. |
| src/__tests__/exit-intent.test.tsx | Claiming exit-intent form behavior. |

### Reference Patterns
| File | Pattern |
|------|---------|
| src/app/api/leads/route.ts | Validated rate-limited private email capture and unique-conflict handling. |
| supabase/migrations/0030_leads.sql | Private service-role-only table with RLS and no public policies. |

### Risk Assessment
- [ ] Breaking changes to public API
- [x] Database migrations needed
- [x] Configuration changes required
