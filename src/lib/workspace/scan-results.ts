import type { Finding } from "@/lib/scanner/analyzer";
import type { ScanRecord } from "@/lib/scanner/service";

export const REGULATIONS = ["ADA", "GDPR", "CCPA", "WCAG"] as const;

export type ComplianceRegulation = (typeof REGULATIONS)[number];
export type CanonicalSeverity = "critical" | "warning" | "info";

export interface CanonicalScanIssue {
  id: string;
  scanId: string;
  regulation: ComplianceRegulation;
  severity: CanonicalSeverity;
  whatToFix: string;
  whyItMatters: string;
  howToFix: string;
}

export interface CanonicalScanResults {
  scanId: string;
  createdAt: string;
  target: string;
  status: ScanRecord["status"];
  score: number | null;
  issues: CanonicalScanIssue[];
  issuesByRegulation: Record<ComplianceRegulation, CanonicalScanIssue[]>;
  countsByRegulation: Record<ComplianceRegulation, number>;
  severityCounts: Record<CanonicalSeverity, number>;
}

export interface ScanTimelineItem {
  scanId: string;
  createdAt: string;
  status: ScanRecord["status"];
  target: string;
  score: number | null;
  totalIssues: number;
  severityCounts: Record<CanonicalSeverity, number>;
}

function targetFrom(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function normalizeSeverity(severity: string): CanonicalSeverity {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "warning" || severity === "medium") return "warning";
  return "info";
}

function regulationsForFinding(finding: Finding): ComplianceRegulation[] {
  if (finding.id.startsWith("accessibility.")) return ["WCAG", "ADA"];
  switch (finding.id) {
    case "trackers_without_consent":
      return ["GDPR", "CCPA"];
    case "missing_privacy_policy":
      return ["GDPR", "CCPA"];
    case "session_replay_present":
      return ["CCPA", "GDPR"];
    case "missing_terms":
      return ["CCPA"];
    case "consent_present":
      return ["GDPR"];
    default:
      return ["GDPR"];
  }
}

function issueFromFinding(scan: ScanRecord, finding: Finding, regulation: ComplianceRegulation): CanonicalScanIssue {
  return {
    id: `${finding.id}:${regulation}`,
    scanId: scan.id,
    regulation,
    severity: normalizeSeverity(finding.severity),
    whatToFix: finding.title,
    whyItMatters: finding.detail,
    howToFix: finding.recommendation,
  };
}

export function buildCanonicalScanResults(scan: ScanRecord): CanonicalScanResults {
  const findings = [...scan.findings, ...(scan.accessibility?.findings ?? [])];
  const issues = findings.flatMap((finding) =>
    regulationsForFinding(finding).map((regulation) => issueFromFinding(scan, finding, regulation))
  );

  const issuesByRegulation: Record<ComplianceRegulation, CanonicalScanIssue[]> = {
    ADA: [],
    GDPR: [],
    CCPA: [],
    WCAG: [],
  };
  const severityCounts: Record<CanonicalSeverity, number> = { critical: 0, warning: 0, info: 0 };

  for (const issue of issues) {
    issuesByRegulation[issue.regulation].push(issue);
    severityCounts[issue.severity] += 1;
  }

  for (const regulation of REGULATIONS) {
    issuesByRegulation[regulation].sort((a, b) => {
      const rank: Record<CanonicalSeverity, number> = { critical: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity] || a.whatToFix.localeCompare(b.whatToFix);
    });
  }

  return {
    scanId: scan.id,
    createdAt: scan.createdAt,
    target: targetFrom(scan.url),
    status: scan.status,
    score: scan.score,
    issues,
    issuesByRegulation,
    countsByRegulation: {
      ADA: issuesByRegulation.ADA.length,
      GDPR: issuesByRegulation.GDPR.length,
      CCPA: issuesByRegulation.CCPA.length,
      WCAG: issuesByRegulation.WCAG.length,
    },
    severityCounts,
  };
}

export function buildScanTimeline(scans: ScanRecord[]): ScanTimelineItem[] {
  return scans.map((scan) => {
    const results = buildCanonicalScanResults(scan);
    return {
      scanId: scan.id,
      createdAt: scan.createdAt,
      status: scan.status,
      target: results.target,
      score: scan.score,
      totalIssues: results.issues.length,
      severityCounts: results.severityCounts,
    };
  });
}
