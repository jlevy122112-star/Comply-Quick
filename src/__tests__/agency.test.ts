import { describe, it, expect, afterEach } from "vitest";
import { normalizeDomain, isValidDomain, slugify } from "@/lib/agency/service";
import { getDomainProvider } from "@/lib/agency/domain-provider";

describe("normalizeDomain", () => {
  it("strips scheme, path, www, and lowercases", () => {
    expect(normalizeDomain("HTTPS://WWW.Acme.com/portal")).toBe("acme.com");
  });

  it("leaves a bare hostname untouched", () => {
    expect(normalizeDomain("compliance.acme.com")).toBe("compliance.acme.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeDomain("  acme.io  ")).toBe("acme.io");
  });

  it("keeps subdomains other than a leading www", () => {
    expect(normalizeDomain("app.staging.acme.com")).toBe("app.staging.acme.com");
  });
});

describe("isValidDomain", () => {
  it.each(["acme.com", "compliance.acme.com", "a.co", "my-agency.io"])("accepts %s", (d) => {
    expect(isValidDomain(d)).toBe(true);
  });

  it.each(["", "acme", "-acme.com", "acme-.com", "acme..com", "http://acme.com", "acme.com/x"])("rejects %s", (d) => {
    expect(isValidDomain(d)).toBe(false);
  });
});

describe("slugify", () => {
  it("produces a URL-safe slug from an email local part", () => {
    expect(slugify("Jane.Doe+work")).toBe("jane-doe-work");
  });

  it("trims leading/trailing separators", () => {
    expect(slugify("  --Acme Co.--  ")).toBe("acme-co");
  });

  it("falls back to 'agency' when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("agency");
  });

  it("caps length at 32 characters", () => {
    expect(slugify("a".repeat(50)).length).toBe(32);
  });
});

describe("getDomainProvider", () => {
  const CF = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID"];
  const VC = ["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID", "VERCEL_TEAM_ID"];
  const saved = Object.fromEntries([...CF, ...VC].map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("returns null when nothing is configured", () => {
    [...CF, ...VC].forEach((k) => delete process.env[k]);
    expect(getDomainProvider()).toBeNull();
  });

  it("prefers Vercel when both are configured", () => {
    [...CF, ...VC].forEach((k) => (process.env[k] = "x"));
    expect(getDomainProvider()?.id).toBe("vercel");
  });

  it("falls back to Cloudflare when only Cloudflare is configured", () => {
    VC.forEach((k) => delete process.env[k]);
    CF.forEach((k) => (process.env[k] = "x"));
    expect(getDomainProvider()?.id).toBe("cloudflare");
  });
});
