# Comply-Quick — Enterprise Multi-Tenant Governance Hub: Gap Analysis & Phased Plan

Status: **proposal / living document.** Owner decisions required (see §5).
Scope: turn Comply-Quick into an enterprise-grade, multi-tenant governance hub with
two premium tiers (Agency, Enterprise) covering the five modules requested:
architecture & tenant isolation, tier features, automation & AI, monetization &
billing, and performance/quality/deployment.

This document extends the existing roadmap in
[`COMPLIANCE_OS.md`](./COMPLIANCE_OS.md) and [`BUILD_PLAN.md`](../BUILD_PLAN.md);
it does not replace them. Where a capability already exists, we build on it rather
than rewrite it.

---

## 0. How to read this

- **Status legend:** ✅ Exists · 🟡 Partial · 🆕 Missing.
- Every claim is backed by a file/table pointer so it can be verified.
- Each phase lists: goal, scope, key touch points, **external dependencies /
  blockers** (things that need credentials or infra I cannot self-provision), and
  acceptance criteria.
- Phases are ordered by dependency: tenancy foundation first, then the features
  that ride on it. Nothing later is safe until the tenancy model in Phase 1 lands.

---

## 1. Current-state gap analysis

The platform is a **pooled Supabase/Postgres app with broad RLS**, built in 10
documented phases. The single most important architectural fact for this request:

> **Core data is USER-scoped, not ORG-scoped.** `projects` (and most core tables)
> enforce RLS with `auth.uid() = user_id` (`supabase/migrations/0001_init.sql`).
> The organization/workspace/agency layers (`0005_agency.sql`,
> `0029_organizations_rbac_sso.sql`) are **additive tags** — `projects.organization_id`
> is nullable and project writes remain user-owned. So there is strict *per-user*
> isolation everywhere, but not a uniform *organization-tenant* model.

### Module 1 — Architecture & Tenant Isolation

| Capability | Status | Evidence & note |
|---|---|---|
| Pooled DB + strict RLS | 🟡 | RLS enabled across most tables, but tenancy boundary is the user, not the org. `0001_init.sql`, `0029_organizations_rbac_sso.sql` (`is_org_member`, `org_role`, `is_org_admin`, `is_workspace_member`). |
| Core `projects` org isolation | 🟡 | `projects.organization_id`/`workspace_id` nullable; only an additive org-member SELECT policy added in `0029`; CRUD still `auth.uid()`-scoped. |
| Per-tenant / cryptographically separated schemas | 🆕 | All app data in shared `public` schema (connector tables in shared `connector` schema). No per-tenant schema or crypto partition. **Note: not recommended for this stack — see §3.1.** |
| Per-tenant compute throttling / query queuing | 🟡 | In-process fixed-window limiter only: `src/services/rate-limit.ts` (`InMemoryRateLimiter`), `src/lib/api/auth.ts` (`createRateLimiter`, `enforceRateLimit`), scanner quota in `src/app/api/scanner/scan/route.ts`. No distributed limiter, durable queue, or per-tenant governor. |
| Custom domains + host routing | 🟡 | `agency_domains` (`0005`/`0006`), `src/lib/agency/domain-provider.ts` (Vercel/Cloudflare provision/check/remove), host rewrite in `src/proxy.ts` → `/portal/domain/<host>`. Real and working. |
| Automated SSL/TLS | 🟡 | Delegated to Vercel/Cloudflare via the domain provider; no app-owned cert lifecycle (acceptable — the platform host issues certs). |
| White-label branding | 🟡 | `agencies.logo_url`, `primary_color`, `support_email` (`0005`), brand-logo bucket (`0039`), `PortalLanding.tsx`, `BrandLogoPanel`. One color + logo + name. No theme-token system, multi-palette, or per-tenant email templates. |
| Per-tenant SMTP / email config | 🆕 | Shared email utils only: `src/lib/email/{send,templates}.ts`. No tenant SMTP columns/records. |

