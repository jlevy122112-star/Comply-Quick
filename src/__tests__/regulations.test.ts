import { describe, expect, it } from "vitest";
import { REGULATORY_ALERTS, alertsForRegions, alertsDigest, regionsFromProjects } from "@/lib/regulations/alerts";
import type { TargetRegion } from "@/components/ClauseEngine";

describe("regulatory alerts dataset", () => {
  it("has unique ids and valid required fields", () => {
    const ids = new Set<string>();
    for (const a of REGULATORY_ALERTS) {
      expect(a.id).toBeTruthy();
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
      expect(a.title).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.affectedRegions.length).toBeGreaterThan(0);
      expect(["info", "warning", "critical"]).toContain(a.severity);
      expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(a.sourceUrl).toMatch(/^https:\/\//);
    }
  });
});

describe("alertsForRegions", () => {
  it("returns the full feed (newest first) when no regions are given", () => {
    const all = alertsForRegions([]);
    expect(all).toHaveLength(REGULATORY_ALERTS.length);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].date >= all[i].date).toBe(true);
    }
  });

  it("returns only alerts touching the given regions", () => {
    const eu = alertsForRegions(["eu_gdpr"]);
    expect(eu.length).toBeGreaterThan(0);
    expect(eu.every((a) => a.affectedRegions.includes("eu_gdpr"))).toBe(true);
    expect(
      eu.some((a) => a.affectedRegions.includes("california_ccpa") && !a.affectedRegions.includes("eu_gdpr"))
    ).toBe(false);
  });

  it("does not mutate the source array when sorting", () => {
    const before = REGULATORY_ALERTS.map((a) => a.id);
    alertsForRegions([]);
    expect(REGULATORY_ALERTS.map((a) => a.id)).toEqual(before);
  });
});

describe("regionsFromProjects", () => {
  it("returns the distinct union of project target regions", () => {
    const projects: { targetRegions: TargetRegion[] }[] = [
      { targetRegions: ["eu_gdpr", "us_general"] },
      { targetRegions: ["us_general", "california_ccpa"] },
    ];
    const regions = regionsFromProjects(projects);
    expect(regions).toHaveLength(3);
    expect(new Set(regions)).toEqual(new Set(["eu_gdpr", "us_general", "california_ccpa"]));
  });

  it("returns an empty array for no projects", () => {
    expect(regionsFromProjects([])).toEqual([]);
  });
});

describe("alertsDigest", () => {
  it("renders one source-linked line per alert for the full feed", () => {
    const digest = alertsDigest();
    const lines = digest.split("\n");
    expect(lines).toHaveLength(REGULATORY_ALERTS.length);
    expect(lines.every((l) => l.startsWith("- [") && l.includes("source: https://"))).toBe(true);
  });

  it("scopes to the given regions", () => {
    const digest = alertsDigest(["california_ccpa"]);
    const ccpa = alertsForRegions(["california_ccpa"]);
    expect(digest.split("\n")).toHaveLength(ccpa.length);
  });
});
