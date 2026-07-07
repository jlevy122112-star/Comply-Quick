import { describe, it, expect } from "vitest";
import { partnerCommissionCents, PARTNER_COMMISSION_RATE } from "@/lib/partners/service";

describe("partner commission math", () => {
  it("uses a 30% recurring share", () => {
    expect(PARTNER_COMMISSION_RATE).toBe(0.3);
  });

  it("computes 30% of the gross payment in cents", () => {
    expect(partnerCommissionCents(1200)).toBe(360); // $12.00 → $3.60
    expect(partnerCommissionCents(2900)).toBe(870); // $29/mo Solo → $8.70
    expect(partnerCommissionCents(9900)).toBe(2970); // $99/mo Agency → $29.70
  });

  it("rounds to the nearest cent", () => {
    expect(partnerCommissionCents(999)).toBe(300); // 299.7 → 300
    expect(partnerCommissionCents(1001)).toBe(300); // 300.3 → 300
  });

  it("returns zero for a zero payment", () => {
    expect(partnerCommissionCents(0)).toBe(0);
  });
});