### Module 2 — Tier features

| Capability | Status | Evidence & note |
|---|---|---|
| Agency client provisioning + delete | ✅ | `src/app/dashboard/agency/clients`, `/api/agency/clients`, `src/lib/agency/service.ts` (`getOrCreateAgency`, `canUseAgencyPortal`, client CRUD), tables `agencies`/`agency_members`/`agency_clients`. Overlay on user data, not isolated sub-accounts. |
| Client cap (request says 50) | 🆕 | Seats enforced via `TIER_CONFIG` (Agency 5 seats), but no explicit 50-client provisioning limit. |
| Client onboarding/intake | 🟡 | `dashboard/agency/clients/[clientId]/intake`, `0038_agency_client_onboarding.sql`, `src/lib/agency/onboarding.ts`. |
| Cross-tenant aggregated analytics | 🟡 | `src/lib/agency/service.ts` aggregates monitors/projects/lowest-score per `client_id`. No portfolio KPI/trend/risk-rollup dashboard with export. |
| Shared templates / playbooks → clients | 🟡 | Marketplace templates exist (`0007_marketplace.sql`, `dashboard/marketplace`). No agency-owned playbook library with versioned deploy/inheritance to clients. |
| RBAC roles (Agency Admin / Account Manager / Client Viewer) | 🟡 | Generic roles only: `src/lib/rbac/roles.ts` (`owner/admin/manager/member/viewer`), `permissions.ts`, `org_role` in `0029`. No agency-specific role hierarchy. |
| Enterprise nested hierarchy (sub-orgs/regions/departments) | 🟡 | `organizations → workspaces → projects` exists; no arbitrary nested org tree / regions / departments / delegated admin. |
| Enterprise SSO/SCIM | ✅ | `sso_connections` (`0029`), `scim_tokens`/`scim_users` (`0037`), `/api/scim/v2`, `src/lib/{sso-db,scim}`. |
| Autonomous monitoring workers | 🟡 | Cron entry points exist: `supabase/functions/autopilot-daily`, `intelligence-weekly`; `/api/{agents/monitor,autopilot/run,intelligence/run}`; `src/lib/{autopilot,intelligence,agents}`. **Plus a real standalone container:** `scanner-worker/` (Playwright/Chromium, Dockerfile, `fly.toml` with `auto_start/auto_stop_machines`, `/health`+`/scan`, SSRF guard, bearer auth). No durable queue / retry / DLQ / job state machine / per-tenant worker fleet. |
| Enterprise AI compliance agent / LLM orchestrator | 🟡 | `src/lib/assistant/service.ts`, `/api/assistant/chat`, `src/services/ai/openai.ts`, `src/lib/agents/*` (`autopilot-remediation`, `audit-evidence`, `compliance-copilot`). Grounded/proposal-oriented; not a full policy-ingest→control-map→evidence→governed-execution orchestrator. |
| SIEM export (Splunk / Datadog / S3) | 🆕 | Audit trail exists (`0023_audit_logs.sql`, `src/lib/audit-log.ts`) and structured logs (`src/services/logger.ts`), but no Splunk/Datadog/S3 exporter or streaming sink. |
| Dedicated compute / microservices routing | 🟡 | `scanner-worker/` is a genuine out-of-process, auto-scaling microservice — so the pattern exists for one workload. No per-enterprise dedicated compute pool or tenant service routing. |

### Module 3 — Automation & AI core

