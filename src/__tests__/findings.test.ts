import { describe, it, expect } from "vitest";
import { findingKeyFor } from "@/lib/findings-db";

describe("findingKeyFor", () => {
  it("is stable across scheme/www/path variations of the same site", () => {
    const a = findingKeyFor("https://www.example.com/pricing", "meta-pixel");
    const b = findingKeyFor("http://example.com/", "meta-pixel");
    expect(a).toBe(b);
    expect(a).toBe("example.com::meta-pixel");
  });

  it("differs per site and per finding", () => {
    expect(findingKeyFor("https://a.com", "x")).not.toBe(findingKeyFor("https://b.com", "x"));
    expect(findingKeyFor("https://a.com", "x")).not.toBe(findingKeyFor("https://a.com", "y"));
  });

  it("falls back to the raw string when the URL is unparseable", () => {
    expect(findingKeyFor("not a url", "x")).toBe("not a url::x");
  });
});
