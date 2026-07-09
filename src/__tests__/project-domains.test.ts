import { describe, it, expect } from "vitest";
import { normalizeDomain } from "@/lib/project-domains-db";

describe("normalizeDomain", () => {
  it("strips scheme, path, and trailing content", () => {
    expect(normalizeDomain("https://www.Example.com/pricing?x=1")).toBe("www.example.com");
    expect(normalizeDomain("http://Example.com")).toBe("example.com");
  });

  it("lowercases and trims", () => {
    expect(normalizeDomain("  ExAmPle.COM  ")).toBe("example.com");
  });

  it("leaves a bare host unchanged", () => {
    expect(normalizeDomain("sub.example.co.uk")).toBe("sub.example.co.uk");
  });
});
