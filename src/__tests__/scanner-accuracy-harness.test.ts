import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeHtml, detectTools, detectToolsDetailed, FINGERPRINT_CATEGORIES } from "@/lib/scanner/analyzer";
import { getService, SERVICE_CATALOG } from "@/lib/compliance/catalog";
import { deriveObligations } from "@/lib/compliance/traverse";
import { lintCompliance } from "@/lib/compliance/linter";

type ExpectedLintFinding = { id: string; severity: "error" | "warning" };
type ExpectedDetection = {
  id: string;
  layer: "html" | "runtime" | "both";
  weakOnly: boolean;
  minConfidence?: number;
  maxConfidence?: number;
};

type AccuracyFixture = {
  id: string;
  description: string;
  html: string;
  requestUrls: string[];
  jurisdictions: ("eu" | "uk" | "us_ca" | "br" | "global")[];
  complianceState: {
    hasPrivacyPolicy: boolean;
    hasConsentMechanism: boolean;
    dpaWith: string[];
    jointControllerArrangements?: string[];
    mentionsSccs: boolean;
    addressesPci: boolean;
  };
  expected: {
    tools: string[];
    negativeTools: string[];
    analyzerFindings: string[];
    lintFindings: ExpectedLintFinding[];
    obligations: string[];
    detailed: ExpectedDetection[];
    knownGaps?: string[];
    knownGapTools?: string[];
  };
};

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../lib/scanner/accuracy-fixtures");

const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as AccuracyFixture);

function sorted<T extends string>(values: T[]): T[] {
  return [...values].sort();
}

function lintKey(finding: ExpectedLintFinding): string {
  return `${finding.id}:${finding.severity}`;
}

describe("scanner accuracy golden corpus", () => {
  it("measures deterministic detection, compliance, calibration, and layer coverage", () => {
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    let calibratedDetections = 0;
    let expectedDetailedCount = 0;
    let knownGapCount = 0;
    const knownGapIds = new Set<string>();
    const allDetectedIds = new Set<string>();

    expect(fixtures.length).toBeGreaterThanOrEqual(9);

    for (const fixture of fixtures) {
      const actualTools = detectTools(fixture.html, fixture.requestUrls);
      const actualIds = actualTools.map((tool) => tool.id);
      const actualDetailed = detectToolsDetailed(fixture.html, fixture.requestUrls);
      const actualDetailedById = new Map(actualDetailed.map((tool) => [tool.id, tool]));
      const actualAnalysis = analyzeHtml(fixture.html, fixture.requestUrls);
      const actualLint = lintCompliance({
        services: actualIds,
        jurisdictions: fixture.jurisdictions,
        ...fixture.complianceState,
      });
      const actualObligations = deriveObligations({
        services: actualIds,
        jurisdictions: fixture.jurisdictions,
      }).map((result) => result.obligation.id);
      const knownGaps = fixture.expected.knownGaps ?? [];
      const hasKnownGap = knownGaps.length > 0;
      const knownGapTools = new Set(fixture.expected.knownGapTools ?? []);

      for (const id of actualIds) {
        allDetectedIds.add(id);
        expect(getService(id), `${fixture.id}: detected ${id} must have a catalog entry`).toBeDefined();
      }

      const expectedSet = new Set(fixture.expected.tools);
      const actualSet = new Set(actualIds);
      truePositives += fixture.expected.tools.filter((id) => actualSet.has(id)).length;
      falseNegatives += fixture.expected.tools.filter((id) => !actualSet.has(id)).length;
      falsePositives += actualIds.filter((id) => !expectedSet.has(id)).length;

      const unexpectedNegatives = actualIds.filter(
        (id) => fixture.expected.negativeTools.includes(id) && !knownGapTools.has(id)
      );
      expect(unexpectedNegatives, `${fixture.id}: explicit negative guard`).toEqual([]);

      if (hasKnownGap) {
        const unexplainedDetections = actualIds.filter((id) => !expectedSet.has(id) && !knownGapTools.has(id));
        expect(unexplainedDetections, `${fixture.id}: known gap must be specific`).toEqual([]);
        knownGapCount += actualIds.filter((id) => knownGapTools.has(id)).length;
        for (const gap of knownGaps) knownGapIds.add(gap);
      } else {
        expect(sorted(actualIds), `${fixture.id}: detected tools`).toEqual(sorted(fixture.expected.tools));
        expect(
          sorted(actualAnalysis.findings.map((finding) => finding.id)),
          `${fixture.id}: analyzer findings`
        ).toEqual(sorted(fixture.expected.analyzerFindings));
        expect(sorted(actualLint.map(lintKey)), `${fixture.id}: linter findings`).toEqual(
          sorted(fixture.expected.lintFindings.map(lintKey))
        );
        expect(sorted(actualObligations), `${fixture.id}: obligation mapping`).toEqual(
          sorted(fixture.expected.obligations)
        );
      }

      for (const expected of fixture.expected.detailed) {
        expectedDetailedCount += 1;
        const actual = actualDetailedById.get(expected.id);
        expect(actual, `${fixture.id}: detailed detection ${expected.id}`).toBeDefined();
        if (!actual) continue;
        expect(actual.layer, `${fixture.id}: ${expected.id} detection layer`).toBe(expected.layer);
        expect(actual.isWeakOnly, `${fixture.id}: ${expected.id} weak-only classification`).toBe(expected.weakOnly);
        if (expected.minConfidence !== undefined) {
          expect(actual.confidence, `${fixture.id}: ${expected.id} minimum confidence`).toBeGreaterThanOrEqual(
            expected.minConfidence
          );
        }
        if (expected.maxConfidence !== undefined) {
          expect(actual.confidence, `${fixture.id}: ${expected.id} maximum confidence`).toBeLessThanOrEqual(
            expected.maxConfidence
          );
        }
        if (actual.isWeakOnly) {
          expect(actual.confidence, `${fixture.id}: weak-only confidence cap`).toBeLessThanOrEqual(0.3);
        }
        calibratedDetections += 1;
      }
    }

    const precision = truePositives / (truePositives + falsePositives);
    const recall = truePositives / (truePositives + falseNegatives);
    const f1 = (2 * precision * recall) / (precision + recall);

    expect(precision, "detection precision regression gate").toBeGreaterThanOrEqual(0.9);
    expect(recall, "detection recall regression gate").toBeGreaterThanOrEqual(0.95);
    expect(f1, "detection F1 regression gate").toBeGreaterThanOrEqual(0.94);
    expect(calibratedDetections).toBe(expectedDetailedCount);
    expect(knownGapCount).toBeGreaterThanOrEqual(1);
    expect([...knownGapIds]).toEqual(["bare_gtag_is_currently_a_google_false_positive"]);
    expect([...allDetectedIds].every((id) => FINGERPRINT_CATEGORIES[id] !== undefined)).toBe(true);

    console.info(
      JSON.stringify(
        {
          fixtureCount: fixtures.length,
          detection: {
            truePositives,
            falsePositives,
            falseNegatives,
            precision: Number(precision.toFixed(4)),
            recall: Number(recall.toFixed(4)),
            f1: Number(f1.toFixed(4)),
          },
          detailedCalibration: `${calibratedDetections}/${expectedDetailedCount}`,
          knownGapCount,
          detectableCatalogEntries: SERVICE_CATALOG.filter((service) => FINGERPRINT_CATEGORIES[service.id]).length,
        },
        null,
        2
      )
    );
  });
});
