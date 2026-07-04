import { describe, it, expect } from "vitest";
import {
  generateCompliancePackage,
  exportToMarkdown,
  type ComplianceInput,
  type CompliancePackage,
} from "@/components/ClauseEngine";

// ─── generateCompliancePackage ──────────────────────────────────────────────

describe("generateCompliancePackage", () => {
  it("returns a complete package for a minimal developer input", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta"],
      targetRegions: ["us_general"],
    };
    const result = generateCompliancePackage(input);

    expect(result.inwardContractShield).toBeDefined();
    expect(result.inwardContractShield.preamble).toContain("Developer");
    expect(result.inwardContractShield.clauses.length).toBeGreaterThan(0);

    expect(result.consumerPrivacyPolicyAddendum).toBeDefined();
    expect(result.consumerPrivacyPolicyAddendum.header).toBeTruthy();
    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations.length).toBe(1);
    expect(result.consumerPrivacyPolicyAddendum.regionalDisclosures.length).toBe(1);

    expect(result.developerPreLaunchChecklist).toBeDefined();
    expect(result.developerPreLaunchChecklist.items.length).toBeGreaterThan(0);
    expect(result.developerPreLaunchChecklist.frameworkNotes).toBeTruthy();

    expect(result.complianceScore).toBeDefined();
    expect(result.complianceScore.overall).toBeGreaterThanOrEqual(0);
    expect(result.complianceScore.overall).toBeLessThanOrEqual(100);
  });

  it("returns merchant preamble for merchant userType", () => {
    const input: ComplianceInput = {
      userType: "merchant",
      framework: "wordpress",
      trackingPixels: ["google"],
      targetRegions: ["eu_gdpr"],
    };
    const result = generateCompliancePackage(input);

    expect(result.inwardContractShield.preamble).toContain("Merchant");
    expect(result.inwardContractShield.preamble).not.toMatch(
      /^This Inward Contract Shield Agreement.*Developer.*and the Store Merchant/
    );
  });

  it("includes framework-specific clauses for each framework", () => {
    const frameworks = ["shopify", "nextjs", "wordpress", "wix", "squarespace"] as const;

    for (const framework of frameworks) {
      const input: ComplianceInput = {
        userType: "developer",
        framework,
        trackingPixels: [],
        targetRegions: ["us_general"],
      };
      const result = generateCompliancePackage(input);
      expect(result.inwardContractShield.clauses.length).toBe(3);
    }
  });

  it("generates per-pixel script declarations", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "nextjs",
      trackingPixels: ["meta", "google", "tiktok", "linkedin", "pinterest", "snapchat"],
      targetRegions: ["us_general"],
    };
    const result = generateCompliancePackage(input);

    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations).toHaveLength(6);
    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations[0]).toContain("Meta");
    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations[1]).toContain("Google");
    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations[2]).toContain("TikTok");
    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations[3]).toContain("LinkedIn");
    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations[4]).toContain("Pinterest");
    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations[5]).toContain("Snap");
  });

  it("generates per-region regional disclosures", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta"],
      targetRegions: ["us_general", "california_ccpa", "eu_gdpr", "canada_pipeda", "brazil_lgpd", "australia_privacy"],
    };
    const result = generateCompliancePackage(input);

    expect(result.consumerPrivacyPolicyAddendum.regionalDisclosures).toHaveLength(6);
  });

  it("handles empty tracking pixels gracefully", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "shopify",
      trackingPixels: [],
      targetRegions: ["us_general"],
    };
    const result = generateCompliancePackage(input);

    expect(result.consumerPrivacyPolicyAddendum.scriptDeclarations).toHaveLength(0);
    expect(result.consumerPrivacyPolicyAddendum.header).toContain("No third-party tracking");
  });

  it("includes enterprise modules when specified", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "nextjs",
      trackingPixels: ["meta"],
      targetRegions: ["us_general"],
      complianceModules: ["hipaa", "pci_dss"],
    };
    const result = generateCompliancePackage(input);

    expect(result.enterpriseModules).toBeDefined();
    expect(result.enterpriseModules).toHaveLength(2);
    expect(result.enterpriseModules![0].moduleName).toContain("HIPAA");
    expect(result.enterpriseModules![1].moduleName).toContain("PCI-DSS");
  });

  it("omits enterprise modules when not specified", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta"],
      targetRegions: ["us_general"],
    };
    const result = generateCompliancePackage(input);

    expect(result.enterpriseModules).toBeUndefined();
  });

  it("includes Wix-specific clauses for Wix framework", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "wix",
      trackingPixels: ["linkedin"],
      targetRegions: ["canada_pipeda"],
    };
    const result = generateCompliancePackage(input);

    const clauseTitles = result.inwardContractShield.clauses.map((c) => c.title);
    expect(clauseTitles).toContain("Closed Platform Architecture Disclaimer");
    expect(clauseTitles).toContain("Wix App Market Liability Exclusion");
    expect(clauseTitles).toContain("Managed Infrastructure Limitation");
  });

  it("includes PIPEDA disclosure for canada_pipeda region", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta"],
      targetRegions: ["canada_pipeda"],
    };
    const result = generateCompliancePackage(input);

    const pipedaDisclosure = result.consumerPrivacyPolicyAddendum.regionalDisclosures.find((d) => d.includes("PIPEDA"));
    expect(pipedaDisclosure).toBeDefined();
    expect(pipedaDisclosure).toContain("Office of the Privacy Commissioner of Canada");
  });

  it("includes GDPR disclosure for eu_gdpr region", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "nextjs",
      trackingPixels: ["google"],
      targetRegions: ["eu_gdpr"],
    };
    const result = generateCompliancePackage(input);

    const gdprDisclosure = result.consumerPrivacyPolicyAddendum.regionalDisclosures.find((d) => d.includes("GDPR"));
    expect(gdprDisclosure).toBeDefined();
  });
});

