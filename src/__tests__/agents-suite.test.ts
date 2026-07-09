import { describe, it, expect } from "vitest";
import { planCopilotActions } from "@/lib/agents/compliance-copilot";
import { planScanToFix, remediationForFinding } from "@/lib/agents/scan-to-fix";
import { monitorPortfolio, assessProject, type PortfolioProject } from "@/lib/agents/portfolio-monitor";
import { compileEvidencePack } from "@/lib/agents/audit-evidence";
import { planOnboarding, classifyIndustry } from "@/lib/agents/onboarding";
import { successNudges, planSuccessActions } from "@/lib/agents/success-upsell";
import { reviewOutput } from "@/lib/agents/qa";
import { AGENT_REGISTRY, INDUSTRY_PROFILE, TARGET_INDUSTRIES } from "@/lib/agents/types";
import { ALL_FRAMEWORK_IDS } from "@/lib/regulations/sources/registry";
import type { ScanAnalysis, Finding } from "@/lib/scanner/analyzer";
import type { RegulationControl } from "@/lib/regulations/types";

describe("agent registry", () => {
  it("registers at least the 5 required agents, all approval-based", () => {
    const ids = Object.keys(AGENT_REGISTRY);
    expect(ids).toEqual(
      expect.arrayContaining([
        "compliance_copilot",
        "scan_to_fix",
        "autopilot_remediation",
        "portfolio_monitor",
        "audit_evidence",
      ])
    );
    expect(ids.length).toBeGreaterThanOrEqual(5);
  });
});

describe("industry coverage", () => {
  it("maps every registered framework to at least one industry", () => {
    const mapped = new Set(TARGET_INDUSTRIES.flatMap((i) => INDUSTRY_PROFILE[i].frameworks));
    const orphans = ALL_FRAMEWORK_IDS.filter((f) => !mapped.has(f));
    expect(orphans).toEqual([]);
  });
});

describe("compliance copilot", () => {
  it("emits approval-gated actions for a detected intent", () => {
    const plan = planCopilotActions("please scan my site and generate a cookie banner", {});
    expect(plan.actions.every((a) => a.requiresApproval === true)).toBe(true);
    expect(plan.actions.map((a) => a.type)).toEqual(expect.arrayContaining(["run_scan", "generate_cookie_banner"]));
  });

  it("falls back to a scan+review default when nothing is detected", () => {
    const plan = planCopilotActions("hello", {});
    expect(plan.actions.map((a) => a.type)).toEqual(["run_scan", "schedule_review"]);
  });

  it("suppresses banner generation when one already exists", () => {
    const plan = planCopilotActions("cookie banner", { hasConsentBanner: true });
    expect(plan.actions.some((a) => a.type === "generate_cookie_banner")).toBe(false);
  });
});

describe("scan-to-fix", () => {
  const analysis: ScanAnalysis = {
    detectedTools: [],
    hasConsentBanner: false,
    hasPrivacyPolicy: false,
    score: 55,
    findings: [
      {
        id: "consent-missing",
        title: "No consent banner",
        severity: "critical",
        detail: "",
        recommendation: "Add a consent banner / CMP",
      },
      {
        id: "policy-missing",
        title: "No privacy policy",
        severity: "warning",
        detail: "",
        recommendation: "Publish a privacy policy",
      },
      { id: "info-1", title: "Minor note", severity: "info", detail: "", recommendation: "Nothing required" },
    ],
  };

  it("routes findings to the right remediation artifacts", () => {
    expect(remediationForFinding(analysis.findings[0])).toBe("generate_cookie_banner");
    expect(remediationForFinding(analysis.findings[1])).toBe("generate_policy");
    expect(remediationForFinding(analysis.findings[2])).toBeNull();
  });

  it("prioritizes critical findings first and dedupes by type", () => {
    const plan = planScanToFix({ analysis, projectId: "p1" });
    expect(plan.actions[0].type).toBe("generate_cookie_banner");
    const types = plan.actions.map((a) => a.type);
    expect(new Set(types).size).toBe(types.length);
    expect(plan.actions.every((a) => a.requiresApproval)).toBe(true);
  });

  it("returns an empty plan when only info findings exist", () => {
    const info: Finding[] = [{ id: "x", title: "ok", severity: "info", detail: "", recommendation: "n/a" }];
    const plan = planScanToFix({ analysis: { ...analysis, findings: info } });
    expect(plan.actions).toHaveLength(0);
  });
});

describe("portfolio monitor", () => {
  const now = new Date("2026-07-08T00:00:00Z");
  const base: PortfolioProject = {
    id: "p",
    name: "Site",
    clientName: "Acme",
    complianceScore: 92,
    status: "current",
    lastUpdated: "2026-06-01T00:00:00Z",
    pendingProposals: 0,
  };

  it("flags a low-score / action-needed project as at-risk", () => {
    const a = assessProject({ ...base, complianceScore: 50, status: "action_needed" }, now);
    expect(a.band).toBe("at_risk");
    expect(a.reasons.length).toBeGreaterThan(0);
  });

  it("marks a healthy project healthy and drafts no report", () => {
    const { atRisk, plan } = monitorPortfolio([base], now);
    expect(atRisk).toHaveLength(0);
    expect(plan.actions).toHaveLength(0);
  });

  it("drafts a client report action per at-risk client", () => {
    const { plan, atRisk } = monitorPortfolio(
      [
        { ...base, complianceScore: 40 },
        { ...base, id: "p2", clientName: "Beta", pendingProposals: 2, complianceScore: 70 },
      ],
      now
    );
    expect(atRisk).toHaveLength(1);
    expect(plan.actions.every((a) => a.type === "draft_client_report" && a.requiresApproval)).toBe(true);
  });

  it("treats a stale project as at-risk", () => {
    const a = assessProject({ ...base, lastUpdated: "2025-01-01T00:00:00Z" }, now);
    expect(a.band).toBe("at_risk");
  });
});

