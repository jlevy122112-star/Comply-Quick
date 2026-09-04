import { describe, expect, it } from "vitest";
import type { ScanRecord } from "@/lib/scanner/service";
import { buildCanonicalScanResults, buildScanTimeline } from "@/lib/workspace/scan-results";

function makeScan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    id: "scan-1",
    url: "https://client.example.com/page",
    status: "completed",
    score: 72,
    detectedTools: [],
    findings: [
      {
        id: "trackers_without_consent",
        title: "Trackers load without a consent banner",
        severity: "critical",
        detail: "Detected trackers without consent tooling.",
        recommendation: "Add a consent banner.",
      },
      {
        id: "missing_terms",
        title: "No terms of service link found",
        severity: "warning",
        detail: "No terms link found.",
        recommendation: "Add terms in footer.",
      },
    ],
    accessibility: {
      score: 84,
      source: "static",
      violations: [],
      findings: [
        {
          id: "accessibility.image-alt",
          title: "Images must have alternate text",
          severity: "critical",
          detail: "WCAG success criteria: 1.1.1.",
          recommendation: "Add alt attributes.",
        },
      ],
    },
    summary: "summary",
    error: null,
    organizationId: "org-1",
    clientId: null,
    sharedToken: null,
    sharedAt: null,
    emailedAt: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildCanonicalScanResults", () => {
  it("groups issues across ADA, GDPR, CCPA, and WCAG with counts", () => {
    const result = buildCanonicalScanResults(makeScan());

    expect(result.countsByRegulation.GDPR).toBeGreaterThan(0);
    expect(result.countsByRegulation.CCPA).toBeGreaterThan(0);
    expect(result.countsByRegulation.ADA).toBeGreaterThan(0);
    expect(result.countsByRegulation.WCAG).toBeGreaterThan(0);
    expect(result.severityCounts.critical).toBeGreaterThan(0);
    expect(result.target).toBe("client.example.com");
  });

  it("keeps all regulation sections even when no findings map to one", () => {
    const result = buildCanonicalScanResults(
      makeScan({
        findings: [
          {
            id: "consent_present",
            title: "Consent management detected",
            severity: "info",
            detail: "Consent tooling present.",
            recommendation: "Validate script blocking.",
          },
        ],
        accessibility: null,
      })
    );

    expect(Object.keys(result.issuesByRegulation)).toEqual(["ADA", "GDPR", "CCPA", "WCAG"]);
    expect(result.countsByRegulation.ADA).toBe(0);
    expect(result.countsByRegulation.WCAG).toBe(0);
  });
});

describe("buildScanTimeline", () => {
  it("returns timeline metadata with issue counts per scan", () => {
    const scans = [
      makeScan({ id: "scan-1", createdAt: "2026-09-02T10:00:00.000Z", score: 70 }),
      makeScan({ id: "scan-2", createdAt: "2026-09-03T10:00:00.000Z", score: 80, findings: [], accessibility: null }),
    ];

    const timeline = buildScanTimeline(scans);

    expect(timeline).toHaveLength(2);
    expect(timeline[0].scanId).toBe("scan-1");
    expect(timeline[0].totalIssues).toBeGreaterThan(0);
    expect(timeline[1].totalIssues).toBe(0);
    expect(timeline[0].severityCounts.critical).toBeGreaterThan(0);
  });
});
