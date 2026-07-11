import { describe, it, expect } from "vitest";
import { detectToolsDetailed } from "@/lib/scanner/analyzer";
import { deriveObligations } from "@/lib/compliance/traverse";
import { lintCompliance, type ComplianceState } from "@/lib/compliance/linter";
import { buildObligationReport } from "@/lib/compliance/report";
import { getObligation, OBLIGATION_NODES } from "@/lib/compliance/graph";
import { getService, SERVICE_CATALOG } from "@/lib/compliance/catalog";

const GA_RUNTIME = ["https://www.googletagmanager.com/gtag/js?id=G-XXX", "https://www.google-analytics.com/g/collect"];
const STRIPE_HTML = `<html><body><script src="https://js.stripe.com/v3/"></script><script>Stripe('pk_live_x')</script></body></html>`;

describe("detectToolsDetailed — confidence + layer", () => {
  it("scores a runtime-corroborated tool higher than an html-only mention", () => {
    const runtime = detectToolsDetailed("", GA_RUNTIME);
    const htmlOnly = detectToolsDetailed('<a href="https://google-analytics.com">GA</a>', []);
    const g1 = runtime.find((d) => d.id === "google");
    const g2 = htmlOnly.find((d) => d.id === "google");
    expect(g1).toBeDefined();
    expect(g2).toBeDefined();
    expect(g1!.layer).toBe("runtime");
    expect(g2!.layer).toBe("html");
    expect(g1!.confidence).toBeGreaterThan(g2!.confidence);
  });

  it("marks cross-layer agreement as 'both' with the highest confidence", () => {
    const detected = detectToolsDetailed(STRIPE_HTML, ["https://checkout.stripe.com/pay"]);
    const stripe = detected.find((d) => d.id === "stripe");
    expect(stripe).toBeDefined();
    expect(stripe!.layer).toBe("both");
    expect(stripe!.confidence).toBeGreaterThanOrEqual(0.85);
    expect(stripe!.signals.length).toBeGreaterThan(0);
  });

  it("returns confidence within [0,1]", () => {
    for (const d of detectToolsDetailed(STRIPE_HTML, GA_RUNTIME)) {
      expect(d.confidence).toBeGreaterThanOrEqual(0);
      expect(d.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("graph + catalog integrity", () => {
  it("every catalog obligation reference resolves to a real graph node", () => {
    for (const entry of SERVICE_CATALOG) {
      for (const id of entry.triggersObligations) {
        expect(getObligation(id), `unknown obligation ${id} on ${entry.id}`).toBeDefined();
      }
    }
  });

  it("every obligation node carries provenance with a source URL", () => {
    for (const node of OBLIGATION_NODES) {
      expect(node.provenance.url).toMatch(/^https?:\/\//);
      expect(node.provenance.source.length).toBeGreaterThan(0);
    }
  });
});

describe("deriveObligations — deterministic traversal", () => {
  it("maps Stripe to a DPA obligation with a traceable path to the DPA url", () => {
    const results = deriveObligations({ services: ["stripe"], jurisdictions: ["eu"] });
    const dpa = results.find((r) => r.obligation.id === "gdpr.art28.dpa");
    expect(dpa).toBeDefined();
    expect(dpa!.triggeredBy).toContain("Stripe");
    expect(dpa!.path).toContain(getService("stripe")!.dpaUrl!);
  });

  it("de-duplicates a shared obligation and credits every triggering service", () => {
    const results = deriveObligations({ services: ["google", "stripe"], jurisdictions: ["eu"] });
    const dpa = results.filter((r) => r.obligation.id === "gdpr.art28.dpa");
    expect(dpa).toHaveLength(1);
    expect(dpa[0].triggeredBy).toEqual(expect.arrayContaining(["Google Analytics / Ads", "Stripe"]));
  });

  it("maps a joint controller (Meta) to Art. 26, not the processor DPA", () => {
    const results = deriveObligations({ services: ["meta"], jurisdictions: ["eu"] });
    expect(results.some((r) => r.obligation.id === "gdpr.art26.joint_controller")).toBe(true);
    expect(results.some((r) => r.obligation.id === "gdpr.art28.dpa")).toBe(false);
  });

  it("filters obligations by jurisdiction (no CCPA node for an EU-only site)", () => {
    const euOnly = deriveObligations({ services: ["google"], jurisdictions: ["eu"] });
    expect(euOnly.some((r) => r.obligation.framework === "ccpa")).toBe(false);
    const caOnly = deriveObligations({ services: ["google"], jurisdictions: ["us_ca"] });
    expect(caOnly.some((r) => r.obligation.framework === "ccpa")).toBe(true);
  });

  it("derives transfer safeguards only when a non-EU vendor is present (not for an all-EU stack)", () => {
    // Hotjar is EU-based → no cross-border transfer obligation.
    const euOnly = deriveObligations({ services: ["hotjar"], jurisdictions: ["eu"] });
    expect(euOnly.some((r) => r.obligation.id === "gdpr.art46.transfers")).toBe(false);
    // Add a US vendor → the transfer obligation is now derived, triggered by it.
    const withUs = deriveObligations({ services: ["hotjar", "google"], jurisdictions: ["eu"] });
    const transfer = withUs.find((r) => r.obligation.id === "gdpr.art46.transfers");
    expect(transfer).toBeDefined();
    expect(transfer!.triggeredBy).toContain("Google Analytics / Ads");
    expect(transfer!.triggeredBy).not.toContain("Hotjar");
  });

  it("does not derive transfer safeguards outside the EU/UK even with a US vendor", () => {
    const usOnly = deriveObligations({ services: ["google"], jurisdictions: ["us_ca"] });
    expect(usOnly.some((r) => r.obligation.id === "gdpr.art46.transfers")).toBe(false);
  });

  it("requires a privacy notice for a payment-only site but not consent (contractual necessity)", () => {
    const results = deriveObligations({ services: ["stripe"], jurisdictions: ["eu"] });
    expect(results.some((r) => r.obligation.id === "gdpr.art13.privacy_notice")).toBe(true);
    expect(results.some((r) => r.obligation.id === "gdpr.art7.consent")).toBe(false);
  });

  it("sorts critical obligations before info", () => {
    const results = deriveObligations({ services: ["google"], jurisdictions: ["eu", "us_ca"] });
    const severities = results.map((r) => r.obligation.severity);
    const firstInfo = severities.indexOf("info");
    const lastCritical = severities.lastIndexOf("critical");
    if (firstInfo !== -1 && lastCritical !== -1) expect(lastCritical).toBeLessThan(firstInfo);
  });
});

describe("lintCompliance — rule-based checker", () => {
  const base: ComplianceState = {
    services: ["stripe", "google"],
    jurisdictions: ["eu"],
    hasPrivacyPolicy: true,
    hasConsentMechanism: true,
    dpaWith: ["stripe", "google"],
    mentionsSccs: true,
    addressesPci: true,
  };

  it("passes clean when everything is covered", () => {
    expect(lintCompliance(base)).toHaveLength(0);
  });

  it("errors when a processor has no DPA", () => {
    const findings = lintCompliance({ ...base, dpaWith: ["google"] });
    expect(findings.some((f) => f.id === "missing_dpa_stripe" && f.severity === "error")).toBe(true);
  });

  it("errors when a joint controller (Meta) has no Art. 26 arrangement", () => {
    const withMeta: ComplianceState = { ...base, services: [...base.services, "meta"] };
    const findings = lintCompliance(withMeta);
    expect(findings.some((f) => f.id === "missing_jca_meta" && f.severity === "error")).toBe(true);
    const covered = lintCompliance({ ...withMeta, jointControllerArrangements: ["meta"] });
    expect(covered.some((f) => f.id === "missing_jca_meta")).toBe(false);
  });

  it("errors on trackers without consent in the EU, warns elsewhere", () => {
    const eu = lintCompliance({ ...base, hasConsentMechanism: false });
    expect(eu.find((f) => f.id === "trackers_without_consent")!.severity).toBe("error");
    const us = lintCompliance({
      ...base,
      jurisdictions: ["us_general"],
      hasConsentMechanism: false,
      mentionsSccs: true,
    });
    expect(us.find((f) => f.id === "trackers_without_consent")!.severity).toBe("warning");
  });

  it("errors when EU data goes to a non-EU vendor without SCCs", () => {
    const findings = lintCompliance({ ...base, mentionsSccs: false });
    expect(findings.some((f) => f.id === "transfers_without_sccs" && f.severity === "error")).toBe(true);
  });

  it("warns when payments are present but PCI is not addressed", () => {
    const findings = lintCompliance({ ...base, addressesPci: false });
    expect(findings.some((f) => f.id === "pci_not_addressed" && f.severity === "warning")).toBe(true);
  });

  it("sorts errors before warnings", () => {
    const findings = lintCompliance({ ...base, addressesPci: false, dpaWith: ["google"] });
    expect(findings[0].severity).toBe("error");
  });
});

describe("buildObligationReport — orchestration", () => {
  it("ties detection to obligations and computes detection confidence", () => {
    const report = buildObligationReport({ html: STRIPE_HTML, requestUrls: GA_RUNTIME, jurisdictions: ["eu"] });
    expect(report.detected.map((d) => d.id)).toEqual(expect.arrayContaining(["stripe", "google"]));
    expect(report.obligations.some((o) => o.obligation.id === "gdpr.art28.dpa")).toBe(true);
    expect(report.detectionConfidence).toBeGreaterThan(0);
    expect(report.dataCategories).toEqual(expect.arrayContaining(["financial", "online_activity"]));
  });

  it("returns zero confidence and no obligations for a clean page", () => {
    const report = buildObligationReport({ html: "<html><body>hello</body></html>", jurisdictions: ["eu"] });
    expect(report.detected).toHaveLength(0);
    expect(report.obligations).toHaveLength(0);
    expect(report.detectionConfidence).toBe(0);
  });
});
