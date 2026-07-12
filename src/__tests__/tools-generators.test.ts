import { describe, it, expect } from "vitest";
import { governingConsentModel, requiresDoNotSell, PIXEL_VENDORS, TRACKING_PIXELS } from "@/lib/tools/data";
import { generateConsentBanner } from "@/lib/tools/cookieConsent";
import { generateCookiePolicy } from "@/lib/tools/cookiePolicy";
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

describe("generateCookiePolicy", () => {
  it("derives an opt-in policy with a per-vendor disclosure table for GDPR", () => {
    const res = generateCookiePolicy({
      companyName: "Acme",
      privacyPolicyUrl: "/privacy",
      regions: ["eu_gdpr"],
      pixels: ["meta", "google"],
      effectiveDate: "2026-01-15",
    });
    expect(res.consentModel).toBe("opt-in");
    expect(res.vendors.map((v) => v.vendor)).toContain(PIXEL_VENDORS.meta.name);
    expect(res.markdown).toContain("# Cookie Policy");
    expect(res.markdown).toContain(PIXEL_VENDORS.google.company);
    expect(res.html).toContain("<h1>Cookie Policy</h1>");
    // Analytics/advertising are gated under opt-in.
    const advertising = res.categories.find((c) => c.key === "advertising");
    expect(advertising?.consentRequired).toBe(true);
  });

  it("includes a Do-Not-Sell clause for CCPA and honors GPC", () => {
    const res = generateCookiePolicy({
      companyName: "Acme",
      regions: ["california_ccpa"],
      pixels: ["meta"],
    });
    expect(res.requiresDoNotSell).toBe(true);
    expect(res.markdown).toContain("Do Not Sell or Share My Personal Information");
    expect(res.markdown).toContain("Global Privacy Control");
  });

  it("states no third-party technologies when no pixels are selected", () => {
    const res = generateCookiePolicy({ companyName: "Acme", regions: ["eu_gdpr"], pixels: [] });
    expect(res.vendors).toHaveLength(0);
    expect(res.markdown).toContain("only strictly necessary cookies");
  });

  it("escapes the company name to prevent HTML injection", () => {
    const res = generateCookiePolicy({
      companyName: "<script>alert(1)</script>",
      regions: ["eu_gdpr"],
      pixels: [],
    });
    expect(res.html).not.toContain("<script>alert(1)</script>");
  });

  it("rejects javascript: privacy-policy URLs in the rendered HTML", () => {
    const res = generateCookiePolicy({
      companyName: "Acme",
      privacyPolicyUrl: "javascript:alert(document.cookie)",
      regions: ["eu_gdpr"],
      pixels: [],
    });
    expect(res.html).not.toContain("javascript:");
    expect(res.html).toContain('href="/privacy"');
  });

  it("derives a deterministic policy version that changes with disclosures", () => {
    const a = generateCookiePolicy({
      companyName: "Acme",
      regions: ["eu_gdpr"],
      pixels: ["meta"],
      effectiveDate: "2026-01-15",
    });
    const b = generateCookiePolicy({
      companyName: "Acme",
      regions: ["eu_gdpr"],
      pixels: ["meta"],
      effectiveDate: "2026-01-15",
    });
    const c = generateCookiePolicy({
      companyName: "Acme",
      regions: ["eu_gdpr"],
      pixels: ["meta", "google"],
      effectiveDate: "2026-01-15",
    });
    expect(a.policyVersion).toBe(b.policyVersion);
    expect(a.policyVersion).not.toBe(c.policyVersion);
    expect(a.policyVersion.startsWith("2026-01-15.")).toBe(true);
  });

  it("defaults the effective date when omitted or malformed", () => {
    const res = generateCookiePolicy({ companyName: "Acme", regions: ["eu_gdpr"], pixels: [], effectiveDate: "nope" });
    expect(res.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
