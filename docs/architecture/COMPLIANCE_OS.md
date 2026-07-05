# Comply-Quick — "Compliance OS" Architecture

Status: **Phase 1 (Foundation & Architecture)** — living document.
Owner: engineering. Update this doc as each phase lands.

This is the master architecture map for turning Comply-Quick from a single-page
compliance **generator** into a full compliance **automation ecosystem**. It
records (a) what exists today, (b) the target architecture every future module
plugs into, and (c) how the 10-phase roadmap maps onto it.

---

## 1. Current State (audit)

Next.js 16 App Router + TypeScript (strict), Tailwind, Supabase (Auth + Postgres),
Stripe, deployed on Vercel. Tests via Vitest.

```
src/
  app/
    page.tsx, layout.tsx            landing + SEO metadata
    login/                          magic-link + OAuth entry
    auth/callback/                  Supabase OAuth/magic-link exchange
    dashboard/                      wizard (DashboardWizard) + saved projects
      home/                         CommandCenterView (premium)
    api/
      compliance/                   POST → generate package (public)
      checkout/                     POST → Stripe Checkout session (auth)
      billing-portal/               POST → Stripe Customer Portal (auth)
      webhooks/stripe/              POST → writes entitlements (service role)
  components/
    ClauseEngine.tsx                core generator: stack → legal clauses
    EnterpriseModules.tsx           HIPAA / PCI-DSS / ADA / SOC2 modules
  lib/
    entitlements.ts                 server-verified paid access
    projects-db.ts                  saved projects (per-user)
    supabase/{client,server,admin,middleware}.ts
  services/                         ← NEW shared-services layer (this phase)
supabase/migrations/0001_init.sql   subscriptions + projects, RLS, signup trigger
```

**Domain engine.** `ClauseEngine.generateCompliancePackage(input)` maps a
`{ userType, framework, trackingPixels[], targetRegions[], complianceModules[] }`
input to a `CompliancePackage` (inward contract shield, privacy addendum,
pre-launch checklist, enterprise modules, compliance score). Pure and
synchronous — the natural core for every later feature.

**Entitlements.** Stripe webhook (service role) writes `public.subscriptions`;
server components/routes read it via `getEntitlement()`. Client flags are never
trusted. RLS: users read only their own subscription; projects are full CRUD
scoped to `auth.uid()`.

**Gaps for the ecosystem.** No shared logging/error/rate-limit primitives (added
this phase); no background jobs (cron); no multi-tenant/agency model; no
persistence for scans/alerts/versions; no public API keys; single Stripe
customer↔user mapping (no Connect, no metered usage).

---

## 2. Target Architecture — the Compliance OS

Everything is organized around the pure **ClauseEngine core** with a **shared
services layer** beneath it and **feature modules** above it. Modules never call
`console.*`, instantiate Stripe, or hand-roll error shapes — they go through
`@/services`.

