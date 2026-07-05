import { describe, it, expect } from "vitest";
import { renderBadge } from "@/lib/score/badge";

describe("renderBadge", () => {
  it("renders a valid SVG for the score variant with the score value", () => {
    const svg = renderBadge("score", 87);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Privacy Score");
    expect(svg).toContain("87/100");
  });

  it("renders the certified variant", () => {
    const svg = renderBadge("certified", 100);
    expect(svg).toContain("Comply-Quick");
    expect(svg).toContain("Certified");
  });

  it("colors by score band (green ≥80, amber ≥60, red <60)", () => {
    expect(renderBadge("score", 85)).toContain("#16a34a");
    expect(renderBadge("score", 70)).toContain("#d97706");
    expect(renderBadge("score", 50)).toContain("#dc2626");
  });

  it("escapes special characters in the aria-label", () => {
    const svg = renderBadge("score", 63);
    expect(svg).toContain('role="img"');
    expect(svg).not.toMatch(/aria-label="[^"]*<[^"]*"/);
  });
});
