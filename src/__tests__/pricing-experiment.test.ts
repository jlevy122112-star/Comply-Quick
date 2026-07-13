import { describe, it, expect } from "vitest";
import {
  defaultBillingForVariant,
  orderedPlansForVariant,
  resolveServerPricingVariant,
} from "@/lib/experiments/pricing";

describe("pricing experiment helpers", () => {
  it("defaults annual billing only for annual_default variant", () => {
    expect(defaultBillingForVariant("annual_default", "monthly")).toBe("annual");
    expect(defaultBillingForVariant("control", "monthly")).toBe("monthly");
    expect(defaultBillingForVariant("agency_first", "annual")).toBe("annual");
  });

  it("moves agency to first position for agency_first variant", () => {
    expect(orderedPlansForVariant("agency_first", ["solo", "agency", "enterprise"])).toEqual([
      "agency",
      "solo",
      "enterprise",
    ]);
    expect(orderedPlansForVariant("control", ["solo", "agency", "enterprise"])).toEqual([
      "solo",
      "agency",
      "enterprise",
    ]);
  });

  it("resolves deterministic server assignment for same experiment id", () => {
    const first = resolveServerPricingVariant("abc123");
    const second = resolveServerPricingVariant("abc123");
    expect(first.variant).toBe(second.variant);
    expect(first.id).toBe("abc123");
  });
});
