// Data retention policy — declarative source of truth.
//
// Defines how long each category of personal/operational data is kept and the
// legal/operational basis for that period. This drives (a) the public retention
// disclosure surfaced in the privacy policy and (b) automated pruning of
// expired records. Keeping the policy as data (not scattered constants) means
// the disclosure and the enforcement job can never silently diverge.

export type RetentionCategory =
  "account" | "scan_results" | "leads" | "audit_logs" | "billing_records" | "analytics_events" | "notifications";

export interface RetentionRule {
  category: RetentionCategory;
  /** Human label for the retention disclosure. */
  label: string;
  /**
   * Retention period in days. `null` means retained for the lifetime of the
   * account (deleted on account erasure), with no time-based expiry.
   */
  days: number | null;
  /** Why the data is kept for this period (shown in the disclosure). */
  basis: string;
}

export const RETENTION_POLICY: readonly RetentionRule[] = [
  {
    category: "account",
    label: "Account & profile data",
    days: null,
    basis: "Retained while the account is active; erased on account deletion.",
  },
  {
    category: "scan_results",
    label: "Scan results & generated documents",
    days: 730,
    basis: "Kept for 24 months so compliance history and versioning remain available; then pruned.",
  },
  {
    category: "leads",
    label: "Marketing leads",
    days: 365,
    basis: "Kept for 12 months from capture for follow-up, then deleted.",
  },
  {
    category: "audit_logs",
    label: "Audit & security logs",
    days: 365,
    basis: "Retained 12 months for security, accountability, and dispute resolution.",
  },
  {
    category: "billing_records",
    label: "Billing & tax records",
    days: 2555,
    basis: "Retained ~7 years to meet financial/tax record-keeping obligations.",
  },
  {
    category: "analytics_events",
    label: "Product analytics events",
    days: 180,
    basis: "Aggregated after 6 months; raw events pruned.",
  },
  {
    category: "notifications",
    label: "In-app notifications",
    days: 90,
    basis: "Transient; cleared 90 days after delivery.",
  },
];

const BY_CATEGORY: Readonly<Record<RetentionCategory, RetentionRule>> = Object.fromEntries(
  RETENTION_POLICY.map((r) => [r.category, r])
) as Record<RetentionCategory, RetentionRule>;

/** Returns the retention rule for a category. */
export function retentionFor(category: RetentionCategory): RetentionRule {
  return BY_CATEGORY[category];
}

/**
 * Whether a record created at `createdAt` has passed its retention period as of
 * `now`. Lifetime categories (`days: null`) never expire on time. Returns false
 * for unparseable timestamps to avoid deleting data on bad input.
 */
export function isExpired(createdAt: string | Date, category: RetentionCategory, now: Date = new Date()): boolean {
  const rule = BY_CATEGORY[category];
  if (rule.days === null) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const ms = created.getTime();
  if (Number.isNaN(ms)) return false;
  const ageDays = (now.getTime() - ms) / 86_400_000;
  return ageDays > rule.days;
}
