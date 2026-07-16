---
name: testing-comply-quick
description: Test the Comply-Quick compliance wizard, paywall, and enterprise features end-to-end. Use when verifying dashboard, landing page, API, or ClauseEngine changes.
---

# Testing Comply-Quick

## Prerequisites

- Node.js and npm installed (prefer Node 22+; `@supabase/supabase-js` warns and CI/build noise increases on Node 20).
- Supabase env configured in `.env.local` at repo root (see "Auth & Local Setup").

## Auth & Local Setup (Supabase)

The dashboard is gated behind Supabase auth — unauthenticated `/dashboard/*` routes redirect to `/login`. You must configure `.env.local` (NOT `.env vars`, which Next.js ignores) with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Login/signup are Supabase **server actions** (`src/app/login/actions.ts`): password sign-in via `signInWithPassword`, signup via `signUp` (email confirmation may be ON — signup then shows a "Confirm your email" notice instead of logging in). Sign in with a confirmed test user to reach `/dashboard/home`.

## IMPORTANT: Test against a PRODUCTION build, not `next dev`

The local `next dev` server may serve HTML that **never hydrates** — the page looks right but is completely non-interactive (tab clicks do nothing, typing into inputs registers nothing). The tell is failed HMR websockets in the console (`ws://…/_next/webpack-hmr … ERR_INVALID_HTTP_RESPONSE`) and/or report-only CSP `unsafe-eval` warnings. When this happens, do NOT conclude the code is broken — it's a dev-server/environment artifact.

Reliable approach for UI testing:
```powershell
# from repo root
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force   # clear stale dev server
npm run build
npm run start   # serves production build on :3000 (run in a persistent/background shell)
```
A production build has no HMR/eval dependency, so hydration works and interactions behave like the deployed app. Quick hydration check: type into any input; if the value doesn't appear, the page isn't interactive.

## Browser (computer-tool) gotchas on this VM

- **Typing drops shift-modified characters** (`@`, `!`, capital letters) — so emails/passwords typed directly get mangled (e.g. `TestPass123!` → `estass123`). Use the clipboard instead: `Set-Clipboard -Value "<text>"` in the shell, then click the field and `Ctrl+A`, `Delete`, `Ctrl+V`.
- **Address bar `:` is also a shifted char** — type the host, then send `shift+semicolon` for the colon, then the rest (e.g. `127.0.0.1` + `shift+;` + `3000/login`).
- **DevTools open narrows the viewport** and shifts element coordinates — close DevTools (F12) before clicking by coordinate, or account for the shift.
- The dashboard header nav is horizontally scrollable; **Sign out** sits at the far right — scroll the header right to reveal it.

## Key Routes

The current app serves on `http://localhost:3000` (older notes referenced :3001). Key routes:
- `/` — Landing page with pricing tiers
- `/dashboard` — Interactive compliance wizard (5-step flow)
- `/dashboard?status=success&plan=single` — Premium-unlocked state (bypasses paywall, sets tier)
- `/dashboard/home` — Command Center dashboard (paid tiers only)
- `/api/compliance` — POST endpoint for programmatic generation
- `/api/checkout` — POST endpoint for Stripe checkout sessions
- `/sitemap.xml` — SEO sitemap
- `/robots.txt` — SEO robots

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

## Testing the Command Center (`/dashboard/home`)

The Command Center reads from localStorage. To test with data:
1. First complete a wizard flow with `?status=success&plan=single` in the URL
2. Generate a package — it auto-saves to localStorage
3. Navigate to `/dashboard/home` to see the saved project

Key elements to verify:
- **Score Overview**: 5 cards (Overall, Contract Protection, Privacy Coverage, Pre-Launch Ready, Regulatory Breadth)
- **Active Projects**: List with framework icon, score, status badge, Download/Delete buttons
- **Quick-Launch Tools**: Grid with "Generate New Package" (active) + coming-soon tools
- **Regulatory Alerts**: Blurred for non-enterprise tiers with "Upgrade to Enterprise" link
- **Tier badge**: Shows "Single", "Agency", or "Enterprise" in header based on `?plan=` param
- **Empty state**: When no projects exist, shows "No projects yet" with CTA

## Stripe Checkout (Dev Mode)

