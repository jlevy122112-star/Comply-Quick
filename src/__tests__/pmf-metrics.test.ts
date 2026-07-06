import { describe, it, expect } from "vitest";
import {
  categorizeNps,
  computeNps,
  rate,
  toPercent,
  tallyBy,
  isChurnReason,
  isPmfAdmin,
  parseAdminEmails,
  CHURN_REASONS,
} from "@/lib/pmf/metrics";

describe("categorizeNps", () => {
  it("buckets by standard NPS thresholds", () => {
    expect(categorizeNps(10)).toBe("promoter");
    expect(categorizeNps(9)).toBe("promoter");
    expect(categorizeNps(8)).toBe("passive");
    expect(categorizeNps(7)).toBe("passive");
    expect(categorizeNps(6)).toBe("detractor");
    expect(categorizeNps(0)).toBe("detractor");
  });
});

describe("computeNps", () => {
  it("computes %promoters − %detractors, rounded", () => {
    const r = computeNps([10, 10, 9, 8, 7, 6, 0]);
    expect(r.promoters).toBe(3);
    expect(r.passives).toBe(2);
    expect(r.detractors).toBe(2);
    expect(r.count).toBe(7);
    expect(r.nps).toBe(14); // round((3-2)/7*100)
  });

  it("ignores out-of-range scores and handles empty input", () => {
    expect(computeNps([]).nps).toBe(0);
    const r = computeNps([11, -1, 10, 10]);
    expect(r.count).toBe(2);
    expect(r.nps).toBe(100);
  });
});

describe("rate / toPercent", () => {
  it("returns 0 when denominator is 0", () => {
    expect(rate(3, 0)).toBe(0);
  });
  it("rounds to 4dp and converts to whole percent", () => {
    expect(rate(1, 3)).toBe(0.3333);
    expect(toPercent(0.3333)).toBe(33.3);
  });
});

describe("tallyBy", () => {
  it("counts per key and skips nullish keys", () => {
    const rows = [{ c: "ads" }, { c: "ads" }, { c: "organic" }, { c: null }];
    expect(tallyBy(rows, (r) => r.c)).toEqual({ ads: 2, organic: 1 });
  });
});

describe("churn reasons + admin allowlist", () => {
  it("validates known churn reasons", () => {
    for (const r of CHURN_REASONS) expect(isChurnReason(r)).toBe(true);
    expect(isChurnReason("nope")).toBe(false);
    expect(isChurnReason(5)).toBe(false);
  });

  it("parses and matches admin emails case-insensitively", () => {
    expect(parseAdminEmails("A@x.com, b@y.com  c@z.com")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(isPmfAdmin("B@Y.com", "a@x.com,b@y.com")).toBe(true);
    expect(isPmfAdmin("d@x.com", "a@x.com")).toBe(false);
    expect(isPmfAdmin(null, "a@x.com")).toBe(false);
    expect(isPmfAdmin("a@x.com", undefined)).toBe(false);
  });
});
