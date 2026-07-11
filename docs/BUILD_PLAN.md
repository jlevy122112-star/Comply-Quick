# Comply-Quick — Integrated Phased Build Plan

Status: **living document**. This folds the **profitability upgrade list** (the 12
"⭐ PHASE" groups in the Executive Summary / `Copilot Suggested Changes`) into the
**original 10-phase roadmap** (`docs/architecture/COMPLIANCE_OS.md §3`).

Rules for this document (per owner):
- **Nothing is removed.** Every original phase and every upgrade is retained unless
  an upgrade explicitly *overwrites* an original item (those are marked **OVERWRITES**).
- Each upgrade is assigned to its home original phase and tagged with a status:
  - ✅ **Done** — already implemented and merged (or in an open PR).
  - 🟡 **Partial** — partly built; specific gap called out.
  - 🆕 **New** — not yet built.
- Work that must revisit an already-merged phase ships in a **new PR** whose description
  references the original PR(s).
- **⚠️ Conflict** markers denote contextual errors requiring an owner decision before
  build (see §3). These are NOT resolved unilaterally.

Legend for source: **[Orig Pn]** = original roadmap phase; **[Up n]** = upgrade group n
from the profitability list.

---

## 1. Status of the original 10 phases

| Orig Phase | Feature | Status | Evidence |
|---|---|---|---|
| P1 | Foundation (`@/services`: logger, errors, rate-limit, api-response, stripe client) | ✅ Done | PR #8 |
| P2 | Autopilot (regulation diff, cron, version history, notifications) | ✅ Done | PR #9 |
| P3 | Scanner (headless worker + fallback, tracker/violation detection, score, history) | ✅ Done | PR #10, #11 |
| P4 | Intelligence (weekly re-scan, alerts, "Fix It", timeline) | ✅ Done | PR #13 |
| P5 | Agency Portal (multi-tenant RLS, white-label branding, custom domains) | 🟡 Partial | PR #14, #15 — **billing gap** |
| P6 | Marketplace (creator accounts, listings, types, preview/body, search, Stripe Connect, earnings + revenue) | ✅ Done | PR #18 |
| P7 | AI Assistant (chat, clause explainer, URL audit tool, history) | 🆕 New | not started — **not in upgrade list; retained** |
| P8 | Developer API (API keys, metered billing, doc/scan/score endpoints) | 🆕 New | not started |
| P9 | Calendar (`compliance_tasks`, renewal/scan/alert aggregation, calendar UI) | 🆕 New | not started |
| P10 | Pricing + Growth (tier gating, referrals, badges, shareable reports) | 🟡 Partial | tiers exist; growth surfaces new |

---

## 2. Upgrade-to-phase mapping (integrated plan)

### [Orig P1] Foundation — + observability upgrade
- ✅ Structured logging (Pino-style logger) — **already built** (`@/services/logger`).
- 🆕 **[Up 9] Sentry integration** — error tracking (`sentry.server/client.config`).
- 🆕 **[Up 9] Revenue-event logging** — payment failures, scan failures, worker crashes logged via the structured logger from the Stripe webhook.
- Requirement: prevent silent failures; protect MRR. External deps: `SENTRY_DSN`.

### [Orig P2] Autopilot + [Orig P4] Intelligence — Regulation Autopilot upgrade
- ✅ **[Up 6]** Regulation diff engine, auto-proposed updates, version history, change alerts, weekly re-scan — **already built** across PR #9 + #13.
- 🟡 Gap to verify: explicit coverage for **GDPR, CCPA, HIPAA, ADA** in the regulation set; auto-regenerate documents on change (Autopilot currently *proposes*; see §3 C-Legal on auto-publish vs propose-only).

