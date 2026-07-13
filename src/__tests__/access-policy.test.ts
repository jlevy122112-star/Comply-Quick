import { describe, expect, it } from "vitest";
import { EMAIL_ACCESS_POLICIES, isEmailAllowed, isEmailPolicyAllowed, parseEmailAllowlist } from "@/lib/access-policy";

describe("email access policy", () => {
  it("normalizes allowlists and denies unknown users by default", () => {
    expect(parseEmailAllowlist(" Admin@Example.com, reviewer@example.com ")).toEqual([
      "admin@example.com",
      "reviewer@example.com",
    ]);
    expect(isEmailAllowed("ADMIN@example.com", "admin@example.com")).toBe(true);
    expect(isEmailAllowed("visitor@example.com", "admin@example.com")).toBe(false);
    expect(isEmailAllowed(null, "admin@example.com")).toBe(false);
  });

  it("uses named environment-backed policies", () => {
    const environment = {
      [EMAIL_ACCESS_POLICIES.legalReview]: "legal@example.com",
      [EMAIL_ACCESS_POLICIES.pmfMetrics]: "pmf@example.com",
    };

    expect(isEmailPolicyAllowed("legalReview", "legal@example.com", environment)).toBe(true);
    expect(isEmailPolicyAllowed("pmfMetrics", "legal@example.com", environment)).toBe(false);
    expect(isEmailPolicyAllowed("pmfMetrics", "pmf@example.com", environment)).toBe(true);
  });
});
