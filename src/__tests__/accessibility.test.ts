import { describe, expect, it } from "vitest";
import axeViolations from "@/lib/scanner/accessibility-fixtures/axe-violations.json";
import { analyzeAccessibility, type AccessibilityViolation } from "@/lib/scanner/accessibility";

describe("analyzeAccessibility — static fallback", () => {
  it("finds deterministic WCAG signals in static HTML", () => {
    const result = analyzeAccessibility(`
      <html><head></head><body>
        <h1>Checkout</h1><h3>Payment</h3>
        <img src="/hero.jpg">
        <form><input id="email"><button></button></form>
        <a href="/next"></a>
      </body></html>
    `);

    expect(result.source).toBe("static");
    expect(result.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "accessibility.html-has-lang",
        "accessibility.document-title",
        "accessibility.image-alt",
        "accessibility.label",
        "accessibility.button-name",
        "accessibility.link-name",
        "accessibility.heading-order",
      ])
    );
    expect(result.score).toBeLessThan(40);
    expect(result.findings.every((finding) => finding.recommendation.length > 20)).toBe(true);
    expect(result.findings.every((finding) => finding.detail.includes("WCAG success criteria"))).toBe(true);
  });

  it("returns a perfect score for accessible static markup", () => {
    const result = analyzeAccessibility(`
      <html lang="en"><head><title>Checkout</title></head><body>
        <h1>Checkout</h1><h2>Payment</h2>
        <img src="/hero.jpg" alt="Product preview">
        <form><label for="email">Email</label><input id="email">
          <button type="submit">Pay now</button></form>
        <a href="/next">Continue</a>
      </body></html>
    `);
    expect(result.source).toBe("static");
    expect(result.score).toBe(100);
    expect(result.findings).toEqual([]);
  });
});

describe("analyzeAccessibility — axe mapping", () => {
  it("maps axe impact, WCAG tags, node selectors, and actionable remediation", () => {
    const result = analyzeAccessibility(
      '<html lang="en"><title>Test</title></html>',
      axeViolations as AccessibilityViolation[]
    );
    expect(result.source).toBe("axe");
    expect(result.score).toBe(47);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "accessibility.image-alt",
          severity: "critical",
          detail: expect.stringContaining("WCAG success criteria: 1.1.1, 4.1.2"),
        }),
        expect.objectContaining({
          id: "accessibility.color-contrast",
          severity: "critical",
          recommendation: expect.stringContaining("contrast ratio"),
        }),
        expect.objectContaining({
          id: "accessibility.heading-order",
          severity: "warning",
        }),
      ])
    );
  });

  it("does not replace an explicit empty axe result with static findings", () => {
    const result = analyzeAccessibility("<html><head></head><body><img></body></html>", []);
    expect(result.source).toBe("axe");
    expect(result.findings).toEqual([]);
    expect(result.score).toBe(100);
  });
});