| Capability | Status | Evidence & note |
|---|---|---|
| Self-healing drift detection | 🟡 | `src/lib/connector/*`, `0031_connector.sql` (`connector_connections/events/remediations/audit_ledger`), `src/lib/intelligence/{pipeline,risk}.ts`, `src/lib/scanner`. Connector/platform-specific, not universal. |
| Auto-remediation | 🟡 | Remediation statuses `proposed/applied/failed/reverted`, connector mode `propose_only`/`auto` (`0031`), `src/lib/agents/autopilot-remediation.ts`. Owner decision C-Legal: **propose-only with one-click apply** (BUILD_PLAN §3). Proposal-first by design. |
| Generative policy builder (SOC2/ISO27001/GDPR) | 🟡 | `src/components/ClauseEngine.tsx`, `EnterpriseModules.tsx`, `src/lib/compliance/{catalog,graph,report}.ts`, `/api/compliance`. Generates packages; not a versioned control-catalog policy authoring system. |
| Predictive ML risk scoring | 🆕 | Scores are deterministic/rule-based (`src/lib/intelligence/risk.ts`, scanner scoring). No model/feature pipeline/forecasting. **Note: needs a data foundation first — see §3.3.** |
| Interactive conversational AI auditor | 🟡 | `dashboard/assistant`, `/api/assistant/chat`, `src/lib/assistant/service.ts`. Grounded chat with deterministic fallback; not a tenant-wide evidence-querying auditor. |

### Module 4 — Monetization & billing

| Capability | Status | Evidence & note |
|---|---|---|
| Stripe subscriptions + checkout + portal | ✅ | `/api/checkout`, `/api/webhooks/stripe`, `/api/billing-portal`, `src/lib/entitlements.ts`, subscriptions in `0001`. |
| Metered API usage | ✅ | `METERED_PRICE_CENTS` (`pricing.ts`), `0010_metered_api.sql` (`api_keys`,`api_usage_events`,`api_usage_meters`), `src/lib/api/{usage,stripe-metered}.ts`, `/api/billing/report-usage`, `/api/v1/usage`. |
| Seat-based billing | 🟡 | Seat limits enforced (`src/lib/agency/service.ts`, `TIER_CONFIG`); no Stripe quantity sync / seat reconciliation. |
| Scan overage billing | ✅ | `0009_agency_billing.sql` (`billing_overages`), `src/lib/billing/usage.ts` (`computeOverage`). |
| Enterprise invoicing / PO / manual overrides | 🆕 | No invoice model, PO fields, contract pricing, or manual billing override. |
| Feature flagging | 🟡 | Env-based only: `src/lib/optimizations/flags.ts`, pricing experiments `src/lib/experiments/pricing.ts`. No tenant/user-targeted flag service with persistence/audit. |
| Real-time usage gates | ✅ | `entitlements.ts`, `pricing.ts` (`scanLimit`,`isUnlimited`), `src/lib/scanner/service.ts` (`QuotaExceededError`), `src/lib/api/auth.ts`. Enforced but not centralized at org level. |

### Module 5 — Performance, quality, deployment

| Capability | Status | Evidence & note |
|---|---|---|
| Numbered migration convention | ✅ | `0001…0040` sequential, snake-case, largely additive/idempotent (`if not exists`, `drop policy if exists`). |
| Strict zero-downtime discipline | 🟡 | Mostly additive, but no consistent `CREATE INDEX CONCURRENTLY`, expand/contract phasing, or staged backfills; some destructive changes (`0032_remove_slack_integration.sql`). |
| Unit/component tests | ✅ | Vitest 4 (`vitest.config.ts`), `npm test`, `test:coverage`. |
| Coverage config | 🟡 | V8 coverage configured; **no minimum threshold** set. |
| E2E | ✅ | Playwright (`playwright.config.ts`), `e2e/*.spec.ts`. |
| Multi-tenant data-leak tests | 🆕 | `agency.test.ts`/`rbac.test.ts`/`access-policy.test.ts`/`security.test.ts` cover authz logic, but no cross-tenant leak suite or live-DB RLS integration harness. |
| Observability (Sentry) | ✅ | `src/instrumentation*.ts`, `sentry.{server,edge}.config`, `global-error.tsx`, OpenAI auto-instrumentation. |
| OpenTelemetry | 🆕 | No `@opentelemetry/*` / OTLP exporter / tracer provider. Sentry is the telemetry layer. |