describe("audit & evidence", () => {
  const controls: RegulationControl[] = [
    {
      framework: "soc2",
      id: "CC1.1",
      title: "Control Environment",
      description: "d",
      requirements: [],
      evidenceExamples: ["Org chart"],
      riskLevel: "medium",
      remediationSteps: [],
      sourceText: null,
      sourceUrl: "https://x",
    },
    {
      framework: "soc2",
      id: "CC6.1",
      title: "Logical Access",
      description: "d",
      requirements: [],
      evidenceExamples: [],
      riskLevel: "high",
      remediationSteps: [],
      sourceText: null,
      sourceUrl: "https://x",
    },
  ];

  it("computes readiness from the evidence ledger", () => {
    const pack = compileEvidencePack("soc2", controls, { "CC1.1": true });
    expect(pack.collected).toBe(1);
    expect(pack.missing).toBe(1);
    expect(pack.readiness).toBe(50);
  });

  it("offers an approval-gated compile action and lists required evidence", () => {
    const pack = compileEvidencePack("soc2", controls, {});
    expect(pack.plan.actions[0].type).toBe("compile_evidence");
    expect(pack.plan.actions[0].requiresApproval).toBe(true);
    expect(pack.items[1].requiredEvidence.length).toBeGreaterThan(0);
  });

  it("excludes not_applicable controls from readiness", () => {
    const pack = compileEvidencePack("soc2", controls, { "CC1.1": true, "CC6.1": "not_applicable" });
    expect(pack.items.find((i) => i.controlId === "CC6.1")?.status).toBe("not_applicable");
    expect(pack.collected).toBe(1);
    expect(pack.missing).toBe(0);
    expect(pack.readiness).toBe(100);
  });
});

describe("onboarding agent", () => {
  it("classifies health data as healthcare regardless of description", () => {
    expect(classifyIndustry({ description: "a store", handlesHealthData: true })).toBe("healthcare");
  });

  it("classifies from description keywords and falls back to general_web", () => {
    expect(classifyIndustry({ description: "online shop with checkout" })).toBe("ecommerce");
    expect(classifyIndustry({ description: "a b2b saas platform" })).toBe("saas");
    expect(classifyIndustry({ description: "just a blog" })).toBe("general_web");
  });

  it("prefers the specific industry when broad saas words co-occur", () => {
    // "app"/"platform"/"dashboard" must not shadow healthcare/fintech terms.
    expect(classifyIndustry({ description: "health app" })).toBe("healthcare");
    expect(classifyIndustry({ description: "therapy platform" })).toBe("healthcare");
    expect(classifyIndustry({ description: "payment dashboard" })).toBe("fintech");
    expect(classifyIndustry({ description: "investment app" })).toBe("fintech");
  });

  it("does not false-match broad substrings without word boundaries", () => {
    expect(classifyIndustry({ description: "a supermarket loyalty tool" })).not.toBe("marketing_adtech");
    expect(classifyIndustry({ description: "we keep customers happy" })).toBe("general_web");
  });

  it("recommends frameworks + an approval-gated setup plan", () => {
    const rec = planOnboarding({ description: "b2b saas", servesEu: true });
    expect(rec.frameworks.length).toBeGreaterThan(0);
    expect(rec.regions).toContain("eu_gdpr");
    expect(rec.plan.actions.every((a) => a.requiresApproval === true)).toBe(true);
    expect(rec.plan.actions.map((a) => a.type)).toContain("configure_modules");
  });
});

describe("success agent", () => {
  const base = {
    tier: "free",
    nextTier: "solo",
    scansUsed: 2,
    scanLimit: 10,
    scoreDelta: 0,
    pendingProposals: 0,
    missingModules: [],
  };

  it("nudges to upgrade when the scan limit is reached", () => {
    const nudges = successNudges({ ...base, scansUsed: 10 });
    expect(nudges.some((n) => n.key === "scan_limit_reached")).toBe(true);
  });

  it("nudges on rising risk and pending proposals, ranked", () => {
    const nudges = successNudges({ ...base, scoreDelta: -8, pendingProposals: 2 });
    expect(nudges[0].priority).toBeGreaterThanOrEqual(nudges[nudges.length - 1].priority);
    expect(nudges.some((n) => n.key === "risk_rising")).toBe(true);
    expect(nudges.some((n) => n.key === "pending_proposals")).toBe(true);
  });

  it("returns a healthy (empty) plan when there is nothing to do", () => {
    const { nudges, plan } = planSuccessActions(base);
    expect(nudges).toHaveLength(0);
    expect(plan.actions).toHaveLength(0);
  });
});

describe("qa agent", () => {
  const body = "A".repeat(300) + " https://example.gov/rule Introduction and Scope and Definitions";

  it("passes a complete document with required sections + source", () => {
    const report = reviewOutput({ content: body, requiredSections: ["Introduction", "Scope"], requiresSource: true });
    expect(report.passed).toBe(true);
    expect(report.plan).toBeUndefined();
  });

  it("blocks on missing sections, placeholders, or short output", () => {
    const report = reviewOutput({ content: "too short [TODO: fill]", requiredSections: ["Scope"] });
    expect(report.passed).toBe(false);
    expect(report.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["too_short", "missing_section", "unfilled_placeholder"])
    );
    expect(report.plan?.actions[0].type).toBe("review_output");
  });
});
