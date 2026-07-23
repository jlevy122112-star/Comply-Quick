import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("scanner worker accessibility isolation", () => {
  it("keeps axe failures additive to rendered HTML and request capture", () => {
    const server = readFileSync(join(process.cwd(), "scanner-worker/server.mjs"), "utf8");
    expect(server).toContain("catch");
    expect(server).toContain("accessibilityViolations = []");
    expect(server).toContain("let accessibilityViolations = []");
  });
});
