import { describe, it, expect } from "vitest";
import {
  nextQuarterlyReviewDate,
  isReviewOverdue,
  isReviewStatus,
  isReviewCategory,
  parseAdminEmails,
  isLegalAdmin,
  REVIEW_INTERVAL_MONTHS,
} from "@/lib/legal/review";
import { REPORT_DISCLAIMER, LIABILITY_CAP, TERMS_OF_SERVICE } from "@/lib/legal";

describe("nextQuarterlyReviewDate", () => {
  it("schedules the review REVIEW_INTERVAL_MONTHS ahead", () => {
    expect(REVIEW_INTERVAL_MONTHS).toBe(3);
    expect(nextQuarterlyReviewDate(new Date("2026-01-15T00:00:00Z"))).toBe("2026-04-15");
  });

  it("clamps to the last valid day when the target month is shorter", () => {
    // Nov 30 + 3 months would be Feb 30 → clamp to Feb 28 (2027 is not a leap year).
    expect(nextQuarterlyReviewDate(new Date("2026-11-30T00:00:00Z"))).toBe("2027-02-28");
  });

  it("crosses year boundaries", () => {
    expect(nextQuarterlyReviewDate(new Date("2026-12-01T00:00:00Z"))).toBe("2027-03-01");
  });
});

describe("isReviewOverdue", () => {
  const now = new Date("2026-07-03T12:00:00Z");
  it("is overdue when the next review date is today or earlier", () => {
    expect(isReviewOverdue("2026-07-03", now)).toBe(true);
    expect(isReviewOverdue("2026-01-01", now)).toBe(true);
  });
  it("is not overdue for future dates", () => {
    expect(isReviewOverdue("2026-10-01", now)).toBe(false);
  });
});

describe("status/category guards", () => {
  it("validates statuses", () => {
    expect(isReviewStatus("approved")).toBe(true);
    expect(isReviewStatus("changes_requested")).toBe(true);
    expect(isReviewStatus("bogus")).toBe(false);
    expect(isReviewStatus(42)).toBe(false);
  });
  it("validates categories", () => {
    expect(isReviewCategory("tos")).toBe(true);
    expect(isReviewCategory("clause_template")).toBe(true);
    expect(isReviewCategory("nope")).toBe(false);
  });
});

describe("admin allowlist", () => {
  it("parses comma/space separated emails, normalized", () => {
    expect(parseAdminEmails("A@x.com, b@y.com  c@z.com")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });
  it("matches case-insensitively and rejects non-members / null", () => {
    const allow = "reviewer@firm.com, counsel@firm.com";
    expect(isLegalAdmin("Reviewer@Firm.com", allow)).toBe(true);
    expect(isLegalAdmin("stranger@firm.com", allow)).toBe(false);
    expect(isLegalAdmin(null, allow)).toBe(false);
    expect(isLegalAdmin("reviewer@firm.com", undefined)).toBe(false);
  });
});

describe("legal copy", () => {
  it("exposes the exact mandatory disclaimer and liability cap", () => {
    expect(REPORT_DISCLAIMER).toBe(
      "This package is informational only. Consult a legal professional before deployment."
    );
    expect(LIABILITY_CAP).toBe(
      "We are not liable for damages from use of generated content. Client assumes all legal risk."
    );
  });
  it("embeds the liability cap in the Terms of Service", () => {
    const allBody = TERMS_OF_SERVICE.flatMap((s) => s.body);
    expect(allBody).toContain(LIABILITY_CAP);
  });
});