---

## 2. Highest-leverage gaps (what actually blocks "enterprise multi-tenant")

1. **Tenancy is user-scoped, not org-scoped.** This is the foundation; everything
   enterprise-grade (nested orgs, cross-tenant analytics, per-tenant isolation
   guarantees, leak tests) depends on fixing it first.
2. **No automated proof of isolation.** RLS exists but there is no cross-tenant
   leak test suite against a live DB.
3. **No durable background-job platform.** "Autonomous, self-healing, continuous"
   needs queue/retry/DLQ/state, not just cron entry points.
4. **No enterprise billing ops, SIEM export, tenant-scoped feature flags, or
   OTel** — each a discrete, mostly-additive workstream.
5. **Predictive ML is premature** until the org-scoped event/outcome data exists.

---

## 3. Cross-cutting architecture decisions (need owner sign-off)

> **DECISION (owner, confirmed):** Enterprise data isolation = **Option A — field-level
> envelope encryption in the pooled DB** (per-tenant DEK wrapped by a KEK via AWS
> KMS / secret vault), on top of strict org-scoped RLS. Physical isolation (Option
> B) is future-proofed via a `tenant_id → dedicated connection string` env override,
> but not built now. **Premium, enterprise-grade UI/UX is a standing requirement on
> every user-facing surface produced by this plan (see §3.5).**

### 3.1 Tenancy model: **org-scoped RLS in the pooled schema** (confirmed)
Adopt organization-as-tenant using the existing `organizations`/`workspaces` tables
and `org_role()` helpers. Migrate core tables (`projects`, `scans`, `findings`,
`evidence_records`, `alert_impacts`, `compliance_tasks`, `integrations`,
`audit_logs`) to carry a non-null `organization_id` and add org-scoped RLS
alongside (then replacing) the user-scoped policies, via an **expand→backfill→contract**
migration sequence so nothing breaks mid-deploy.

**Enterprise field-level envelope encryption (Option A, confirmed).** Sensitive
columns/blobs for Enterprise tenants are encrypted **application-side** (AES-256-GCM)
before they reach Postgres, so the DB only ever stores ciphertext and never sees the
DEK — a stronger guarantee than `pgcrypto` (which would put keys/plaintext in SQL).
Design:
- **`tenant_encryption_keys`** table (keyed by `organization_id`) stores the
  *wrapped* DEK + key metadata; plaintext DEKs are never persisted.
- A pluggable **`KeyProvider`** interface wraps/unwraps the DEK with a KEK. Ship a
  local env-KEK provider first; an **AWS KMS** provider slots in behind the same
  interface once creds exist (no code churn).
- An encrypted-field helper in the Supabase client wrapper transparently
  encrypts on write / decrypts on read for designated columns.
- A tenant→connection resolver checks an **env-var override** first (Option B
  hook) before falling back to the pooled Supavisor connection.

> Schema-per-tenant was rejected (defeats pooling, multiplies migration cost, not
> supported by Supabase RLS tooling). Option A meets the cryptographic-guarantee
> requirement while keeping pooling.

### 3.5 Premium UI/UX (cross-cutting, standing requirement)
Every user-facing surface this plan adds or touches must be enterprise-grade: built
on the existing `src/components/ui` design system + Tailwind tokens, fully
responsive, accessible (WCAG 2.2 AA — keyboard, focus, contrast, ARIA), with
polished loading/empty/error states, optimistic feedback, and consistent
typography/spacing. This applies to admin/back-office surfaces too (encryption &
key status, hierarchy management, billing ops), not just customer-facing pages.

### 3.2 Background jobs
Introduce a durable job table + worker (reusing the `scanner-worker` deployment
pattern: containerized service on Fly.io/Render) with retries, idempotency keys,
and a dead-letter status. Keep Supabase Edge Functions/`pg_cron` as the scheduler
that enqueues, not as the executor.

