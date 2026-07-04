---
name: testing-comply-quick
description: Test the Comply-Quick compliance wizard, paywall, and enterprise features end-to-end. Use when verifying dashboard, landing page, API, or ClauseEngine changes.
---

# Testing Comply-Quick

## Prerequisites

- Node.js and npm installed
- Dev server running on port 3001: `cd /home/ubuntu/repos/comply-quick && PORT=3001 npm run dev`

## Dev Server

The app runs on `http://localhost:3001`. Key routes:
- `/` — Landing page with pricing tiers
- `/dashboard` — Interactive compliance wizard (5-step flow)
- `/dashboard?status=success` — Premium-unlocked state (bypasses paywall)
- `/api/compliance` — POST endpoint for programmatic generation

## Testing the Wizard Flow

1. Navigate to `/dashboard`
2. Step 1: Select user type (Developer or Merchant)
3. Step 2: Select framework (Shopify, Next.js, WordPress, Wix, Squarespace)
4. Step 3: Select tracking pixels (Meta, Google, TikTok, LinkedIn, Pinterest, Snapchat) — multi-select, can skip
5. Step 4: Select target regions (US, CCPA, GDPR, PIPEDA, LGPD, Australia) — at least 1 required
6. Step 5: Select enterprise modules (HIPAA, PCI-DSS, ADA/WCAG, SOC 2) — optional
7. Click "Generate Compliance Package" to see results

## Free Preview vs Premium

- **Free preview (no `?status=success`)**: Shows Compliance Score ring + full Inward Contract Shield section. Everything else (Privacy Addendum, Checklist, Enterprise Modules) is blurred behind a paywall overlay with 3 CTA buttons ($12/$29/$99).
- **Premium (`?status=success` in URL)**: All sections unlocked with Copy buttons, Download as Markdown button, and Start Over button visible.

**Important**: Adding `?status=success` to the URL resets React state, so you must re-run the wizard after navigating to the premium URL. The premium flag persists through wizard steps because `useSearchParams` reads it reactively.

## Testing the API

```bash
# Valid request
curl -X POST http://localhost:3001/api/compliance \
  -H "Content-Type: application/json" \
  -d '{"userType":"developer","framework":"wix","trackingPixels":["linkedin"],"targetRegions":["canada_pipeda"],"complianceModules":["hipaa"]}'

# Invalid request (should return 422)
curl -X POST http://localhost:3001/api/compliance \
  -H "Content-Type: application/json" \
  -d '{"userType":"developer","framework":"angular","trackingPixels":["meta"],"targetRegions":["us_general"]}'

# Markdown format
curl -X POST http://localhost:3001/api/compliance \
  -H "Content-Type: application/json" \
  -d '{"userType":"developer","framework":"shopify","trackingPixels":["meta","google"],"targetRegions":["us_general","eu_gdpr"],"format":"markdown"}'
```

## Key Assertions

- Score ring should show a numeric value 0-100 with color coding (green >= 80, yellow >= 60, red < 60)
- 4 category breakdowns: Contract Protection, Privacy Coverage, Pre-Launch Ready, Regulatory Breadth
- Wix-specific clauses: "Closed Platform Architecture Disclaimer", "Wix App Market Liability Exclusion", "Managed Infrastructure Limitation"
- LinkedIn pixel: disclosure mentions "LinkedIn Insight Tag", "LinkedIn Corporation (Microsoft)", opt-out via "LinkedIn's Ad Settings"
- PIPEDA region: notice mentions "Office of the Privacy Commissioner of Canada"
- HIPAA module: 4 clauses (BAA, PHI Encryption, Breach Notification, Minimum Necessary) + 8-item checklist
- Markdown download: file named `compliance-package.md`, contains "# Compliance Package Report" header and all sections

## Lint & Build

```bash
npx eslint src/    # Should pass with 0 errors
npm run build      # Should compile successfully
```

## Devin Secrets Needed

None — the app has no external service dependencies for testing. All compliance generation is local/deterministic.
