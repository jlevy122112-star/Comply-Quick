import { describe, it, expect } from "vitest";
import { computePaywallTriggers, LOW_SCORE_THRESHOLD, SCORE_DROP_THRESHOLD } from "@/lib/funnel/triggers";

describe("computePaywallTriggers", () => {
  it("returns no triggers for a healthy scan", () => {
    expect(
      computePaywallTriggers({ score: 92, previousScore: 90, unresolvedFindings: 0, hasAda: true, hasHipaa: true })
    ).toEqual([]);
  });

  it("fires low_score below the threshold", () => {
    const ids = computePaywallTriggers({ score: LOW_SCORE_THRESHOLD - 1 }).map((t) => t.id);
    expect(ids).toContain("low_score");
  });

  it("does not fire low_score at the threshold", () => {
    const ids = computePaywallTriggers({ score: LOW_SCORE_THRESHOLD }).map((t) => t.id);
    expect(ids).not.toContain("low_score");
  });

  it("fires score_drop when the score falls by at least the drop threshold", () => {
    const ids = computePaywallTriggers({ score: 80, previousScore: 80 + SCORE_DROP_THRESHOLD }).map((t) => t.id);
    expect(ids).toContain("score_drop");
  });

  it("does not fire score_drop for a small dip", () => {
    const ids = computePaywallTriggers({ score: 80, previousScore: 80 + SCORE_DROP_THRESHOLD - 1 }).map((t) => t.id);
    expect(ids).not.toContain("score_drop");
  });

  it("fires missing_clauses when unresolved findings exist", () => {
    const t = computePaywallTriggers({ unresolvedFindings: 3 }).find((x) => x.id === "missing_clauses");
    expect(t?.headline).toContain("3 compliance gaps");
  });

  it("uses singular copy for a single gap", () => {
    const t = computePaywallTriggers({ unresolvedFindings: 1 }).find((x) => x.id === "missing_clauses");
    expect(t?.headline).toContain("1 compliance gap");
  });

  it("fires missing_ada and missing_hipaa only when explicitly false", () => {
    const missing = computePaywallTriggers({ hasAda: false, hasHipaa: false }).map((t) => t.id);
    expect(missing).toEqual(expect.arrayContaining(["missing_ada", "missing_hipaa"]));

    const present = computePaywallTriggers({ hasAda: true, hasHipaa: true }).map((t) => t.id);
    expect(present).not.toContain("missing_ada");
    expect(present).not.toContain("missing_hipaa");

    // undefined (unknown) must not fire the trigger
    const unknown = computePaywallTriggers({}).map((t) => t.id);
    expect(unknown).not.toContain("missing_ada");
    expect(unknown).not.toContain("missing_hipaa");
  });

  it("orders triggers by severity (critical first)", () => {
    const triggers = computePaywallTriggers({
      score: 40,
      previousScore: 90,
      unresolvedFindings: 2,
      hasAda: false,
      hasHipaa: false,
    });
    expect(triggers[0].severity).toBe("critical");
    const severities = triggers.map((t) => t.severity);
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(rank[severities[i]]).toBeGreaterThanOrEqual(rank[severities[i - 1]]);
    }
  });
});
