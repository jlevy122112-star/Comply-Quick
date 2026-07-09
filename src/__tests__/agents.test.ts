import { describe, it, expect } from "vitest";
import { detectChanges, type SourceHashObservation } from "@/lib/agents/regulation-monitor";
import { buildEditPlan, buildEditPlanStep, remediationUpdatesFromFindings } from "@/lib/agents/autopilot-remediation";
import { industriesForFramework, regionsForFramework, frameworksForIndustry } from "@/lib/agents/classify";
import type { RegulationChangeFinding } from "@/lib/agents/types";
import {
  hashControls,
  hashPageText,
  normalizeOscal,
  normalizeReferenceOnly,
  normalizeEcfrStructure,
  inferRisk,
} from "@/services/regulation_ingestion";
import { REGULATION_SOURCES, ALL_FRAMEWORK_IDS } from "@/lib/regulations/sources/registry";

const AT = "2026-07-08T00:00:00.000Z";

describe("regulation source registry", () => {
  it("covers many agencies across jurisdictions", () => {
    expect(ALL_FRAMEWORK_IDS.length).toBeGreaterThanOrEqual(20);
    const institutions = new Set(Object.values(REGULATION_SOURCES).map((s) => s.institution));
    expect(institutions.size).toBeGreaterThanOrEqual(10);
  });

  it("never marks proprietary sources as full-text ingestible", () => {
    for (const s of Object.values(REGULATION_SOURCES)) {
      if (s.license === "proprietary") expect(s.ingestFullText).toBe(false);
    }
  });
});

describe("classify", () => {
  it("maps a framework to in-profile industries and regions", () => {
    expect(industriesForFramework("hipaa")).toContain("healthcare");
    expect(regionsForFramework("gdpr")).toContain("eu_gdpr");
    expect(frameworksForIndustry("fintech")).toContain("pci_dss");
  });
});

describe("detectChanges", () => {
  const obs = (framework: string, previousHash: string | null, currentHash: string): SourceHashObservation => ({
    framework: framework as SourceHashObservation["framework"],
    previousHash,
    currentHash,
  });

  it("raises a finding for a newly-learned source (no previous hash)", () => {
    const findings = detectChanges([obs("gdpr", null, "AAA")], AT);
    expect(findings).toHaveLength(1);
    expect(findings[0].framework).toBe("gdpr");
    expect(findings[0].affectedIndustries.length).toBeGreaterThan(0);
  });

  it("raises a finding when the hash changed", () => {
    const findings = detectChanges([obs("hipaa", "OLD", "NEW")], AT);
    expect(findings).toHaveLength(1);
  });

  it("ignores unchanged sources", () => {
    const findings = detectChanges([obs("ccpa", "SAME", "SAME")], AT);
    expect(findings).toHaveLength(0);
  });

  it("skips unknown frameworks", () => {
    const findings = detectChanges([obs("not_a_real_framework", null, "X")], AT);
    expect(findings).toHaveLength(0);
  });
});

describe("remediation edit plan", () => {
  const finding: RegulationChangeFinding = {
    framework: "gdpr",
    label: "GDPR",
    institution: "EU",
    officialUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
    previousHash: "OLD",
    currentHash: "NEW",
    affectedIndustries: ["saas", "general_web"],
    affectedRegions: ["eu_gdpr", "us_general"],
    detectedAt: AT,
  };

  it("builds an approval-gated edit-plan step", () => {
    const step = buildEditPlanStep(finding);
    expect(step.requiresApproval).toBe(true);
    expect(step.law).toBe("GDPR");
    expect(step.affectedIndustries.length).toBe(2);
  });

  it("distinguishes new-baseline from update wording", () => {
    const newStep = buildEditPlanStep({ ...finding, previousHash: null });
    expect(newStep.action).toMatch(/baseline/i);
    expect(buildEditPlanStep(finding).action).toMatch(/update/i);
  });

  it("emits one autopilot update per affected region", () => {
    const updates = remediationUpdatesFromFindings([finding]);
    expect(updates).toHaveLength(2);
    expect(updates.map((u) => u.region).sort()).toEqual(["eu_gdpr", "us_general"]);
    for (const u of updates) expect(typeof u.content).toBe("string");
  });

  it("builds a plan per finding", () => {
    expect(buildEditPlan([finding, finding])).toHaveLength(2);
  });

  it("dedupes autopilot updates that share a framework:region pair", () => {
    const dup = { ...finding, currentHash: "NEWER" };
    const updates = remediationUpdatesFromFindings([finding, dup]);
    const ids = updates.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    // last write wins
    expect(updates.find((u) => u.id === "gdpr:eu_gdpr")?.content).toContain("NEWER");
  });
});