### 3.3 Predictive ML
Deferred until org-scoped event history exists. Start by **logging the features**
(via the existing analytics/attribution surfaces) so a model has data later; do not
build inference before there is labeled outcome data.

### 3.4 Auto-remediation stays propose-first
Honor the existing owner decision (BUILD_PLAN §3 C-Legal): propose-only with
one-click apply; no silent auto-publish of legal text. "Self-healing" = auto-detect
+ auto-propose + governed apply, not unattended mutation.

---

## 4. Phased implementation plan

Each phase = one or more PRs, additive migrations, tests, and a docs update. **Bold
dependencies** are external things I cannot self-provision.

### Phase A — Tenancy foundation (org-scoped data model) 🟡→✅
- **Goal:** organization is the tenant; all core data is org-owned with org-scoped RLS.
- **Scope:** expand/backfill/contract migrations adding non-null `organization_id`
  to core tables; org-scoped RLS policies (select/insert/update/delete via
  `org_role()`); backfill each existing user's rows into a personal default org;
  update data-access libs (`projects-db`, scans, findings, evidence, tasks, etc.)
  to require org context; add an org-context resolver in the server layer.
- **Acceptance:** existing per-user behavior preserved (each user still sees their
  data via their default org); new orgs isolate fully; typecheck + full test suite
  green.
- **Dependencies:** requires re-running/verifying migrations on the Supabase
  project (the workspace-insert RLS drift found earlier must be resolved first).

### Phase B — Isolation proof: cross-tenant leak test harness 🆕→✅
- **Goal:** automated evidence that tenant A can never read/write tenant B.
- **Scope:** a live-DB integration suite (seed two orgs + users, assert every core
  table blocks cross-org access under RLS); wire into CI; add a coverage threshold.
- **Dependencies:** a **CI Supabase test project or local Supabase stack** in CI.

### Phase C — Enterprise hierarchy + agency RBAC roles 🟡→✅
- **Goal:** nested sub-orgs/regions/departments; named roles (Agency Admin,
  Account Manager, Client Viewer) mapped onto the RBAC layer.
- **Scope:** self-referential `parent_organization_id`; hierarchy-aware
  `org_role()`/membership resolution and permission checks; role labels/permission
  sets in `src/lib/rbac`; UI for hierarchy management; enforce the requested
  **50-client Agency cap** in `agency/service.ts`.
- **Dependencies:** none (pure app + DB).

### Phase D — Durable background-job platform + autonomous monitoring 🟡→✅
- **Goal:** continuous, self-healing monitoring on real infra.
- **Scope:** job table (queued/running/succeeded/failed/dead-letter, retries,
  idempotency); a worker service (scanner-worker pattern); migrate autopilot /
  intelligence / re-scan to enqueue+execute; per-tenant job quotas; job
  observability.
- **Dependencies:** a **container host for the worker (Fly.io/Render/Railway)** and
  its secrets; **valid AI provider key** for the AI-driven jobs.

### Phase E — Enterprise billing ops 🆕→✅
- **Goal:** invoicing, POs, manual overrides, seat sync.
- **Scope:** invoice/PO/billing-override models; admin billing workflows; Stripe
  seat-quantity sync; contract-pricing override on entitlements.
- **Dependencies:** **live `STRIPE_SECRET_KEY` + Stripe products/prices**;
  owner-defined invoicing/PO process.

### Phase F — Tenant-scoped feature flags + usage gates centralization 🟡→✅
- **Goal:** instant lock/unlock per tenant on upgrade; one entitlement service.
- **Scope:** flag table with tenant/user targeting + audit history; migrate
  env-flag call sites; centralize all quota/seat/access checks into one org-aware
  entitlement service.
- **Dependencies:** none.

### Phase G — SIEM export + audit streaming 🆕→✅
- **Goal:** export audit logs to Splunk / Datadog / S3.
- **Scope:** pluggable export sinks; signed/batched delivery; per-tenant config;
  replay/backfill.