### [Orig P3] Scanner + [Orig P4] — Compliance Score & Badges upgrade
- ✅ Score calculation, score history, score-drop alerts — **already built** (Scanner/Intelligence).
- 🆕 **[Up 4] Score improvement path** — actionable "path to higher score" surface.
- 🆕 **[Up 4] Public score pages** — unauthenticated `/score/<token>` shareable page (score only, never full paid report).
- 🆕 **[Up 4] Embeddable badges** — "Comply-Quick Certified", "Privacy Score: 87/100" (`<script>`/iframe/SVG embed).
- Requirement: score updates after scans (met); score drives upsell triggers (ties to [Up 5]); shareable publicly.

### [Orig P5] Agency Portal — Agency White-Label upgrade
- ✅ Custom domains (PR #15); white-label branding — logo, color theme, agency name, custom footer (PR #14); multi-client dashboards, per-client scans, per-client scores (PR #14).
- 🆕 **[Up 1] Agency billing** — **the real work here**: agency tier + **seat limits**, **scan limits**, **overage billing** (metered). Must use **`TIER_CONFIG`** pricing; **unlimited clients for Enterprise**; resell model; fully branded (no Comply-Quick visible).
- Depends on: `src/lib/pricing.ts` (`TIER_CONFIG`) — see §3 C-Pricing.

### [Orig P6] Marketplace — Marketplace Templates upgrade
- ✅ **[Up 2]** Creator accounts; template upload (privacy policies, cookie banners, ADA packs, HIPAA packs, custom); preview; search; Stripe Connect payouts; paid + free templates; creator earnings; marketplace revenue; 50/50 share — **fully built** (PR #18). **Done.**

### [Orig P7] AI Assistant — retained, not in upgrade list
- 🆕 Not started, and **not referenced by the 12-item upgrade list**. Retained per owner instruction. The Executive Summary §3-D mentions an AI support chatbot as a *suggestion* (reduce support tickets), so this phase still has product intent. **Deferred** unless prioritized.

### [Orig P8] Developer API — Metered API Billing upgrade
- 🆕 **[Up 3]** API keys (hashed), API usage tracking, **metered billing** ($0.01/API call, $5/extra scan, $50/template upload — see §3 C-Upload), usage dashboards, Stripe metered billing, rate limiting (reuse P1 `RateLimiter`), API documentation page.
- Requirement: enterprise + agency integrations; usage-based expansion revenue.

### [Orig P9] Calendar — Calendar + Alerts upgrade
- 🆕 **[Up 7]** Calendar UI, compliance tasks, renewal reminders, scan schedules, risk alerts, regulation-change alerts, **agency client calendar view**.
- Requirement: integrate with compliance score, autopilot, and agency dashboards.

### [Orig P10] Pricing + Growth — Freemium, Partners, SEO upgrades
- 🟡 **[Up 5] Freemium funnel** — free tier (**scans/month — see §3 C-Scans**), basic report; paywall triggers (low score, score drop, missing clauses/ADA/HIPAA); upgrade CTAs; trial→paid conversion tracking; Stripe Checkout + analytics integration.
- 🆕 **[Up 8] Partner program** — partner accounts, referral links, **30% recurring rev share**, partner dashboard (referred customers, earnings, payouts), Stripe Connect (reuses marketplace Connect plumbing).
- 🆕 **[Up 12] SEO content engine** — blog system; initial articles (GDPR checklist, CCPA tracker detection, privacy-policy template); SEO metadata; internal linking; content→freemium→paid funnel.
- 🆕 **[Up 4] Badges/public score** (also listed under P3/P4) — the shareable growth surface.

### [Cross-cutting] Legal Safeguards — [Up 10]
- 🟡/🆕 Disclaimer on all generated content ("This package is informational only. Consult a legal professional before deployment."); ToS liability cap; quarterly lawyer-review **workflow** (tooling only — see §3 C-Process).

### [New ops phase P11] PMF Validation — [Up 11]
- 🆕 NPS survey system; retention tracking (30-day retention, trial→paid, churn reasons); segment retention by acquisition channel.
- ⚠️ 20 user interviews + 50-user closed beta are **human workflows** — I can build the survey/tracking tooling, not run the interviews (see §3 C-Process).

---

## 3. Contextual conflicts — RESOLVED (owner decisions 2026-07-03)

**C-Pricing — RESOLVED.** Rename `single` → **`pro` = $12/month subscription**. Convert from the
current one-time payment to a recurring subscription (needs new Stripe prices
`STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_ANNUAL`). `TIER_CONFIG` canonical: `free`, `pro`
($12/mo), `agency`, `enterprise`.

**C-Scans — RESOLVED.** Free tier = **1 scan / month**.

**C-Upload — RESOLVED.** The **$50/template-upload** metered charge applies to
**API/programmatic uploads only** — NOT Creator-Studio marketplace listings (those stay free to list).

**C-Legal — RESOLVED.** Autopilot stays **propose-only with one-click apply**. No silent
auto-publish of regenerated legal text.

**C-Outcomes (not code, acknowledged).** Targets — NPS ≥ 40, 60% 30-day retention, 20–30%
trial→paid, 100k/mo organic traffic, 50–100 partners, LTV:CAC ≥ 10:1 — are business outcomes.
Build the enabling mechanisms/instrumentation only; numbers not guaranteed.

**C-Process (not code, acknowledged).** 20 user interviews, 50-user closed beta, quarterly lawyer
review, E&O insurance are human/process items. Scaffold tooling only (survey system, retention
dashboards, review queue).

**C-Scope (out of the 12-item list) — RESOLVED: pull in ALL 5.** Extra codebase improvements
in the Executive Summary but NOT in the 12 upgrade groups, now in scope:
DB indexes, SSRF scan-URL validation, Redis scan cache, S3/Vercel Blob report storage, and
payment/E2E integration tests. Shipped as a dedicated hardening PR (§4 step 13).

---

## 4. Proposed build order (each = its own PR)

1. ✅ **Pricing foundation** — `src/lib/pricing.ts` (`TIER_CONFIG`), rename `single`→`pro` $12/mo subscription, `analytics` events. — **PR #20 (merged)**
2. ✅ **[Up 1]** Agency billing — seats/scan limits/overage. — **PR #21 (merged)**
3. ✅ **[Up 3]** Metered API billing — keys, usage, Stripe metered, rate limit, docs. — **PR #22 (merged)**
4. ✅ **[Up 5]** Freemium funnel — free-tier caps (1 scan/mo), paywall triggers, conversion tracking. — **PR #24 (merged)**
5. ✅ **[Up 4]** Compliance score improvement path + public score pages + embeddable badges. — **PR #25 (merged)**
6. ✅ **[Up 8]** Partner program — referrals, 30% recurring, dashboard. — **PR #26 (merged)**
7. ✅ **[Up 7]** Calendar + alerts + one-way ICS calendar linking. — **PR #27 (merged)**
8. ✅ **[Up 9]** Sentry error tracking (live-verified ingest). — **PR #28 (merged), #29 (slugs)**
9. ✅ **[Up 10]** Legal safeguards — disclaimers, ToS liability cap, review-queue tooling. — **PR #30 (CI green; awaiting owner legal sign-off before merge)**
10. ✅ **[Up 12]** SEO blog engine + 3 articles + content→freemium→paid funnel. — **PR #31 (CI green)**
11. ✅ **[Up 11]** PMF tooling — NPS survey, churn exit survey, retention/channel dashboards. — **PR #32 (CI green)**
12. ✅ **Verify already-done** — [Up 2] Marketplace (P6, PR #18), [Up 6] Regulation Autopilot (P2/P4, PR #9/#13). *Confirmed present.*
13. 🟡 **Extra hardening** — ✅ SSRF scan-URL validation, ✅ DB-backed 7-day scan cache, ✅ payment/E2E integration test (**PR #33**); ✅ DB indexes already comprehensive (no migration); ⛔ S3/Vercel Blob report storage **N/A** (reports generated client-side, never server-stored).