describe("ingestion normalizers", () => {
  it("hashes controls stably and order-independently", () => {
    const a = [
      { id: "A", title: "t", description: "d", requirements: ["x"] },
      { id: "B", title: "t2", description: "d2", requirements: ["y"] },
    ];
    const c1 = hashControls(a as never);
    const c2 = hashControls([...a].reverse() as never);
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[0-9A-F]{16}$/);
  });

  it("strips markup before hashing page text (ignores cosmetic churn)", () => {
    const h1 = hashPageText("<div><script>x=1</script>Hello <b>World</b></div>");
    const h2 = hashPageText("<section>  Hello   World  </section>");
    expect(h1).toBe(h2);
  });

  it("normalizes an OSCAL catalog into controls", () => {
    const raw = {
      catalog: {
        groups: [
          {
            title: "Access Control",
            controls: [
              {
                id: "ac-2",
                title: "Account Management",
                parts: [{ name: "statement", prose: "Manage system accounts with encryption." }],
              },
            ],
          },
        ],
      },
    };
    const out = normalizeOscal(raw, REGULATION_SOURCES.nist_800_53, "nist_800_53");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("AC-2");
    expect(out[0].sourceText).not.toBeNull();
    expect(out[0].riskLevel).toBe("high");
  });

  it("does not duplicate nested control enhancements in nested groups", () => {
    const raw = {
      catalog: {
        groups: [
          {
            title: "Access Control",
            groups: [
              {
                title: "Sub",
                controls: [
                  {
                    id: "ac-2",
                    title: "Account Management",
                    parts: [{ name: "statement", prose: "Manage accounts." }],
                    controls: [
                      { id: "ac-2.1", title: "Automated", parts: [{ name: "statement", prose: "Automate it." }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    const out = normalizeOscal(raw, REGULATION_SOURCES.nist_800_53, "nist_800_53");
    const ids = out.map((c) => c.id);
    expect(ids).toEqual(["AC-2", "AC-2.1"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("extracts real section ids/titles from an eCFR structure without fabricating text", () => {
    const raw = {
      type: "title",
      children: [
        {
          type: "part",
          identifier: "164",
          children: [
            {
              type: "section",
              identifier: "164.308",
              label: "§ 164.308",
              label_description: "Administrative safeguards.",
            },
            { type: "section", identifier: "164.312", label: "§ 164.312", label_description: "Technical safeguards." },
          ],
        },
      ],
    };
    const out = normalizeEcfrStructure(raw, REGULATION_SOURCES.hipaa, "hipaa");
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("§ 164.308");
    expect(out[0].title).toBe("Administrative safeguards.");
    for (const c of out) expect(c.sourceText).toBeNull();
  });

  it("builds reference-only controls without storing licensed text", () => {
    const out = normalizeReferenceOnly(REGULATION_SOURCES.soc2, "soc2");
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) expect(c.sourceText).toBeNull();
  });

  it("infers risk from keywords", () => {
    expect(inferRisk("data breach notification")).toBe("high");
    expect(inferRisk("audit log retention")).toBe("medium");
    expect(inferRisk("general provision")).toBe("low");
  });
});