- **Dependencies:** **destination credentials** (Splunk HEC token, Datadog API
  key, AWS S3 bucket + IAM) — supplied per enterprise tenant.

### Phase H — AI compliance agent + generative policy builder 🟡→✅
- **Goal:** policy-ingest → control-map → evidence → governed-apply; auditor chat
  over tenant-wide evidence.
- **Scope:** ingestion + retrieval over org-scoped data; control catalog
  (SOC2/ISO27001/GDPR) with versioning + approvals; citations/provenance; human
  approval checkpoints; extend `assistant`/`agents`.
- **Dependencies:** **valid AI provider key**; owner sign-off on autonomy limits
  (stays propose-first per C-Legal).

### Phase I — White-label engine + per-tenant SMTP 🟡→✅
- **Goal:** full theming + tenant email identity.
- **Scope:** theme-token system (palette, logo, typography) beyond one color;
  per-tenant SMTP/email-provider config + templates.
- **Dependencies:** **email provider** decision (per-tenant SMTP creds or a
  provider like Resend/SES with per-tenant domains).

### Phase J — Observability: OpenTelemetry + zero-downtime migration standard 🆕→✅
- **Goal:** distributed tracing across app + workers + AI pipelines; codified
  migration discipline.
- **Scope:** OTel SDK + OTLP exporter with tenant/job span attributes (kept
  alongside Sentry); a documented expand/contract + `CREATE INDEX CONCURRENTLY`
  migration standard; retrofit as practical.
- **Dependencies:** an **OTLP-compatible backend** (Grafana Tempo / Honeycomb /
  Datadog APM).

### Phase K — Predictive ML risk scoring 🆕→(later)
- **Goal:** forecast upcoming compliance vulnerabilities.
- **Scope:** feature logging first; model + inference service only after org-scoped
  outcome data accrues; model governance + drift monitoring.
- **Dependencies:** accrued data (time); an **ML hosting/inference** decision.

---

## 5. Owner decisions required before build

1. **Hard schema isolation vs org-scoped RLS** (§3.1). Recommended: org-scoped RLS.
2. **Which phase(s) to prioritize** — recommended order A → B → C first (the
   foundation), since D–K depend on it.
3. **Credentials/infra** to unblock dependent phases: live Stripe key + prices;
   valid AI provider key; a worker container host; a CI Supabase test project;
   SIEM destinations; an OTLP backend; an email provider.
4. **Enterprise process definitions**: invoicing/PO workflow; per-tenant SIEM/SMTP
   configs; autonomy limits for remediation (default: propose-first).
5. **Scope confirmation**: the "50 client" cap, the named agency roles, and the
   nested-hierarchy depth.

---

## 6. What I can start autonomously vs. what's blocked

- **Autonomous now:** Phase A (tenancy foundation), Phase C (hierarchy + roles +
  50-client cap), Phase F (feature flags + gate centralization). These are pure
  app + DB work needing no new external credentials.
- **Needs a test DB in CI:** Phase B.
- **Needs external credentials/infra:** Phase D (worker host + AI key), Phase E
  (Stripe), Phase G (SIEM), Phase H (AI key), Phase I (email), Phase J (OTLP),
  Phase K (data + ML host).

Recommended first PR: **Phase A**, because it is the prerequisite for a genuine
"multi-tenant governance hub" and unblocks B and C immediately.

---

## 7. Enterprise Agency Pre-Launch Requirements (added 2026-07-21)

> **Premium UI/UX standing requirement:** every user-facing engineering deliverable
> below must follow the §3.5 standard — built on `src/components/ui` + Tailwind
> tokens, fully responsive, WCAG 2.2 AA, with polished loading/empty/error states,
> optimistic feedback, and consistent typography/spacing.

These are the remaining features / go-live gates targeted at enterprise agency
clients. Items marked **operational** are business/legal/process work; everything
else is engineering scope.

