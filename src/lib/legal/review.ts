// Pure helpers for the quarterly legal-review workflow ([Up10]). No DB or
// server imports so this stays unit-testable; the DB-backed service lives in
// review-queue.ts.

export const REVIEW_STATUSES = ["pending", "approved", "changes_requested"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_CATEGORIES = ["clause_template", "regulation", "disclaimer", "tos"] as const;
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

/** Quarterly review cadence, in months. */
export const REVIEW_INTERVAL_MONTHS = 3;

export interface LegalReviewItem {
  id: string;
  title: string;
  category: ReviewCategory;
  contentRef: string;
  status: ReviewStatus;
  reviewer: string | null;
  notes: string;
  reviewedAt: string | null;
  nextReviewAt: string; // YYYY-MM-DD
  createdAt: string;
}

function toDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The next quarterly review date, `REVIEW_INTERVAL_MONTHS` after `from`.
 * Returns a YYYY-MM-DD string. Month overflow is handled by the Date API
 * (e.g. Nov 30 + 3mo → Feb 28/29, never an invalid March 2/3).
 */
export function nextQuarterlyReviewDate(from: Date = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const targetMonth = d.getUTCMonth() + REVIEW_INTERVAL_MONTHS;
  const candidate = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, d.getUTCDate()));
  // If the day rolled over into the following month (shorter target month),
  // clamp back to the last day of the intended month.
  if (candidate.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    candidate.setUTCDate(0);
  }
  return toDayKey(candidate);
}

/** True when an item's next review date is on or before `now`. */
export function isReviewOverdue(nextReviewAt: string, now: Date = new Date()): boolean {
  return nextReviewAt <= toDayKey(now);
}

export function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

export function isReviewCategory(value: unknown): value is ReviewCategory {
  return typeof value === "string" && (REVIEW_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Parse the LEGAL_REVIEW_ADMIN_EMAILS allowlist (comma/whitespace separated)
 * into a normalized, lower-cased list.
 */
export function parseAdminEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether `email` is permitted to access the legal-review queue. */
export function isLegalAdmin(email: string | null | undefined, raw: string | undefined): boolean {
  if (!email) return false;
  const allow = parseAdminEmails(raw);
  return allow.includes(email.trim().toLowerCase());
}