// ─── calculateComplianceScore ───────────────────────────────────────────────

describe("calculateComplianceScore", () => {
  it("returns scores between 0 and 100 for all categories", () => {
    const input: ComplianceInput = {
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta", "google"],
      targetRegions: ["us_general", "eu_gdpr"],
      complianceModules: ["hipaa"],
    };
    const pkg = generateCompliancePackage(input);
    const score = pkg.complianceScore;

    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score.contractProtection).toBeGreaterThanOrEqual(0);
    expect(score.contractProtection).toBeLessThanOrEqual(100);
    expect(score.privacyCoverage).toBeGreaterThanOrEqual(0);
    expect(score.privacyCoverage).toBeLessThanOrEqual(100);
    expect(score.preLaunchReadiness).toBeGreaterThanOrEqual(0);
    expect(score.preLaunchReadiness).toBeLessThanOrEqual(100);
    expect(score.regulatoryBreadth).toBeGreaterThanOrEqual(0);
    expect(score.regulatoryBreadth).toBeLessThanOrEqual(100);
  });

  it("produces higher regulatory breadth for more regions", () => {
    const singleRegion = generateCompliancePackage({
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta"],
      targetRegions: ["us_general"],
    });
    const allRegions = generateCompliancePackage({
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta"],
      targetRegions: ["us_general", "california_ccpa", "eu_gdpr", "canada_pipeda", "brazil_lgpd", "australia_privacy"],
    });

    expect(allRegions.complianceScore.regulatoryBreadth).toBeGreaterThan(
      singleRegion.complianceScore.regulatoryBreadth
    );
  });
});

// ─── exportToMarkdown ───────────────────────────────────────────────────────

describe("exportToMarkdown", () => {
  let pkg: CompliancePackage;

  beforeAll(() => {
    pkg = generateCompliancePackage({
      userType: "developer",
      framework: "wix",
      trackingPixels: ["linkedin"],
      targetRegions: ["canada_pipeda"],
      complianceModules: ["hipaa"],
    });
  });

  it("starts with the compliance package report header", () => {
    const md = exportToMarkdown(pkg);
    expect(md).toMatch(/^# Compliance Package Report/);
  });

  it("includes the overall compliance score", () => {
    const md = exportToMarkdown(pkg);
    expect(md).toContain(`**Compliance Score: ${pkg.complianceScore.overall}/100**`);
  });

  it("includes all sections: contract shield, privacy, checklist, enterprise, score breakdown", () => {
    const md = exportToMarkdown(pkg);
    expect(md).toContain("## 1. Inward Contract Shield");
    expect(md).toContain("## 2. Consumer Privacy Policy Addendum");
    expect(md).toContain("## 3. Developer Pre-Launch Checklist");
    expect(md).toContain("## 4. Enterprise Compliance Modules");
    expect(md).toContain("## Compliance Score Breakdown");
  });

  it("includes the mandatory disclaimer", () => {
    const md = exportToMarkdown(pkg);
    expect(md).toContain("Comply-Quick is not a law firm");
  });

  it("includes enterprise module content when modules are present", () => {
    const md = exportToMarkdown(pkg);
    expect(md).toContain("HIPAA");
    expect(md).toContain("Business Associate Agreement");
  });

  it("omits enterprise section when no modules are present", () => {
    const noPkg = generateCompliancePackage({
      userType: "developer",
      framework: "shopify",
      trackingPixels: ["meta"],
      targetRegions: ["us_general"],
    });
    const md = exportToMarkdown(noPkg);
    expect(md).not.toContain("## 4. Enterprise Compliance Modules");
  });

  it("includes the score breakdown table with all categories", () => {
    const md = exportToMarkdown(pkg);
    expect(md).toContain("| Contract Protection |");
    expect(md).toContain("| Privacy Coverage |");
    expect(md).toContain("| Pre-Launch Readiness |");
    expect(md).toContain("| Regulatory Breadth |");
    expect(md).toContain("| **Overall** |");
  });
});