### 7.1 Security & Engineering

- **Problem Validation** — documented evidence of target-user pain (operational).
- **Competitor Matrix** — UVP analysis vs alternatives (operational).
- **Incorporation Papers** — business registration (operational).
- **Founders' Agreement** — equity, vesting, IP assignment (operational).
- **Core Legal Policies** — marketing-site ToS & Privacy Policy (operational / legal).

### 7.2 Product & Infrastructure

- **Functional MVP** — stripped-down core problem solve; largely in place, needs the
  remaining Phase A–C polish below before enterprise launch.
- **Cloud Architecture** — secure/scalable hosting (operational; current Vercel +
  Supabase stack is the target).
- **CI/CD Pipeline** — automated deploy workflows (operational; GitHub Actions
  baseline exists).
- **Data Security & Encryption** — end-to-end encryption at rest/transit.
  - *Engineering:* Phase A Option-A field-level envelope encryption plus TLS.
- **System Monitoring** — inverted error-tracking + performance tooling.
  - *Engineering:* Sentry is wired; OpenTelemetry (Phase J) and live-DB RLS leak
    tests (Phase B) remain.

### 7.3 Go-To-Market & Revenue System

- **Pricing Strategy** — defined tiers (operational; `TIER_CONFIG` in
  `src/lib/pricing.ts` already encodes free/solo/agency/enterprise).
- **Billing Engine** — recurring payments + tax compliance.
  - *Engineering:* Stripe checkout/webhook/metered usage exists; invoicing/ACH/PO
    overrides (Phase E) remain.
- **High-Converting Landing Page** — marketing site with social proof + CTA
  (operational / content).
- **Product Analytics** — Mixpanel/PostHog-style behavior tracking (operational).
- **Lead Generation Channels** — SEO, outbound, ads (operational).

### 7.4 Operations & Customer Support

- **Corporate Bank Account** — linked to billing engine (operational).
- **Help Desk & Knowledge Base** — ticketing + self-service articles (operational).
- **Internal Communication** — team collaboration hubs (operational).
- **Feedback Loop** — user-request capture → roadmap (operational).

### 7.5 Tailored Bootstrapping Checklist

#### Legal & Regulatory Foundation

- **Liability-Limiting Terms of Service** — clarify generated clauses do not replace
  legal counsel (operational / legal).
- **Automated Data Processing Agreement (DPA)** — enterprise client data-handling
  agreement (operational / legal; DPA tool page exists in `app/legal/dpa`).
- **Single-Founder Incorporation** — LLC/C-Corp registration (operational).

#### Lean Infrastructure & Trust Elements

- **SOC 2 Type 1 Readiness** — logging, MFA, DB encryption for vendor reviews.
  - *Engineering:* logging, RLS, encryption design present; formal readiness docs
    and MFA hardening remain operational.
- **Open-Source or Lean Compliance Tech Stack** — structured data + reliable legal
  APIs over expensive LLM tokens (operational / architecture; already favored in
  `src/lib/compliance` and `ClauseEngine`).
- **Privacy-First Architecture** — monitor without scraping/storing end-user PII.
  - *Engineering:* scanner already avoids PII storage; explicit PII scrubbing
    policy remains to be documented/enforced.

#### Enterprise-Ready Revenue Architecture

- **B2B Billing Infrastructure** — Stripe/Paddle for self-serve + invoicing/ACH.
  - *Engineering:* Stripe card subscriptions + metered usage exist; invoicing/ACH
    (Phase E) remains.
- **Tiered Permission Matrix** — RBAC for agency owners managing client profiles.
  - *Engineering:* `src/lib/agency/roles.ts`, agency portal, hierarchy, and
    `OrganizationSwitcher` cover the core; named role assignment UI and
    cross-hierarchy permissions still need finishing.

#### Zero-Dollar Go-To-Market Strategy

