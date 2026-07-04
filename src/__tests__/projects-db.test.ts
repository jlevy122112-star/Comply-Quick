import { describe, it, expect } from "vitest";
import { getAggregateScore, type DbProject } from "@/lib/projects-db";
import type { ComplianceScore } from "@/components/ClauseEngine";

function makeProject(overall: number, partial?: Partial<ComplianceScore>): DbProject {
  const score: ComplianceScore = {
    overall,
    contractProtection: partial?.contractProtection ?? overall,
    privacyCoverage: partial?.privacyCoverage ?? overall,
    preLaunchReadiness: partial?.preLaunchReadiness ?? overall,
    regulatoryBreadth: partial?.regulatoryBreadth ?? overall,
  };
  return {
    id: `p_${overall}`,
    name: "Test",
    framework: "nextjs",
    trackingPixels: [],
    targetRegions: [],
    complianceModules: [],
    complianceScore: score,
    status: "current",
    packageMarkdown: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("getAggregateScore", () => {
  it("returns null when there are no projects", () => {
    expect(getAggregateScore([])).toBeNull();
  });

  it("returns the single project's score when there is one project", () => {
    const result = getAggregateScore([makeProject(80)]);
    expect(result).not.toBeNull();
    expect(result?.overall).toBe(80);
  });

  it("averages and rounds scores across multiple projects", () => {
    const result = getAggregateScore([makeProject(80), makeProject(90), makeProject(85)]);
    // (80 + 90 + 85) / 3 = 85
    expect(result?.overall).toBe(85);
  });

  it("rounds non-integer averages to the nearest integer", () => {
    const result = getAggregateScore([makeProject(80), makeProject(81)]);
    // (80 + 81) / 2 = 80.5 -> 81
    expect(result?.overall).toBe(81);
  });

  it("averages each category independently", () => {
    const result = getAggregateScore([
      makeProject(80, { contractProtection: 100, privacyCoverage: 60 }),
      makeProject(80, { contractProtection: 60, privacyCoverage: 100 }),
    ]);
    expect(result?.contractProtection).toBe(80);
    expect(result?.privacyCoverage).toBe(80);
  });
});
