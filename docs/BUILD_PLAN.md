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
- 🆕 **[Up 9] Slack alerts** — payment failures, scan failures, worker crashes; Stripe webhook logging to `#revenue-alerts`.
- Requirement: prevent silent failures; protect MRR. External deps: `SENTRY_DSN`, `SLACK_WEBHOOK_URL`.

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

## 3. ⚠️ Contextual errors / conflicts needing an owner decision

**C-Pricing (blocks [Up 1] agency billing & [Up 5] freemium).** The Executive Summary
contains **three different definitions of the "single" tier**:
1. `TIER_CONFIG` snippet: `single { monthly: 29, annual: 290, seats: 1, scanLimit: 10 }`.
2. "Option A (recommended)": **Pro = $12/month** (rename single→pro), unlimited scans.
3. **Current code**: `single` is a **one-time $12 payment** (`PLAN_CONFIG.single.mode="payment"`).
Question: which is canonical, and should `single` be converted from a one-time payment to a
**recurring subscription** (needs new Stripe prices `STRIPE_PRICE_SINGLE_MONTHLY/ANNUAL`)?

**C-Scans (blocks [Up 5]).** Free-tier scan cap conflicts: your Phase-5 prompt and Exec §B say
**"2 scans/month"**; the "Option A" box and the code snippet say **"1 scan/month"**. Which?

**C-Upload (blocks [Up 3]).** "$50 per template upload" (metered API) conflicts with the
Marketplace model, where **creators upload templates for free to sell them**. Is the $50 charge
meant only for **programmatic/API uploads** (enterprise/agency integrations), and NOT for
Creator-Studio marketplace listings? Otherwise it would kill marketplace supply.

**C-Legal (affects [Up 6]).** Autopilot currently **proposes** regenerated documents pending
review (deliberate, for liability). [Up 6] says "regenerate documents automatically". Auto-publish
legal text without human review raises the exact liability [Up 10] tries to cap. Recommend
keeping **propose-only** with one-click apply. Confirm?

**C-Outcomes (not code).** Targets — NPS ≥ 40, 60% 30-day retention, 20–30% trial→paid,
100k/mo organic traffic, 50–100 partners, LTV:CAC ≥ 10:1 — are **business outcomes**, not
features. I will build the mechanisms/instrumentation that *enable* them; I cannot guarantee the
numbers themselves.

**C-Process (not code).** 20 user interviews, 50-user closed beta, quarterly lawyer review, and
E&O insurance are **human/process** items. I will scaffold supporting tooling (survey system,
retention dashboards, a review queue), but cannot execute the interviews/legal review.

**C-Scope (out of the 12-item list).** The Executive Summary also lists codebase improvements
that are **not** in the 12 upgrade groups: DB indexes, SSRF scan-URL validation, Redis scan cache,
S3/Vercel Blob for report storage, and payment/E2E integration tests. Per "implement only what's
listed" I've left these **out of scope**. Want any pulled in?

---

## 4. Proposed build order (each = its own PR)

1. **Pricing foundation** — `src/lib/pricing.ts` (`TIER_CONFIG`) + `analytics` events. *(unblocks 2, 5, 6)* — **needs C-Pricing.**
2. **[Up 1]** Agency billing — seats/scan limits/overage. *(refs PR #14/#15)*
3. **[Up 3]** Metered API billing — keys, usage, Stripe metered, rate limit, docs. — **needs C-Upload.**
4. **[Up 5]** Freemium funnel — free-tier caps, paywall triggers, conversion tracking. — **needs C-Scans.**
5. **[Up 4]** Compliance score improvement path + public score pages + embeddable badges. *(refs PR #10/#13)*
6. **[Up 8]** Partner program — referrals, 30% recurring, dashboard.
7. **[Up 7]** Calendar + alerts.
8. **[Up 9]** Sentry + Slack alerts. *(refs PR #8)* — needs `SENTRY_DSN`, `SLACK_WEBHOOK_URL`.
9. **[Up 10]** Legal safeguards — disclaimers, ToS liability cap, review-queue tooling.
10. **[Up 12]** SEO blog engine + initial articles + funnel wiring.
11. **[Up 11]** PMF tooling — NPS survey, retention/churn dashboards, channel segmentation.
12. **Verify already-done** — [Up 2] Marketplace (P6), [Up 6] Regulation Autopilot (P2/P4) GDPR/CCPA/HIPAA/ADA coverage. *(refs PR #9/#13/#18)*
