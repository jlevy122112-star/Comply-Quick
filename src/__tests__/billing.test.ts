import { describe, it, expect } from "vitest";
import { currentPeriod, computeOverage } from "@/lib/billing/usage";
import { TIER_CONFIG, METERED_PRICE_CENTS } from "@/lib/pricing";

describe("currentPeriod", () => {
  it("formats a UTC year-month bucket", () => {
    expect(currentPeriod(new Date("2026-07-03T22:08:00Z"))).toBe("2026-07");
  });

  it("zero-pads single-digit months", () => {
    expect(currentPeriod(new Date("2026-01-15T00:00:00Z"))).toBe("2026-01");
  });
});

describe("computeOverage", () => {
  it("is zero when within the included allotment", () => {
    expect(computeOverage(48, 50)).toEqual({ over: 0, overageCents: 0 });
    expect(computeOverage(50, 50)).toEqual({ over: 0, overageCents: 0 });
  });

  it("charges the metered extra-scan rate per scan over the limit", () => {
    const { over, overageCents } = computeOverage(53, 50);
    expect(over).toBe(3);
    expect(overageCents).toBe(3 * METERED_PRICE_CENTS.extraScan);
  });

  it("never accrues overage for unlimited (Enterprise) plans", () => {
    expect(computeOverage(9999, TIER_CONFIG.enterprise.scanLimit)).toEqual({ over: 0, overageCents: 0 });
  });
});

describe("agency tier limits", () => {
  it("Agency includes 5 seats and unlimited scans", () => {
    expect(TIER_CONFIG.agency.seats).toBe(5);
    expect(TIER_CONFIG.agency.scanLimit).toBe(Infinity);
  });

  it("Enterprise seats and scans are unlimited", () => {
    expect(TIER_CONFIG.enterprise.seats).toBe(Infinity);
    expect(TIER_CONFIG.enterprise.scanLimit).toBe(Infinity);
  });
});
