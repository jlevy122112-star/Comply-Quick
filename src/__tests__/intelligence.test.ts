import { describe, it, expect } from "vitest";
import { detectRisks, SCORE_DROP_THRESHOLD, type ScanSnapshot } from "@/lib/intelligence/risk";
import { buildFixRecommendation } from "@/lib/intelligence/pipeline";
import { DeterministicAiClient, type AiClient } from "@/services/ai";
import type { DetectedTool, Finding } from "@/lib/scanner/analyzer";

const meta: DetectedTool = { id: "meta", name: "Meta Pixel", category: "advertising" };
const tiktok: DetectedTool = { id: "tiktok", name: "TikTok Pixel", category: "advertising" };

const criticalFinding: Finding = {
  id: "no_privacy_policy",
  title: "No privacy policy link found",
  severity: "critical",
  detail: "…",
  recommendation: "Publish a privacy policy.",
};

function snapshot(partial: Partial<ScanSnapshot>): ScanSnapshot {
  return { score: 80, detectedTools: [], findings: [], ...partial };
}

describe("detectRisks", () => {
  it("returns no events on the first scan (no previous)", () => {
    expect(detectRisks(null, snapshot({ score: 50, detectedTools: [meta] }))).toEqual([]);
  });

  it("raises a score_drop alert when the score falls past the threshold", () => {
    const prev = snapshot({ score: 80 });
    const cur = snapshot({ score: 80 - SCORE_DROP_THRESHOLD });
    const events = detectRisks(prev, cur);
    const drop = events.find((e) => e.type === "score_drop");
    expect(drop).toBeDefined();
    expect(drop!.detail.drop).toBe(SCORE_DROP_THRESHOLD);
  });

  it("does not alert for a score drop smaller than the threshold", () => {
    const events = detectRisks(snapshot({ score: 80 }), snapshot({ score: 80 - (SCORE_DROP_THRESHOLD - 1) }));
    expect(events.find((e) => e.type === "score_drop")).toBeUndefined();
  });

  it("escalates severity to critical on a large score drop", () => {
    const events = detectRisks(snapshot({ score: 90 }), snapshot({ score: 70 }));
    expect(events.find((e) => e.type === "score_drop")?.severity).toBe("critical");
  });

  it("raises a new_tracker alert only for trackers not seen before", () => {
    const prev = snapshot({ detectedTools: [meta] });
    const cur = snapshot({ detectedTools: [meta, tiktok] });
    const evt = detectRisks(prev, cur).find((e) => e.type === "new_tracker");
    expect(evt).toBeDefined();
    expect((evt!.detail.newTools as { id: string }[]).map((t) => t.id)).toEqual(["tiktok"]);
  });

  it("does not alert when the tracker set is unchanged", () => {
    const events = detectRisks(snapshot({ detectedTools: [meta] }), snapshot({ detectedTools: [meta] }));
    expect(events.find((e) => e.type === "new_tracker")).toBeUndefined();
  });

  it("raises a new_critical alert for a newly-appearing critical finding", () => {
    const cur = snapshot({ findings: [criticalFinding] });
    const evt = detectRisks(snapshot({}), cur).find((e) => e.type === "new_critical");
    expect(evt).toBeDefined();
    expect(evt!.severity).toBe("critical");
  });

  it("does not re-alert for a critical finding present in the previous scan", () => {
    const prev = snapshot({ findings: [criticalFinding] });
    const cur = snapshot({ findings: [criticalFinding] });
    expect(detectRisks(prev, cur).find((e) => e.type === "new_critical")).toBeUndefined();
  });
});

describe("buildFixRecommendation", () => {
  it("falls back to a deterministic plan without a live AI client", async () => {
    const ai = new DeterministicAiClient();
    const out = await buildFixRecommendation(
      {
        url: "https://x.com",
        type: "new_tracker",
        title: "1 new tracker detected",
        body: "…",
        detail: { newTools: [{ name: "TikTok Pixel" }] },
      },
      ai
    );
    expect(out).toContain("TikTok Pixel");
    expect(out).not.toContain("AI unavailable");
  });

  it("uses the live model output when available", async () => {
    const live: AiClient = { id: "test", live: true, complete: async () => "1. Do the thing." };
    const out = await buildFixRecommendation(
      { url: "https://x.com", type: "score_drop", title: "drop", body: "…", detail: {} },
      live
    );
    expect(out).toBe("1. Do the thing.");
  });

  it("falls back when the live model throws", async () => {
    const broken: AiClient = {
      id: "broken",
      live: true,
      complete: async () => {
        throw new Error("boom");
      },
    };
    const out = await buildFixRecommendation(
      { url: "https://x.com", type: "scan_failed", title: "failed", body: "…", detail: {} },
      broken
    );
    expect(out).toContain("publicly reachable");
  });
});
