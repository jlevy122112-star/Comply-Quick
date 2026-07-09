# Comply-Quick — Framework Alignment Audit

Audit of the current codebase against the target architecture doc. Legend: ✅ built · 🟡 partial · ❌ missing.

## 1. Data model (§5)
| Entity | Status | Notes |
|---|---|---|
| organizations | ❌ | No org tier above project. `agencies` is the closest analog. |
| users | ✅ | Supabase auth. |
| memberships | 🟡 | `agency_members` only. |
| workspaces | ❌ | No workspace layer. |
| projects | ✅ | `projects`. |
| project_domains | 🟡 | `agency_domains`; project stores a single URL. |
| scans | ✅ | `scans`. |
| findings | ❌ | Findings live inline in scan JSON — not first-class rows. |
| finding_events | ❌ | |
| tasks | ✅ | `compliance_tasks`. |
| task_comments | ❌ | |
| policy_packs / policy_versions | 🟡 | `document_versions` + `regulation_versions`; no "pack" grouping. |
| alerts / alert_impacts | 🟡 | `compliance_alerts`; no per-project impact rows. |
| approvals / approval_events | 🟡 | autopilot proposals + `legal_review_items`; no unified approval log. |
| evidence_records | ❌ | Audit&Evidence agent computes packs but nothing is persisted. |
| integrations | 🟡 | Stripe, Slack webhook, calendar feed. |
| usage_events | ✅ | `api_usage_events`, `tool_usage_events`. |
| billing_accounts | ✅ | `subscriptions`. |
| audit_logs | ❌ | No immutable audit trail. |

## 2. Feature modules (§3)
| Module | Status |
|---|---|
| 3.1 Portfolio Command Center | ✅ dashboard/home |
| 3.2 **Project Compliance Workspace (8 tabs)** | ❌ **biggest gap — no per-project operating surface** |
| 3.3 Scan & Monitoring Engine | ✅ scanner + scan_monitors + intelligence |
| 3.4 Compliance Rules Engine | ✅ ClauseEngine (deterministic) |
| 3.5 Document / Policy Engine | 🟡 tools + versions; no diff/regenerate-on-change UI |
| 3.6 **Findings & Remediation System** | ❌ **no findings entity w/ status/owner/due/links** |
| 3.7 Compliance Calendar | ✅ calendar |
| 3.8 Regulatory Intelligence Engine | ✅ intelligence + new monitor/autopilot agents |
| 3.9 Approval & Review Workflows | 🟡 legal-review + proposals; no unified queue/events |
| 3.10 Agency / White-Label | ✅ agency + portal |
| 3.11 API & Integrations | ✅ v1 API, keys, stripe, slack |
| 3.12 AI Agent Layer | 🟡 6 of 7 concepts; missing Onboarding, Success/Upsell, QA |

## 3. AI agents (§3.12) — target 7
Built: Compliance Copilot, Scan-to-Fix, Autopilot Remediation, Regulation Monitor, Portfolio Monitor, Audit & Evidence.
Missing vs the doc's named set: **Onboarding Agent**, **Success/Upsell Agent**, **QA Agent** (completeness check before release).

## 4. UI (§4)
UI kit present: Button, Card, Badge, Field, PageHeader, ProgressBar, UpsellCta, CopyButton.
Missing primitives: **Tabs, Table, SeverityPill, ScoreRing, ActivityFeed/Timeline, EmptyState, Skeleton, Drawer/Modal, DiffViewer**.
Missing surfaces: **Onboarding wizard**, **Project workspace**, unified **Alerts center**, **Approvals queue**.

## 5. Prioritized alignment plan (build order)
1. **UI primitives** — Tabs, Table, SeverityPill, ScoreRing, ActivityFeed, EmptyState, Skeleton (unblocks every screen; premium consistency).
2. **Findings model** — `findings` + `finding_events` tables (RLS), materialize scan findings, status/owner/due workflow, reopen-on-regression.
3. **Project Compliance Workspace** — `/dashboard/projects/[id]` with Overview/Scans/Findings/Tasks/Policies/Coverage/Activity/Approvals tabs, wired to existing data + agents. This delivers the "recurring operations platform" thesis.
4. **Complete the agent layer** — Onboarding, Success/Upsell, QA agents (pure logic + tests + registry).
5. **Evidence + audit trail** — persist evidence packs; `audit_logs` for approvals/versions/exports.
6. **Approvals queue** — unified surface over proposals + legal review + version publish gate.

Items 1, 3, 4 are highest-leverage for the product thesis and premium feel; starting there.
