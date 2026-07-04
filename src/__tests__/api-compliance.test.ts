import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/compliance/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/compliance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/compliance", () => {
  it("returns 200 with valid input", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
        framework: "shopify",
        trackingPixels: ["meta"],
        targetRegions: ["us_general"],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.inwardContractShield).toBeDefined();
    expect(data.data.complianceScore).toBeDefined();
    expect(data.meta.version).toBe("2.0.0");
    expect(data.meta.tier).toBe("standard");
  });

  it("returns enterprise tier when modules are specified", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
        framework: "nextjs",
        trackingPixels: ["meta"],
        targetRegions: ["us_general"],
        complianceModules: ["hipaa"],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.meta.tier).toBe("enterprise");
    expect(data.data.enterpriseModules).toHaveLength(1);
  });

  it("returns markdown when format=markdown", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
        framework: "shopify",
        trackingPixels: ["meta"],
        targetRegions: ["us_general"],
        format: "markdown",
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(res.headers.get("Content-Disposition")).toContain("compliance-package.md");

    const text = await res.text();
    expect(text).toContain("# Compliance Package Report");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid request body");
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new NextRequest("http://localhost:3001/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 422 for invalid framework", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
        framework: "angular",
        trackingPixels: ["meta"],
        targetRegions: ["us_general"],
      })
    );

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.errors).toBeDefined();
    expect(data.errors[0]).toContain("angular");
  });

  it("returns 422 for invalid tracking pixel", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
        framework: "shopify",
        trackingPixels: ["twitter"],
        targetRegions: ["us_general"],
      })
    );

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.errors[0]).toContain("twitter");
  });

  it("returns 422 for invalid region", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
        framework: "shopify",
        trackingPixels: ["meta"],
        targetRegions: ["japan"],
      })
    );

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.errors[0]).toContain("japan");
  });

  it("returns 422 for invalid compliance module", async () => {
    const res = await POST(
      makeRequest({
        userType: "developer",
        framework: "shopify",
        trackingPixels: ["meta"],
        targetRegions: ["us_general"],
        complianceModules: ["iso27001"],
      })
    );

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.errors[0]).toContain("iso27001");
  });

  it("collects multiple validation errors", async () => {
    const res = await POST(
      makeRequest({
        userType: "admin",
        framework: "angular",
        trackingPixels: ["twitter"],
        targetRegions: ["japan"],
      })
    );

    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.errors.length).toBeGreaterThanOrEqual(4);
  });

  it("accepts all valid frameworks", async () => {
    const frameworks = ["shopify", "nextjs", "wordpress", "wix", "squarespace"];

    for (const framework of frameworks) {
      const res = await POST(
        makeRequest({
          userType: "developer",
          framework,
          trackingPixels: [],
          targetRegions: ["us_general"],
        })
      );
      expect(res.status).toBe(200);
    }
  });

  it("accepts all valid pixel + region combos", async () => {
    const res = await POST(
      makeRequest({
        userType: "merchant",
        framework: "wix",
        trackingPixels: ["meta", "google", "tiktok", "linkedin", "pinterest", "snapchat"],
        targetRegions: [
          "us_general",
          "california_ccpa",
          "eu_gdpr",
          "canada_pipeda",
          "brazil_lgpd",
          "australia_privacy",
        ],
        complianceModules: ["hipaa", "pci_dss", "ada_wcag", "soc2"],
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.consumerPrivacyPolicyAddendum.scriptDeclarations).toHaveLength(6);
    expect(data.data.consumerPrivacyPolicyAddendum.regionalDisclosures).toHaveLength(6);
    expect(data.data.enterpriseModules).toHaveLength(4);
  });
});
