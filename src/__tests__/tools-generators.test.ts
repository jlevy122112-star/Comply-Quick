import { describe, it, expect } from "vitest";
import { governingConsentModel, requiresDoNotSell, PIXEL_VENDORS, TRACKING_PIXELS } from "@/lib/tools/data";
import { generateConsentBanner } from "@/lib/tools/cookieConsent";
import { buildSubprocessorMap } from "@/lib/tools/subprocessors";
import { generateDpa } from "@/lib/tools/dpa";

describe("governingConsentModel", () => {
  it("picks the strictest model across regions", () => {
    expect(governingConsentModel(["us_general"])).toBe("notice");
    expect(governingConsentModel(["california_ccpa"])).toBe("opt-out");
    expect(governingConsentModel(["us_general", "eu_gdpr"])).toBe("opt-in");
  });

  it("defaults to the most protective model for empty input", () => {
    expect(governingConsentModel([])).toBe("opt-in");
  });
});

describe("requiresDoNotSell", () => {
  it("is true when a CCPA region is selected", () => {
    expect(requiresDoNotSell(["california_ccpa"])).toBe(true);
    expect(requiresDoNotSell(["eu_gdpr"])).toBe(false);
  });
});

describe("generateConsentBanner", () => {
  it("derives an opt-in banner and gates selected vendors for GDPR", () => {
    const res = generateConsentBanner({
      companyName: "Acme",
      privacyPolicyUrl: "/privacy",
      regions: ["eu_gdpr"],
      pixels: ["meta", "google"],
    });
    expect(res.consentModel).toBe("opt-in");
    expect(res.vendors.map((v) => v.id).sort()).toEqual(["google", "meta"]);
    expect(res.snippet).toContain("<style");
    expect(res.snippet).toContain("<script");
    expect(res.instructions.length).toBeGreaterThan(0);
  });

  it("includes a Do-Not-Sell control for CCPA", () => {
    const res = generateConsentBanner({
      companyName: "Acme",
      privacyPolicyUrl: "/privacy",
      regions: ["california_ccpa"],
      pixels: ["meta"],
    });
    expect(res.requiresDoNotSell).toBe(true);
  });

  it("escapes the company name to prevent HTML injection", () => {
    const res = generateConsentBanner({
      companyName: "<script>alert(1)</script>",
      privacyPolicyUrl: "/privacy",
      regions: ["eu_gdpr"],
      pixels: [],
    });
    expect(res.html).not.toContain("<script>alert(1)</script>");
  });

  it("rejects javascript: privacy-policy URLs in the generated banner", () => {
    const res = generateConsentBanner({
      companyName: "Acme",
      privacyPolicyUrl: "javascript:alert(document.cookie)",
      regions: ["eu_gdpr"],
      pixels: [],
    });
    expect(res.html).not.toContain("javascript:");
    expect(res.html).toContain('href="/privacy"');
  });

  it("preserves safe http(s) privacy-policy URLs", () => {
    const res = generateConsentBanner({
      companyName: "Acme",
      privacyPolicyUrl: "https://acme.com/privacy",
      regions: ["eu_gdpr"],
      pixels: [],
    });
    expect(res.html).toContain('href="https://acme.com/privacy"');
  });
});

describe("buildSubprocessorMap", () => {
  it("is fully derived from PIXEL_VENDORS", () => {
    const map = buildSubprocessorMap(["meta", "google"]);
    expect(map.rows).toHaveLength(2);
    expect(map.rows[0].vendor).toBe(PIXEL_VENDORS.meta.name);
    expect(map.csv.split("\n").length).toBeGreaterThan(2);
    expect(map.markdown).toContain("|");
  });

  it("returns no rows for no pixels", () => {
    expect(buildSubprocessorMap([]).rows).toHaveLength(0);
  });

  it("handles every known pixel", () => {
    const map = buildSubprocessorMap([...TRACKING_PIXELS]);
    expect(map.rows).toHaveLength(TRACKING_PIXELS.length);
  });
});

describe("generateDpa", () => {
  it("produces a DPA with a subprocessor annex derived from pixels", () => {
    const res = generateDpa({
      controllerName: "Client LLC",
      processorName: "Agency Ltd",
      regions: ["eu_gdpr", "california_ccpa"],
      pixels: ["meta", "google"],
      modules: ["soc2"],
    });
    expect(res.markdown).toContain("Data Processing Agreement");
    expect(res.markdown).toContain("Client LLC");
    expect(res.markdown).toContain("Annex II");
    expect(res.subprocessorCount).toBe(2);
    expect(res.sections.length).toBeGreaterThan(5);
    // SCC language appears for GDPR.
    expect(res.markdown).toContain("Standard Contractual Clauses");
    // Module clause appears for SOC 2.
    expect(res.markdown.toLowerCase()).toContain("soc 2");
  });

  it("falls back to placeholders and a default jurisdiction", () => {
    const res = generateDpa({ controllerName: "", processorName: "", regions: [], pixels: [] });
    expect(res.markdown).toContain("[Controller Legal Name]");
    expect(res.markdown).toContain("GDPR");
  });
});
