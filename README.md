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
