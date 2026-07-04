# Phase 6 Test Plan: Command Center + Stripe + SEO

## What Changed
- New `/dashboard/home` Command Center dashboard for paid tiers
- Stripe Checkout integration via `/api/checkout` with dev-mode fallback
- Paywall CTA buttons now call real checkout flow (or fallback)
- Generated packages save to localStorage when premium active
- SEO metadata (title, OG, Twitter), sitemap.xml, robots.txt
- Landing page nav updated with Dashboard link

## Pre-verified via Shell (not recorded)
- `GET /sitemap.xml` returns valid XML with 3 URLs (/, /dashboard, /dashboard/home) with correct priorities (1.0, 0.9, 0.8)
- `GET /robots.txt` returns correct rules: allow /, disallow /api/ and /dashboard/home, sitemap URL
- `POST /api/checkout` with `{"plan":"single"}` returns `{"error":"Stripe is not configured","message":"..."}` (503) — correct dev-mode behavior
- HTML `<head>` contains: `<title>Comply-Quick — Compliance Package Generator for Web Agencies</title>`, OG title, OG description, twitter:card, keywords meta tag

## Test Flow (Browser — Recorded)

### Test 1: Landing Page Nav Links to Command Center
**Steps:** Navigate to `http://localhost:3001`, verify "Dashboard" link exists in nav
**Pass:** Nav contains link text "Dashboard" pointing to `/dashboard/home`
**Fail:** Link missing or points elsewhere

### Test 2: Command Center Renders Empty State
**Steps:** Navigate to `/dashboard/home` directly
**Pass:** Page renders with:
  - Header showing "Compliance Command Center" title
  - "No projects yet" empty state message
  - Quick-Launch Tools grid with at least "Generate New Package" tool
  - Score overview shows zeroed/empty state
**Fail:** Page crashes, shows blank, or shows projects when none exist

### Test 3: Wizard → Premium Unlock → Project Saved → Visible in Command Center
**Steps:**
1. Navigate to `/dashboard`
2. Complete wizard: select Developer, Wix, LinkedIn pixel, Canada PIPEDA, HIPAA module
3. Generate package — verify free preview shows (score ring + contract shield visible, rest blurred)
4. Verify paywall overlay has 3 CTA buttons ($12, $29, $99)
5. Click "$12" button — should redirect to `/dashboard?status=success&plan=single` (dev fallback)
6. Complete wizard again with same selections and generate
7. Verify premium content is fully visible (privacy addendum, checklist, enterprise modules — no blur)
8. Navigate to `/dashboard/home`
9. Verify the generated project appears in Active Projects list

**Pass criteria:**
  - Step 3: Score ring visible with numeric score, contract shield text visible, paywall blur present below
  - Step 4: Three buttons with text containing "$12", "$29/mo", "$99/mo"
  - Step 5: URL changes to include `?status=success`
  - Step 7: All sections visible without blur overlay
  - Step 9: Project card visible in Command Center with framework "Wix" and score displayed

**Fail:** Any step doesn't produce expected result

### Test 4: Project Download from Command Center
**Steps:** From Command Center with a saved project, click the download button on the project card
**Pass:** Browser triggers a `.md` file download
**Fail:** No download initiated or download contains empty/malformed content

### Test 5: Project Deletion from Command Center
**Steps:** From Command Center, click delete on a project
**Pass:** Project removed from list, empty state returns if it was the only project
**Fail:** Project still visible after deletion
