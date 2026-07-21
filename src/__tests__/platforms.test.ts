import { describe, it, expect } from "vitest";
import { listPlatforms, getPlatform, platformsForProduct } from "@/lib/platforms";
import { generatePlatformSnippet } from "@/lib/platforms/snippets";

describe("platform registry", () => {
  it("covers the most common website builders and CMSs", () => {
    const ids = listPlatforms().map((p) => p.id);
    expect(ids).toContain("shopify");
    expect(ids).toContain("wix");
    expect(ids).toContain("squarespace");
    expect(ids).toContain("webflow");
    expect(ids).toContain("wordpress");
    expect(ids).toContain("generic");
  });

  it("returns platform metadata by id", () => {
    const shopify = getPlatform("shopify");
    expect(shopify).toBeDefined();
    expect(shopify?.name).toBe("Shopify");
    expect(shopify?.products).toContain("cookie-banner");
  });

  it("filters platforms by supported product", () => {
    const cookieBannerPlatforms = platformsForProduct("cookie-banner");
    expect(cookieBannerPlatforms.some((p) => p.id === "shopify")).toBe(true);
    expect(cookieBannerPlatforms.some((p) => p.id === "godaddy")).toBe(false);
  });

  it("provides instructions for every platform", () => {
    for (const platform of listPlatforms()) {
      expect(platform.instructions.length).toBeGreaterThan(0);
    }
  });
});

describe("platform snippets", () => {
  it("returns null for an unknown platform", () => {
    const result = generatePlatformSnippet("unknown-platform", {
      companyName: "Acme",
      privacyPolicyUrl: "/privacy",
      regions: ["eu_gdpr"],
      pixels: [],
    });
    expect(result).toBeNull();
  });

  it("wraps Shopify snippets in Liquid comments", () => {
    const result = generatePlatformSnippet("shopify", {
      companyName: "Acme",
      privacyPolicyUrl: "/privacy",
      regions: ["eu_gdpr"],
      pixels: ["meta"],
    });
    expect(result).not.toBeNull();
    expect(result!.language).toBe("liquid");
    expect(result!.snippet).toContain("{% comment %}");
    expect(result!.snippet).toContain("cq-consent");
  });

  it("wraps WordPress snippets in PHP comment framing", () => {
    const result = generatePlatformSnippet("wordpress", {
      companyName: "Acme",
      privacyPolicyUrl: "/privacy",
      regions: ["california_ccpa"],
      pixels: ["google"],
    });
    expect(result).not.toBeNull();
    expect(result!.language).toBe("php");
    expect(result!.snippet).toContain("<?php // Add to footer.php");
  });

  it("keeps generic snippets as HTML", () => {
    const result = generatePlatformSnippet("generic", {
      companyName: "Acme",
      privacyPolicyUrl: "/privacy",
      regions: ["eu_gdpr"],
      pixels: ["google"],
    });
    expect(result).not.toBeNull();
    expect(result!.language).toBe("html");
    expect(result!.snippet).toContain("site-wide header/footer code");
  });
});
