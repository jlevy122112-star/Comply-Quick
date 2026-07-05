import { describe, it, expect } from "vitest";
import { generateKey, hashKey, keyPrefixOf, digestsEqual, KEY_PREFIX } from "@/lib/api/keys";
import { bearerToken } from "@/lib/api/auth";
import { meterCostCents } from "@/lib/api/usage";
import { currentPeriod, previousPeriod } from "@/lib/billing/usage";
import { METERED_PRICE_CENTS } from "@/lib/pricing";

describe("api/keys", () => {
  it("generates keys with the live prefix and enough entropy", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a.startsWith(KEY_PREFIX)).toBe(true);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(KEY_PREFIX.length + 20);
  });

  it("hashes deterministically to a 64-char hex digest", () => {
    const key = generateKey();
    const h1 = hashKey(key);
    const h2 = hashKey(key);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(generateKey())).not.toBe(h1);
  });

  it("exposes a non-secret 12-char display prefix", () => {
    const key = generateKey();
    expect(keyPrefixOf(key)).toBe(key.slice(0, 12));
    expect(keyPrefixOf(key).startsWith(KEY_PREFIX)).toBe(true);
  });

  it("compares digests in constant time by value and rejects length mismatch", () => {
    const h = hashKey("abc");
    expect(digestsEqual(h, hashKey("abc"))).toBe(true);
    expect(digestsEqual(h, hashKey("xyz"))).toBe(false);
    expect(digestsEqual(h, h.slice(0, 10))).toBe(false);
  });
});

describe("api/auth bearerToken", () => {
  it("extracts the token from a Bearer header, case-insensitively", () => {
    expect(bearerToken(new Headers({ authorization: "Bearer cq_live_abc" }))).toBe("cq_live_abc");
    expect(bearerToken(new Headers({ authorization: "bearer cq_live_abc" }))).toBe("cq_live_abc");
    expect(bearerToken(new Headers({ authorization: "  Bearer   cq_live_abc  " }))).toBe("cq_live_abc");
  });

  it("returns null when absent or malformed", () => {
    expect(bearerToken(new Headers())).toBeNull();
    expect(bearerToken(new Headers({ authorization: "cq_live_abc" }))).toBeNull();
    expect(bearerToken(new Headers({ authorization: "Basic abc" }))).toBeNull();
  });
});

describe("api/usage meterCostCents", () => {
  it("prices meters from the pricing source of truth", () => {
    expect(meterCostCents("api_call")).toBe(METERED_PRICE_CENTS.apiCall);
    expect(meterCostCents("api_template_upload")).toBe(METERED_PRICE_CENTS.apiTemplateUpload);
    expect(meterCostCents("api_call")).toBe(1);
    expect(meterCostCents("api_template_upload")).toBe(5000);
  });
});

describe("billing period helpers", () => {
  it("formats the current calendar month in UTC", () => {
    expect(currentPeriod(new Date("2026-07-03T22:00:00Z"))).toBe("2026-07");
  });

  it("rolls back to the previous month, crossing the year boundary", () => {
    expect(previousPeriod(new Date("2026-07-03T22:00:00Z"))).toBe("2026-06");
    expect(previousPeriod(new Date("2026-01-15T00:00:00Z"))).toBe("2025-12");
  });
});