Without `STRIPE_SECRET_KEY` set, the checkout flow uses a dev-mode fallback:
- Clicking a paywall CTA button POSTs to `/api/checkout`
- API returns 503 with `{"error": "Stripe is not configured"}`
- Client catches this and redirects to `/dashboard?status=success&plan={plan}`
- This simulates a successful payment for testing

To test with real Stripe, set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env vars.

## Testing the API

```bash
# Valid request
curl -X POST http://localhost:3000/api/compliance \
  -H "Content-Type: application/json" \
  -d '{"userType":"developer","framework":"wix","trackingPixels":["linkedin"],"targetRegions":["canada_pipeda"],"complianceModules":["hipaa"]}'

# Invalid request (should return 422)
curl -X POST http://localhost:3000/api/compliance \
  -H "Content-Type: application/json" \
  -d '{"userType":"developer","framework":"angular","trackingPixels":["meta"],"targetRegions":["us_general"]}'

# Markdown format
curl -X POST http://localhost:3000/api/compliance \
  -H "Content-Type: application/json" \
  -d '{"userType":"developer","framework":"shopify","trackingPixels":["meta","google"],"targetRegions":["us_general","eu_gdpr"],"format":"markdown"}'

# Checkout API (dev mode — should return 503)
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"plan":"single"}'
```

## Key Assertions

- Score ring should show a numeric value 0-100 with color coding (green >= 80, yellow >= 60, red < 60)
- 4 category breakdowns: Contract Protection, Privacy Coverage, Pre-Launch Ready, Regulatory Breadth
- Wix-specific clauses: "Closed Platform Architecture Disclaimer", "Wix App Market Liability Exclusion", "Managed Infrastructure Limitation"
- LinkedIn pixel: disclosure mentions "LinkedIn Insight Tag", "LinkedIn Corporation (Microsoft)", opt-out via "LinkedIn's Ad Settings"
- PIPEDA region: notice mentions "Office of the Privacy Commissioner of Canada"
- HIPAA module: 4 clauses (BAA, PHI Encryption, Breach Notification, Minimum Necessary) + 8-item checklist
- Markdown download from wizard: file named `compliance-package.md`
- Markdown download from Command Center: file named `{framework}-project-compliance.md`
- Command Center project card shows framework name, pixel/region/module counts, and score

## SEO Verification

```bash
# Check metadata in HTML
curl -s http://localhost:3000 | grep -o '<title>[^<]*</title>'
# Expected: <title>Comply-Quick — Compliance Package Generator for Web Agencies</title>

# Check sitemap
curl -s http://localhost:3000/sitemap.xml
# Expected: URLs with priorities

# Check robots.txt
curl -s http://localhost:3000/robots.txt
# Expected: Allow /, Disallow /api/ and /dashboard/home
```

## Known Gotchas

- **localStorage hydration**: The Command Center uses lazy `useState` initializers to read localStorage. If you see hydration mismatches, it may be because server-rendered HTML shows empty state while client has data. This is expected and resolves on client mount.
- **`useSyncExternalStore` pitfall**: Do NOT use `useSyncExternalStore` with localStorage snapshots that return new arrays/objects each call — this causes infinite render loops. Use lazy `useState` initializer instead.
- **Wizard state reset on URL change**: Navigating to `?status=success` resets the wizard to step 1. You must complete the wizard again to generate a package. This is by design — the URL change triggers a full page re-render.
- **ESLint `set-state-in-effect` rule**: This project's ESLint config disallows `setState` inside `useEffect`. Use lazy `useState` initializers or `useSyncExternalStore` (with cached snapshots) instead.

## Lint & Build

```bash
npx eslint src/    # Should pass with 0 errors
npm run build      # Should compile successfully
```

## Devin Secrets Needed

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — required to reach any authenticated `/dashboard/*` screen. Write them to `.env.local` at repo root.
- A confirmed Supabase test user (email + password) to sign in. If email confirmation is ON, either pre-confirm the user via the service-role admin API or use an already-confirmed account. Never print or commit these values.

The compliance wizard/API generation itself is local/deterministic; Stripe checkout uses a dev-mode fallback when `STRIPE_SECRET_KEY` is not set.