```
            ┌─────────────────────── Feature Modules (Phases 2–10) ───────────────────────┐
            │ Autopilot · Scanner · Intelligence · Agency Portal · Marketplace ·           │
            │ AI Assistant · Developer API · Calendar · Growth/Referrals                   │
            └───────────────▲───────────────────────────────▲──────────────────▲──────────┘
                            │ generate / score              │ persist          │ bill
            ┌───────────────┴───────────────┐   ┌───────────┴─────────┐  ┌─────┴───────────┐
            │      ClauseEngine core         │   │  Data layer (RLS)   │  │ Stripe service  │
            │  (pure: stack → documents)     │   │  Supabase Postgres  │  │ (sub + metered) │
            └───────────────▲───────────────┘   └───────────▲─────────┘  └─────▲───────────┘
                            │                                │                  │
            ┌───────────────┴────────────────────────────────┴──────────────────┴──────────┐
            │  Shared services (@/services): logger · errors/Result · rate-limit ·          │
            │  api-response · stripe client · slack alerts · Sentry (instrumentation)       │
            └───────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Shared services layer (delivered in Phase 1)

| Module | Purpose |
|---|---|
| `services/logger.ts` | Structured logger; JSON in prod, pretty in dev; `logger.child({ module })` bindings; level via `LOG_LEVEL`. |
| `services/errors.ts` | `AppError` hierarchy (`ValidationError`, `Unauthorized`, `Forbidden`, `NotFound`, `RateLimit`, `ServiceUnavailable`, `Internal`) each with stable `code` + HTTP status; `serializeError` hides 5xx internals; `Result<T,E>` for non-throwing domain logic. |
| `services/rate-limit.ts` | `RateLimiter` interface + `InMemoryRateLimiter` (fixed window, injectable clock). Swap for Upstash/Durable Objects when multi-instance. |
| `services/api-response.ts` | Next glue: `errorResponse(err)`, `enforceRateLimit(result)`, `rateLimitHeaders(result)`. Kept separate so errors/rate-limit stay framework-agnostic (reusable in Edge Functions). |
| `services/stripe/client.ts` | Memoized `getStripe()` (was duplicated across 3 routes). One place for API version + future Connect config. |
| `services/slack.ts` | `SlackClient` / `sendRevenueAlert()` → Slack Incoming Webhook (`#revenue-alerts`). Env-gated on `SLACK_WEBHOOK_URL` (or `SLACK_REVENUE_WEBHOOK_URL`); never throws, so it is safe on the webhook hot path. Delivers on `charge.failed` + `invoice.payment_failed`. |
| `sentry.{server,edge}.config.ts` + `instrumentation*.ts` | Sentry error/perf monitoring, loaded via the Next instrumentation hook. Env-gated on `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (inert without them). `errorResponse()` reports every API 5xx; webhook + checkout capture explicitly. Source maps upload only when `SENTRY_AUTH_TOKEN` is set. |

Reference integration: `api/compliance` now rate-limits per client
(`30 req / 60s`), attaches `X-RateLimit-*` headers, and logs generations. The
Stripe webhook logs through the structured logger, captures handler exceptions
to Sentry, and fires Slack revenue alerts on `charge.failed` /
`invoice.payment_failed`.

**Observability env vars:** `SENTRY_DSN` (server/edge), `NEXT_PUBLIC_SENTRY_DSN`
(browser), optional `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` (source-map
upload on deploy), `SLACK_WEBHOOK_URL` or `SLACK_REVENUE_WEBHOOK_URL`,
`LOG_LEVEL`. All alerting is inert when the corresponding var is unset.

### 2.2 Data model direction

Current tables: `subscriptions`, `projects`. Planned additions (one migration
per phase, additive + RLS-first):

- **P2 Autopilot:** `regulations`, `regulation_versions`, `document_versions` (history of regenerated packages), `notifications`.
- **P3 Scanner:** `scans` (URL, detected tools + findings as jsonb, score, timestamp; RLS owner-scoped). ✅ implemented. Rendering is provided by a standalone headless-browser **scanner worker** (`/scanner-worker`, Playwright/Chromium) that executes page JS and captures outbound network requests, so JS-injected trackers (Meta Pixel, TikTok, GA, etc.) are detected. Configured via `SCANNER_WORKER_URL` + `SCANNER_WORKER_SECRET`; the app falls back to a static fetch when the worker is unset/unreachable.
- **P4 Intelligence:** `monitors` (schedule), `alerts`, reuse `scans`.
- **P5 Agency:** `organizations`, `org_members`, `clients`; add `org_id` to scoped tables; RLS keyed on org membership for white-label multi-tenancy.
- **P6 Marketplace:** `templates`, `template_purchases`, `creator_accounts` (Stripe Connect account id + payout status).
- **P7 Assistant:** `chat_threads`, `chat_messages`.
- **P8 API platform:** `api_keys` (hashed), `api_usage` (metered events → Stripe).
- **P9 Calendar:** `compliance_tasks` (due dates, renewals, scan schedules).
- **P10 Growth:** `referrals`, `referral_credits`, shareable-report tokens.

Principles: additive migrations only (no destructive changes to `subscriptions`/
`projects`); RLS on every new table before it ships; service-role writes for
webhooks/jobs only.

### 2.3 Background execution

Phases 2/4 need scheduled work (daily regulation diffs, weekly re-scans). Target:
**Supabase Edge Functions + `pg_cron`/Scheduled Functions** (keeps DB-adjacent
work near the data and off the Vercel request path). Framework-agnostic services
(`logger`, `errors`, `rate-limit`) are deliberately import-safe from Edge
Functions. Requires the Supabase access token / CLI login to deploy.

---

## 3. Roadmap → architecture mapping

| Phase | Feature | Primary new pieces | External deps / blockers |
|---|---|---|---|
| 1 | Foundation | `@/services` layer, this doc, RLS review | — (done) |
| 2 | Autopilot | Regulation diff engine, cron, version history, notifications, Pro gate | AI provider key; **legal review of auto-regeneration** |
| 3 | Scanner | Headless-render crawler (worker) + static-fetch fallback, tool/violation detection, scoring, `scans` | ✅ done — AI provider key (summary only); scanner worker deploy for JS-injected tracker detection |
| 4 | Intelligence | Weekly re-scan jobs, alerts, "Fix It", timeline | cron; AI provider |
| 5 | Agency Portal | `organizations`/multi-tenant RLS, white-label, custom domains, agency billing | Cloudflare API token (domain routing) |
| 6 | Marketplace | Creator accounts, template upload/preview, **Stripe Connect** payouts, search | Stripe Connect enablement |
| 7 | AI Assistant | Chat UI + streaming, clause explainer, URL audit tool, history | AI provider key |
| 8 | Developer API | API keys, rate limiting (reuse P1), doc/scan/score endpoints, **metered billing** | Stripe metered prices; live keys |
| 9 | Calendar | `compliance_tasks`, renewal/scan/alert aggregation, full-screen calendar UI | — |
| 10 | Pricing + Growth | Tier gating, referrals, badges, shareable reports | Stripe products; live keys |

## 4. Cross-cutting requirements

- **Backward compatibility:** additive only; existing routes keep their contracts (Phase 1 added rate-limit headers + 429s but no success-shape change).
- **Security:** RLS-first; secrets server-side only; API keys stored hashed; service-role confined to webhooks/jobs.
- **Scale (10k agencies / 100k users):** stateless routes; move rate-limit + job state to a shared store before horizontal scale-out; index every foreign key.
- **Testing:** every module ships Vitest coverage (services covered in `src/__tests__/services.test.ts`).
- **Observability:** all logs structured through `@/services` logger for log-drain ingestion.

## 5. Open decisions (need product/owner input)

1. AI provider (OpenAI vs Anthropic vs other) — gates P2/P3/P4/P7.
2. Whether the regulation diff engine may auto-publish regenerated legal docs, or only *propose* changes pending human/attorney review (recommended).
3. Prioritization: strict 2→10, or pull **Scanner (P3)** forward as the lead differentiator.
