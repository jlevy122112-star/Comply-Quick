import { describe, it, expect } from "vitest";
import { computeImprovementPath } from "@/lib/score/improvement";
import type { Finding } from "@/lib/scanner/analyzer";

function finding(id: string, severity: Finding["severity"]): Finding {
  return { id, title: `${id} title`, severity, detail: "d", recommendation: `fix ${id}` };
}

describe("computeImprovementPath", () => {
  it("returns no steps and equal potential when there are no actionable findings", () => {
    const path = computeImprovementPath(100, []);
    expect(path.steps).toHaveLength(0);
    expect(path.potentialScore).toBe(100);
  });

  it("excludes info findings (no scoring impact)", () => {
    const path = computeImprovementPath(90, [finding("a", "info"), finding("b", "info")]);
    expect(path.steps).toHaveLength(0);
    expect(path.potentialScore).toBe(90);
  });

  it("orders critical before warning and reclaims the right points", () => {
    const path = computeImprovementPath(63, [finding("w", "warning"), finding("c", "critical")]);
    expect(path.steps.map((s) => s.findingId)).toEqual(["c", "w"]);
    // critical +25, then warning +12 → 63 → 88 → 100 (capped)
    expect(path.steps[0].scoreGain).toBe(25);
    expect(path.steps[0].projectedScore).toBe(88);
    expect(path.steps[1].scoreGain).toBe(12);
    expect(path.steps[1].projectedScore).toBe(100);
    expect(path.potentialScore).toBe(100);
  });

  it("caps projected score at 100", () => {
    const path = computeImprovementPath(95, [finding("c", "critical")]);
    expect(path.steps[0].projectedScore).toBe(100);
    expect(path.potentialScore).toBe(100);
  });

  it("carries the recommendation text through for display", () => {
    const path = computeImprovementPath(70, [finding("c", "critical")]);
    expect(path.steps[0].recommendation).toBe("fix c");
  });
});
