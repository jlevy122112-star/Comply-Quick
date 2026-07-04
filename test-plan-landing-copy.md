# Test Plan — Landing Page Copy Reframe (PR #6)

## What changed
Copy-only edits in `src/app/page.tsx` (hero + comparison) and `src/app/layout.tsx` (metadata).
Reframes "developer liability shift onto merchant" → "business builds trust with its customers."

## Environments
- **Before (old copy):** production https://comply-quick-comply-quick.vercel.app/ (PR #6 not merged)
- **After (new copy):** local dev http://localhost:3000/ (PR #6 branch)

## Test 1 — Hero reflects new client→customer framing (primary)
Steps: open http://localhost:3000/ , view hero.
Pass/fail:
- H1 text reads **"Your Entire Compliance Stack, Done in Under a Minute."** (PASS)
- H1 does NOT contain "Liability Shield" (would FAIL if old copy)
- Sub-headline contains "clear customer terms" and "compliance score your customers can trust"
- Badge reads "Built for … sites" (not "… developers")

## Test 2 — Comparison section reworded
Steps: scroll to "Not another template generator." section.
Pass/fail:
- Green (positive) list contains **"Generates clear customer-facing terms that set expectations and build trust at checkout"**
- No text "shifting liability from developer to merchant" anywhere on page
- Red (negative) list contains "No clear terms defining the relationship with your customers"

## Test 3 — Regression: page still renders + CTAs intact
Pass/fail:
- Pricing section still shows $12 / $29 / $99 cards
- "Generate Your Compliance Package" CTA present and links to /dashboard
- No layout breakage / console errors

## Evidence
- Before/after side-by-side hero screenshots (prod vs local)
- Screenshot of reworded comparison section
