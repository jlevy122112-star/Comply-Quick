import { describe, it, expect } from "vitest";
import { computeLineDiff, diffStats } from "@/components/ui/DiffViewer";

describe("computeLineDiff", () => {
  it("marks identical text as all-same", () => {
    const lines = computeLineDiff("a\nb\nc", "a\nb\nc");
    expect(lines.every((l) => l.op === "same")).toBe(true);
    expect(diffStats(lines)).toEqual({ added: 0, removed: 0 });
  });

  it("detects an added line", () => {
    const lines = computeLineDiff("a\nc", "a\nb\nc");
    expect(diffStats(lines)).toEqual({ added: 1, removed: 0 });
    expect(lines.find((l) => l.op === "add")?.text).toBe("b");
  });

  it("detects a removed line", () => {
    const lines = computeLineDiff("a\nb\nc", "a\nc");
    expect(diffStats(lines)).toEqual({ added: 0, removed: 1 });
    expect(lines.find((l) => l.op === "remove")?.text).toBe("b");
  });

  it("detects a replacement as remove + add", () => {
    const lines = computeLineDiff("keep\nold\nkeep2", "keep\nnew\nkeep2");
    const stats = diffStats(lines);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
    // Order is preserved: unchanged anchors stay in place.
    expect(lines[0]).toEqual({ op: "same", text: "keep" });
    expect(lines[lines.length - 1]).toEqual({ op: "same", text: "keep2" });
  });
});
