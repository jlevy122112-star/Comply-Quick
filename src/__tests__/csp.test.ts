import { afterEach, describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, cspMode, generateNonce } from "@/lib/security/csp";

const ORIGINAL = process.env.CSP_MODE;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CSP_MODE;
  else process.env.CSP_MODE = ORIGINAL;
});

describe("csp", () => {
  it("generates unique base64 nonces", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    // 16 random bytes → 24 base64 chars.
    expect(a.length).toBe(24);
  });

  it("embeds the nonce and strict-dynamic in script-src", () => {
    const csp = buildCsp("abc123");
    expect(csp).toContain("script-src 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("allows Supabase realtime and hosted Stripe checkout", () => {
    const csp = buildCsp("n");
    expect(csp).toContain("connect-src 'self' https: wss:");
    expect(csp).toContain("form-action 'self' https://checkout.stripe.com");
  });

  it("defaults to report-only and switches on CSP_MODE=enforce", () => {
    delete process.env.CSP_MODE;
    expect(cspMode()).toBe("report-only");
    expect(cspHeaderName()).toBe("Content-Security-Policy-Report-Only");

    process.env.CSP_MODE = "enforce";
    expect(cspMode()).toBe("enforce");
    expect(cspHeaderName()).toBe("Content-Security-Policy");
  });
});
