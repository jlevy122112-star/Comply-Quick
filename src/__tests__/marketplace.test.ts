import { describe, it, expect } from "vitest";
import {
  platformFeeCents,
  creatorNetCents,
  isValidPrice,
  isValidCategory,
  isValidType,
  slugifyTitle,
  normalizeSearch,
  PLATFORM_FEE_BPS,
  CREATOR_SHARE_BPS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_TYPES,
} from "@/lib/marketplace/service";

describe("platformFeeCents", () => {
  it("takes 50% of the sale, rounded to the nearest cent", () => {
    expect(platformFeeCents(10000)).toBe(5000); // $100 -> $50
    expect(platformFeeCents(2999)).toBe(1500); // $29.99 -> 1499.5 -> 1500
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

describe("creatorNetCents", () => {
  it("is the sale price minus the platform fee (50/50 split)", () => {
    expect(creatorNetCents(10000)).toBe(5000);
    expect(creatorNetCents(2999)).toBe(2999 - platformFeeCents(2999));
  });

  it("is zero for free or invalid amounts", () => {
    expect(creatorNetCents(0)).toBe(0);
    expect(creatorNetCents(-1)).toBe(0);
    expect(creatorNetCents(Number.NaN)).toBe(0);
  });

  it("complements the platform fee for the full price", () => {
    expect(creatorNetCents(10000) + platformFeeCents(10000)).toBe(10000);
    expect(CREATOR_SHARE_BPS + PLATFORM_FEE_BPS).toBe(10000);
  });
});

describe("isValidType", () => {
  it.each([...TEMPLATE_TYPES])("accepts %s", (t) => {
    expect(isValidType(t)).toBe(true);
  });

  it.each(["", "privacy", "Cookie_Banner", "gdpr"])("rejects %s", (t) => {
    expect(isValidType(t)).toBe(false);
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
