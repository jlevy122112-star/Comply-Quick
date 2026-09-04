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
      return [];
  }
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const unique: Finding[] = [];
  for (const finding of findings) {
    const key = `${finding.id}|${finding.title}|${finding.severity}|${finding.detail}|${finding.recommendation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return unique;
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
  const issuesByRegulation: Record<ComplianceRegulation, CanonicalScanIssue[]> = {
    ADA: [],
    GDPR: [],
    CCPA: [],
    WCAG: [],
  };
  const severityCounts: Record<CanonicalSeverity, number> = { critical: 0, warning: 0, info: 0 };

  if (scan.status !== "completed") {
    return {
      scanId: scan.id,
      createdAt: scan.createdAt,
      target: targetFrom(scan.url),
      status: scan.status,
      score: scan.score,
      issues: [],
      issuesByRegulation,
      countsByRegulation: { ADA: 0, GDPR: 0, CCPA: 0, WCAG: 0 },
      severityCounts,
    };
  }

  const findings = dedupeFindings([...scan.findings, ...(scan.accessibility?.findings ?? [])]);
  for (const finding of findings) {
    severityCounts[normalizeSeverity(finding.severity)] += 1;
  }

  const issues = findings.flatMap((finding) =>
    regulationsForFinding(finding).map((regulation) => issueFromFinding(scan, finding, regulation))
  );

  for (const issue of issues) {
    issuesByRegulation[issue.regulation].push(issue);
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

export function buildScanTimelineFromResults(results: CanonicalScanResults[]): ScanTimelineItem[] {
  return results.map((result) => ({
    scanId: result.scanId,
    createdAt: result.createdAt,
    status: result.status,
    target: result.target,
    score: result.score,
    totalIssues: result.issues.length,
    severityCounts: { ...result.severityCounts },
  }));
}

export function buildScanTimeline(scans: ScanRecord[]): ScanTimelineItem[] {
  return buildScanTimelineFromResults(scans.map((scan) => buildCanonicalScanResults(scan)));
}
