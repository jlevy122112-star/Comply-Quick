import { describe, it, expect } from "vitest";
import { hashContent, detectRegulationChange, computePackageDiff } from "@/lib/autopilot/diff-engine";
import { buildRegenerationProposal, type ProjectInputsSnapshot } from "@/lib/autopilot/pipeline";
import { getAiClient, resetAiClientForTests, DeterministicAiClient, type AiClient } from "@/services/ai";
import { generateCompliancePackage, exportToMarkdown } from "@/components/ClauseEngine";

const project: ProjectInputsSnapshot = {
  name: "Acme Store",
  framework: "shopify",
  trackingPixels: ["meta", "google"],
  targetRegions: ["eu_gdpr", "california_ccpa"],
  complianceModules: [],
  packageMarkdown: "",
};

const regulation = { id: "eu_gdpr", name: "EU GDPR", region: "eu_gdpr", changeNote: "New cookie guidance." };

describe("hashContent / detectRegulationChange", () => {
  it("hashes deterministically and differs on content change", () => {
    expect(hashContent("abc")).toBe(hashContent("abc"));
    expect(hashContent("abc")).not.toBe(hashContent("abd"));
  });

  it("treats a missing previous snapshot as a change (version 1)", () => {
    const change = detectRegulationChange(null, "content");
    expect(change.changed).toBe(true);
    expect(change.nextVersion).toBe(1);
    expect(change.previousHash).toBeNull();
  });

  it("detects no change when the hash matches, and bumps version otherwise", () => {
    const hash = hashContent("v1");
    expect(detectRegulationChange({ version: 3, contentHash: hash }, "v1").changed).toBe(false);
    const changed = detectRegulationChange({ version: 3, contentHash: hash }, "v2");
    expect(changed.changed).toBe(true);
    expect(changed.nextVersion).toBe(4);
  });
});

describe("computePackageDiff", () => {
  it("reports identical documents", () => {
    const md = "# A\nbody\n## B\nmore";
    const diff = computePackageDiff(md, md);
    expect(diff.identical).toBe(true);
    expect(diff.changedSections).toEqual([]);
  });

  it("detects added, removed, and changed sections", () => {
    const oldMd = "# Kept\nsame\n# Gone\nremoved";
    const newMd = "# Kept\nchanged\n# New\nadded";
    const diff = computePackageDiff(oldMd, newMd);
    expect(diff.identical).toBe(false);
    expect(diff.changedSections).toContain("Kept");
    expect(diff.addedSections).toContain("New");
    expect(diff.removedSections).toContain("Gone");
  });
});

describe("buildRegenerationProposal", () => {
  it("regenerates and proposes changes against an empty stored package", async () => {
    const proposal = await buildRegenerationProposal({ project, regulation, ai: new DeterministicAiClient() });
    expect(proposal.hasChanges).toBe(true);
    expect(proposal.packageMarkdown.length).toBeGreaterThan(0);
    expect(proposal.complianceScore.overall).toBeGreaterThan(0);
    // Deterministic (non-live) client → fallback summary, not the raw prompt echo.
    expect(proposal.summary).toContain("EU GDPR");
  });

  it("reports no changes when the stored package already matches", async () => {
    const current = exportToMarkdown(
      generateCompliancePackage({
        userType: "developer",
        framework: project.framework,
        trackingPixels: project.trackingPixels,
        targetRegions: project.targetRegions,
        complianceModules: project.complianceModules,
      })
    );
    const proposal = await buildRegenerationProposal({
      project: { ...project, packageMarkdown: current },
      regulation,
      ai: new DeterministicAiClient(),
    });
    expect(proposal.hasChanges).toBe(false);
  });

  it("uses a live AI client's summary when available", async () => {
    const fakeLive: AiClient = {
      id: "fake:live",
      live: true,
      async complete() {
        return "  Custom AI summary.  ";
      },
    };
    const proposal = await buildRegenerationProposal({ project, regulation, ai: fakeLive });
    expect(proposal.summary).toBe("Custom AI summary.");
  });

  it("falls back gracefully when a live AI client throws", async () => {
    const throwing: AiClient = {
      id: "fake:throws",
      live: true,
      async complete() {
        throw new Error("rate limited");
      },
    };
    const proposal = await buildRegenerationProposal({ project, regulation, ai: throwing });
    expect(proposal.hasChanges).toBe(true);
    expect(proposal.summary).toContain("EU GDPR");
  });
});

describe("getAiClient", () => {
  it("returns the deterministic fallback when no OPENAI_API_KEY is set", () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    resetAiClientForTests(undefined);
    const client = getAiClient();
    expect(client.live).toBe(false);
    expect(client.id).toBe("deterministic");
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
    resetAiClientForTests(undefined);
  });
});