- **Cold Vulnerability Audits** — manual/semi-automated checks emailed to agencies
  (operational / GTM).
- **Programmatic SEO Content** — keyword-targeted landing pages (operational /
  content).
- **Niche Communities** — free compliance advice in agency spaces (operational).

### 7.6 In-App Quality & Agency UX Scenarios

These are explicit product-quality gates for the agency dashboard. Each must be
implemented with the §3.5 premium UI/UX standard.

- **Workspace Swapping** — `OrganizationSwitcher` instantly refreshes all data,
  metrics, and generated clauses without leaking cross-tenant cache.
  - *Status:* component exists; full cache-invalidation story across all data libs
    needs verification.
- **Granular Team Permissions** — agency owner invites junior designer / client
  viewer with read-only or clause-export-only access.
  - *Status:* RBAC roles exist; UI for inviting with agency-specific roles and
    capability-based gating remains.
- **The "Out-of-Sync" State** — dashboard updates when a background scan detects
  a violation while the user is viewing the screen.
  - *Engineering:* real-time update stream / polling + optimistic UI; not yet
    built.
- **Notification Routing** — regulation alerts and monitoring failures show
  dashboard callout banners with email fallback.
  - *Engineering:* notification dispatch exists; dashboard callout integration and
    per-tenant routing preferences remain.
- **White Labeling & Exports** — exported compliance documents (PDF/TXT/web link)
  carry agency or client branding.
  - *Engineering:* `WhiteLabelPanel`, `theme.ts` tokens, and brand-logo storage
    exist; per-tenant email templates and export branding wiring remain.
- **Inline Clause Editing** — text editor lets users override autonomously
  recommended clauses without crashing background monitoring sync.
  - *Engineering:* `ClauseEngine` editing exists; sync robustness and conflict
    resolution need hardening.
- **Dynamic Limit Tracking** — usage counters ("3 of 5 client websites monitored")
  and UI lockdown on tier exceedance.
  - *Engineering:* `TIER_CONFIG`/`managedClientLimit` enforce limits; dashboard
    limit widgets and paywall gating remain.
- **Smooth Upgrade Prompts** — clicking a gated feature opens a modal/redirect to
  Stripe/Paddle checkout; payment success unlocks feature without logout.
  - *Engineering:* upgrade CTAs exist; end-to-end post-payment unlock without
    re-auth needs verification.

### 7.7 "Implement These For Sure" Engineering Features

High-confidence, high-impact engineering deliverables for enterprise agencies.
All must follow §3.5 premium UI/UX.

1. **Headless JavaScript Snippet (The Pixel Method)**
   - Serve a lightweight, minified JS bundle from a Next.js API route
     (`/api/compliance-agent.js` or edge CDN).
   - Telemetry is sent back to a Supabase Edge Function using a client-specific
     API key.
   - *New work:* pixel bundle, ingestion endpoint, client-key auth, RLS-isolated
     telemetry table.

2. **CMS Plugins & Native Integrations**
   - Start with a Webflow App and/or WordPress plugin.
   - Supabase Database Webhooks notify the Next.js app when an agency connects a
     new native platform instance.
   - *New work:* plugin packages, webhook handler, platform connection registry,
     UI for connect/manage.

3. **CI/CD & Source Code Access (GitHub Integration)**
   - GitHub Action or Next.js OAuth flow requesting read-only repo access.
   - Repo code parsed asynchronously via background workers (`src/lib/jobs`).
   - *New work:* GitHub OAuth app, repo access grant, parser job, results mapped
     to compliance findings.

4. **Direct Document Upload (File Attachment)**
   - Supabase Storage with strict RLS policies isolated by agency workspace.
   - Drag-and-drop upload in the Next.js frontend (`@uppy/react` or native).
   - Stream files directly to a private Supabase bucket via the client SDK.
   - *New work:* storage bucket + RLS, upload UI, document-to-evidence pipeline.

---
