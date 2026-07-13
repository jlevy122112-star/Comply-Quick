# Comply-Quick Compliance Requirements Matrix (Counsel Review Draft)

Purpose: map key legal/compliance obligations to document artifacts and implementation controls for external and internal readiness.

## Scope Notes

- This matrix is a legal-operations planning artifact.
- It supports counsel review; it does not replace legal advice.
- Final enforceability and adequacy require attorney sign-off.

## Requirement Coverage

| Requirement Area | Primary Sources/Frameworks | External Docs | Internal Docs/Controls | Status |
| --- | --- | --- | --- | --- |
| Consumer contract terms | FTC Act, state contract law, ROSCA-related principles | `/legal/terms`, `/legal/subscription`, `/legal/notices` | Change mgmt + legal review tracker | Implemented / Counsel review pending |
| Privacy transparency | US privacy norms, emerging state laws | `/legal/privacy`, `/legal/cookies`, `/legal/notices` | Data map, DSAR runbook, retention policy baseline | Implemented / Expand state-specific text |
| Data rights workflow | US state privacy + GDPR-style requests (where applicable) | `/legal/privacy` | DSAR request log template, identity verification process | Implemented / Operationalize in app |
| Data breach response | La. R.S. 51:3071 context + multi-jurisdiction obligations | `/legal/security`, `/legal/notices` | `INCIDENT_RESPONSE.md`, breach log, emergency revert runbook | Implemented / Counsel review pending |
| Subscription cancellation fairness | ROSCA + state ARL best practices | `/legal/subscription` | Cancellation flow tests + billing event logs | Implemented / Monitor enforcement updates |
| Email compliance | CAN-SPAM principles | `/legal/privacy`, `/legal/notices` | Suppression handling + event taxonomy | Partially implemented |
| Security posture representation | SOC2-style trust expectations | `/legal/security`, `/legal/sla`, `/legal/packet` | `INTERNAL_POLICY_BASELINE.md`, monitoring runbook | Implemented / Control evidence expansion needed |
| DPA / processor terms | GDPR Art. 28-style and enterprise buyer expectations | `/legal/dpa`, `/legal/subprocessors` | Vendor due diligence + contract controls | Implemented / Full contract pack pending |
| International transfer controls | SCC/transfer mechanism expectations for enterprise buyers | `/legal/dpa` | Transfer assessment process | Partial |
| Accessibility commitments | ADA/WCAG expectations | `/legal/accessibility` | Accessibility issue triage + remediation workflow | Implemented / Baseline |
| Acceptable use / platform abuse | Security + platform integrity | `/legal/acceptable-use` | Abuse response procedures | Implemented |
| SLA and support commitments | Commercial commitments | `/legal/sla` | `SLA.md`, `SUPPORT.md` | Implemented |

## Priority Gaps to Close Next

1. Full enterprise contract pack (executed DPA template set, SCC modules, security addendum).
2. State-by-state privacy rights operational SLA mapping.
3. Formal privacy/data classification policy docs split from baseline summary.
4. Counsel-approved jurisdiction language for Louisiana and multi-state operation.

## Evidence Tracking Location

- Notion HQ logs: `docs/notion-hq/OPERATIONS_LOG_TEMPLATES.md`
- Internal policy baseline: `docs/operations/INTERNAL_POLICY_BASELINE.md`
- Emergency rollback and resilience: `docs/operations/EMERGENCY_REVERT_PLAN.md`

_Last reviewed: 2026-07-12._
