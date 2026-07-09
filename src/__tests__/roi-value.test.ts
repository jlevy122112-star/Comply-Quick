import { describe, it, expect } from "vitest";
import { computeRoi, artifactSaving, formatUsd, ARTIFACT_VALUES } from "@/lib/roi/value";

describe("artifactSaving", () => {
  it("returns the conservative attorney-equivalent cost", () => {
    expect(artifactSaving("dpa")).toBe(ARTIFACT_VALUES.dpa.attorneyCost);
    expect(artifactSaving("compliance_package")).toBe(1500);
  });
});

describe("computeRoi", () => {
  it("sums savings across artifacts and nets out subscription cost", () => {
    const roi = computeRoi({ compliance_package: 2, dpa: 1 }, 290);
    expect(roi.grossSaved).toBe(1500 * 2 + 900);
    expect(roi.netSaved).toBe(roi.grossSaved - 290);
    expect(roi.roiMultiple).not.toBeNull();
    expect(roi.lineItems).toHaveLength(2);
  });

  it("floors net savings at zero and omits zero-count line items", () => {
    const roi = computeRoi({ scan: 0 }, 1000);
    expect(roi.grossSaved).toBe(0);
    expect(roi.netSaved).toBe(0);
    expect(roi.lineItems).toHaveLength(0);
  });

  it("has no ROI multiple for the free tier (no cost)", () => {
    expect(computeRoi({ scan: 1 }, 0).roiMultiple).toBeNull();
  });
});

describe("formatUsd", () => {
  it("formats whole-dollar amounts with thousands separators", () => {
    expect(formatUsd(1500)).toBe("$1,500");
    expect(formatUsd(0)).toBe("$0");
  });
});
