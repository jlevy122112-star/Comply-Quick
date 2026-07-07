import { describe, it, expect } from "vitest";
import {
  TIER_CONFIG,
  METERED_PRICE_CENTS,
  PAID_TIERS,
  ALL_TIERS,
  isPaidTier,
  isTier,
  seatLimit,
  scanLimit,
  isUnlimited,
  normalizeTierKey,
} from "@/lib/pricing";

describe("TIER_CONFIG", () => {
  it("defines exactly free, solo, agency, enterprise", () => {
    expect(Object.keys(TIER_CONFIG).sort()).toEqual(["agency", "enterprise", "free", "solo"]);
  });

  it("prices the Solo plan at $29/mo, $290/yr", () => {
    expect(TIER_CONFIG.solo.label).toBe("Solo");
    expect(TIER_CONFIG.solo.monthly).toBe(29);
    expect(TIER_CONFIG.solo.annual).toBe(290);
    expect(TIER_CONFIG.solo.scanLimit).toBe(20);
    expect(TIER_CONFIG.solo.mode).toBe("subscription");
    expect(TIER_CONFIG.solo.priceEnv).toEqual({
      monthly: "STRIPE_PRICE_SOLO_MONTHLY",
      annual: "STRIPE_PRICE_SOLO_ANNUAL",
    });
  });

  it("caps the free tier at 1 scan/month with no checkout", () => {
    expect(TIER_CONFIG.free.scanLimit).toBe(1);
    expect(TIER_CONFIG.free.mode).toBe("none");
    expect(TIER_CONFIG.free.priceEnv).toBeUndefined();
  });

  it("gives Enterprise unlimited seats and scans", () => {
    expect(isUnlimited(TIER_CONFIG.enterprise.seats)).toBe(true);
    expect(isUnlimited(TIER_CONFIG.enterprise.scanLimit)).toBe(true);
    expect(isUnlimited(TIER_CONFIG.agency.scanLimit)).toBe(false);
  });

  it("does not reference the retired single/pro tiers", () => {
    expect((TIER_CONFIG as Record<string, unknown>).single).toBeUndefined();
    expect((TIER_CONFIG as Record<string, unknown>).pro).toBeUndefined();
  });
});

describe("normalizeTierKey", () => {
  it("maps the retired pro/single keys to solo", () => {
    expect(normalizeTierKey("pro")).toBe("solo");
    expect(normalizeTierKey("single")).toBe("solo");
  });

  it("leaves current keys untouched", () => {
    expect(normalizeTierKey("solo")).toBe("solo");
    expect(normalizeTierKey("agency")).toBe("agency");
    expect(normalizeTierKey("free")).toBe("free");
  });
});

describe("metered prices", () => {
  it("matches the Executive Summary usage rates", () => {
    expect(METERED_PRICE_CENTS.apiCall).toBe(1); // $0.01
    expect(METERED_PRICE_CENTS.extraScan).toBe(500); // $5
    expect(METERED_PRICE_CENTS.apiTemplateUpload).toBe(5000); // $50
  });
});

describe("tier guards & helpers", () => {
  it("classifies paid vs. all tiers", () => {
    expect(PAID_TIERS).toEqual(["solo", "agency", "enterprise"]);
    expect(ALL_TIERS).toEqual(["free", "solo", "agency", "enterprise"]);
    expect(isPaidTier("solo")).toBe(true);
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("pro")).toBe(false);
    expect(isPaidTier("single")).toBe(false);
    expect(isTier("free")).toBe(true);
    expect(isTier("bogus")).toBe(false);
  });

  it("exposes seat and scan limits per tier", () => {
    expect(seatLimit("agency")).toBe(5);
    expect(scanLimit("solo")).toBe(20);
    expect(scanLimit("agency")).toBe(100);
    expect(seatLimit("enterprise")).toBe(Infinity);
  });
});
