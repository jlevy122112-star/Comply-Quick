import { describe, it, expect } from "vitest";
import {
  platformFeeCents,
  isValidPrice,
  isValidCategory,
  slugifyTitle,
  normalizeSearch,
  PLATFORM_FEE_BPS,
  TEMPLATE_CATEGORIES,
} from "@/lib/marketplace/service";

describe("platformFeeCents", () => {
  it("takes 15% of the sale, rounded to the nearest cent", () => {
    expect(platformFeeCents(10000)).toBe(1500); // $100 -> $15
    expect(platformFeeCents(2999)).toBe(450); // $29.99 -> 449.85 -> 450
  });

  it("is zero for free or invalid amounts", () => {
    expect(platformFeeCents(0)).toBe(0);
    expect(platformFeeCents(-100)).toBe(0);
    expect(platformFeeCents(Number.NaN)).toBe(0);
  });

  it("matches the exported basis points", () => {
    expect(platformFeeCents(10000)).toBe((10000 * PLATFORM_FEE_BPS) / 10000);
  });
});

describe("isValidPrice", () => {
  it.each([0, 100, 2999, 1000000])("accepts whole-cent price %i", (p) => {
    expect(isValidPrice(p)).toBe(true);
  });

  it.each([-1, 1000001, 9.99, Number.NaN, Infinity])("rejects %s", (p) => {
    expect(isValidPrice(p)).toBe(false);
  });
});

describe("isValidCategory", () => {
  it.each([...TEMPLATE_CATEGORIES])("accepts %s", (c) => {
    expect(isValidCategory(c)).toBe(true);
  });

  it.each(["", "Ecommerce", "crypto", "GENERAL"])("rejects %s", (c) => {
    expect(isValidCategory(c)).toBe(false);
  });
});

describe("slugifyTitle", () => {
  it("produces a URL-safe slug", () => {
    expect(slugifyTitle("GDPR Starter Kit — v2!")).toBe("gdpr-starter-kit-v2");
  });

  it("trims separators and lowercases", () => {
    expect(slugifyTitle("  --Cookie Banner--  ")).toBe("cookie-banner");
  });

  it("falls back to 'template' when nothing usable remains", () => {
    expect(slugifyTitle("!!!")).toBe("template");
  });

  it("caps length at 60 characters", () => {
    expect(slugifyTitle("a".repeat(80)).length).toBe(60);
  });
});

describe("normalizeSearch", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeSearch("  GDPR   Cookie  ")).toBe("gdpr cookie");
  });

  it("caps length at 100 characters", () => {
    expect(normalizeSearch("x".repeat(150)).length).toBe(100);
  });
});
