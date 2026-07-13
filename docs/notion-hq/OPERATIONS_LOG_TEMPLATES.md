# Notion HQ Operations Log Templates (Comply-Quick)

Use these templates as databases in Notion HQ for live operations after launch.

## 1) Daily Founder Log

| Property | Type |
|---|---|
| Entry | Title |
| Date | Date |
| Top 3 Priorities | Text |
| Key Decisions | Text |
| Blockers | Text |
| Wins | Text |
| Next Actions | Text |

## 2) Weekly KPI Review Log

| Property | Type |
|---|---|
| Week Of | Title |
| MRR | Number |
| Net New MRR | Number |
| Churn % | Number |
| Activation % | Number |
| Trial→Paid % | Number |
| CAC | Number |
| Runway Months | Number |
| Notes | Text |

## 3) Incident & Postmortem Log

| Property | Type |
|---|---|
| Incident ID | Title |
| Severity | Select (SEV-1/2/3) |
| Start | Date |
| End | Date |
| Duration (min) | Formula |
| Affected Surface | Text |
| Root Cause | Text |
| Corrective Actions | Text |
| Postmortem Owner | Person |

## 4) Breach Event Log

| Property | Type |
|---|---|
| Event ID | Title |
| Discovery Date | Date |
| Data Types | Multi-select |
| Residents Affected | Number |
| Notification Required | Checkbox |
| Customer Notice Date | Date |
| Regulator Notice Date | Date |
| Legal Owner | Person |
| Status | Select (Investigating/Notified/Closed) |

## 5) DSAR Request Log

| Property | Type |
|---|---|
| Request ID | Title |
| Request Type | Select (Access/Delete/Correction/Portability/Opt-Out) |
| Intake Date | Date |
| Jurisdiction | Select |
| Due Date | Date |
| Identity Verified | Checkbox |
| Completion Date | Date |
| Status | Select (Open/Pending/Completed/Denied) |
| Notes | Text |

## 6) Subprocessor Change Log

| Property | Type |
|---|---|
| Change ID | Title |
| Vendor | Text |
| Change Type | Select (Add/Update/Remove) |
| Data Categories | Multi-select |
| Effective Date | Date |
| Customer Notice Sent | Checkbox |
| Legal Review | Select (Pending/Approved/Blocked) |

## 7) Vendor Risk Review Log

| Property | Type |
|---|---|
| Review ID | Title |
| Vendor | Text |
| Risk Tier | Select (Low/Medium/High) |
| Last Review | Date |
| Next Review | Date |
| DPA On File | Checkbox |
| Security Evidence | URL |
| Owner | Person |

## 8) Compliance Evidence Register

| Property | Type |
|---|---|
| Evidence ID | Title |
| Control Domain | Select (Access/Change/Incident/Vendor/BCDR/Training) |
| Evidence Link | URL |
| Evidence Date | Date |
| Period Covered | Text |
| Collected By | Person |
| Audit Ready | Checkbox |

## 9) Release & Rollback Log

| Property | Type |
|---|---|
| Release ID | Title |
| Deploy Date | Date |
| Scope | Text |
| Approver | Person |
| Rollback Plan Link | URL |
| Rollback Tested | Checkbox |
| Outcome | Select (Success/Partial/Rolled Back) |

## 10) Emergency Revert Runbook Execution Log

| Property | Type |
|---|---|
| Incident/Release ID | Title |
| Trigger Time | Date |
| Trigger Condition | Select (Outage/Error Spike/Auth Failure/Billing Failure/Data Risk/Other) |
| Last Known Good Deploy | Text |
| Revert Type | Select (Code/Config/Forward Migration) |
| Revert Start | Date |
| Revert Complete | Date |
| User Impact Summary | Text |
| Commander | Person |
| Status | Select (Active/Recovered/Postmortem Required/Closed) |

## 11) Strategic Initiative Tracker

| Property | Type |
|---|---|
| Initiative | Title |
| Pillar | Select (Activation/Integrations/Trust/Retention/Enterprise) |
| Owner | Person |
| Start Date | Date |
| Target Date | Date |
| KPI Target | Text |
| Current Status | Select (Planned/In Progress/Blocked/Live) |
| Notes | Text |

## 12) Support SLA Tracking Log

| Property | Type |
|---|---|
| Ticket ID | Title |
| Tier | Select (Single/Agency/Enterprise) |
| Priority | Select (P1/P2/P3/P4) |
| Received At | Date |
| First Response At | Date |
| SLA Due | Date |
| SLA Breached | Formula |
| Status | Select |

## 13) Billing/Dunning Recovery Log

| Property | Type |
|---|---|
| Attempt ID | Title |
| Customer | Text |
| Event Date | Date |
| Failure Reason | Text |
| Retry Count | Number |
| Recovered | Checkbox |
| Recovery Date | Date |
| Notes | Text |

## 14) Legal Review Tracker

| Property | Type |
|---|---|
| Document | Title |
| Version | Text |
| Counsel Status | Select (Pending/Approved/Denied/Conditional) |
| Review Date | Date |
| Denial Reason | Text |
| Required Edits | Text |
| Final Sign-Off Date | Date |

## 15) Regulatory Watch Log

| Property | Type |
|---|---|
| Update ID | Title |
| Jurisdiction | Text |
| Regulation | Text |
| Effective Date | Date |
| Impact Area | Multi-select |
| Required Action | Text |
| Owner | Person |
| Status | Select (Open/In Progress/Done) |

## 16) Audit Readiness Log

| Property | Type |
|---|---|
| Test ID | Title |
| Control | Text |
| Test Date | Date |
| Result | Select (Pass/Fail/Partial) |
| Findings | Text |
| Remediation Owner | Person |
| Target Close Date | Date |

## 17) Launch Go/No-Go Log

| Property | Type |
|---|---|
| Launch Gate | Title |
| Domain | Select (Legal/Security/Billing/Product/Support/Marketing) |
| Owner | Person |
| Status | Select (Go/No-Go/Risk Accepted) |
| Evidence Link | URL |
| Final Decision Date | Date |
| Notes | Text |

---

### Suggested Notion Views

1. **Overdue Compliance Actions** (filter due < today and status != done)
2. **Counsel Pending** (legal review items where status = pending)
3. **Audit-Ready Evidence** (audit ready = true)
4. **High-Risk Vendors** (risk tier = high)
5. **SLA Breaches** (SLA breached = true)
