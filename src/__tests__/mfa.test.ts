import { describe, it, expect } from "vitest";
import { decodeJwtAal, formatTotpSecret, isValidTotpCode, mfaGate, normalizeTotpCode } from "@/lib/auth/mfa";

/** Builds a minimal unsigned JWT string carrying the given payload claims. */
function fakeJwt(claims: Record<string, unknown>): string {
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.signature`;
}

describe("mfaGate", () => {
  it("prompts for a challenge when a factor exists but the session is only aal1", () => {
    expect(mfaGate("aal1", "aal2")).toBe("challenge");
  });

  it("is satisfied when the session already cleared the second factor", () => {
    expect(mfaGate("aal2", "aal2")).toBe("satisfied");
  });

  it("reports not_enrolled when no verified second factor exists", () => {
    expect(mfaGate("aal1", "aal1")).toBe("not_enrolled");
    expect(mfaGate(null, "aal1")).toBe("not_enrolled");
    expect(mfaGate(null, null)).toBe("not_enrolled");
  });
});

describe("normalizeTotpCode / isValidTotpCode", () => {
  it("accepts six digits and strips display spacing", () => {
    expect(normalizeTotpCode("123456")).toBe("123456");
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode("123-456")).toBe("123456");
    expect(isValidTotpCode("123456")).toBe(true);
  });

  it("rejects non-6-digit input", () => {
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("1234567")).toBeNull();
    expect(normalizeTotpCode("12a456")).toBeNull();
    expect(normalizeTotpCode("")).toBeNull();
    expect(isValidTotpCode("abc")).toBe(false);
  });
});

describe("formatTotpSecret", () => {
  it("groups the secret into 4-char blocks", () => {
    expect(formatTotpSecret("ABCDEFGHIJKL")).toBe("ABCD EFGH IJKL");
    expect(formatTotpSecret("ABC")).toBe("ABC");
  });
});

describe("decodeJwtAal", () => {
  it("reads the aal claim from a token", () => {
    expect(decodeJwtAal(fakeJwt({ aal: "aal1" }))).toBe("aal1");
    expect(decodeJwtAal(fakeJwt({ aal: "aal2" }))).toBe("aal2");
  });

  it("returns null for missing/unknown/malformed tokens", () => {
    expect(decodeJwtAal(fakeJwt({ sub: "u1" }))).toBeNull();
    expect(decodeJwtAal(fakeJwt({ aal: "aal3" }))).toBeNull();
    expect(decodeJwtAal(null)).toBeNull();
    expect(decodeJwtAal(undefined)).toBeNull();
    expect(decodeJwtAal("not-a-jwt")).toBeNull();
    expect(decodeJwtAal("a.b")).toBeNull();
  });
});
