import { describe, it, expect, afterEach } from "vitest";
import { bareHost, canonicalAppHost, hostFromUrl, primaryHosts } from "@/lib/appHost";

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (APP_HOST === undefined) delete process.env.NEXT_PUBLIC_APP_HOST;
  else process.env.NEXT_PUBLIC_APP_HOST = APP_HOST;
  if (SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
});

describe("appHost helpers", () => {
  it("bareHost strips port and leading www.", () => {
    expect(bareHost("www.comply-quick.com")).toBe("comply-quick.com");
    expect(bareHost("comply-quick.com:3001")).toBe("comply-quick.com");
    expect(bareHost("WWW.Comply-Quick.COM")).toBe("comply-quick.com");
  });

  it("hostFromUrl extracts hostname or returns undefined", () => {
    expect(hostFromUrl("https://www.comply-quick.com/pricing")).toBe("www.comply-quick.com");
    expect(hostFromUrl("not-a-url")).toBeUndefined();
    expect(hostFromUrl(undefined)).toBeUndefined();
  });

  it("primaryHosts always includes the product default even when env is unset", () => {
    delete process.env.NEXT_PUBLIC_APP_HOST;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const hosts = primaryHosts();
    expect(hosts.has("comply-quick.com")).toBe(true);
    expect(hosts.has("localhost")).toBe(true);
  });

  it("primaryHosts parses a comma-separated NEXT_PUBLIC_APP_HOST", () => {
    process.env.NEXT_PUBLIC_APP_HOST = "comply-quick.com, app.example.com";
    const hosts = primaryHosts();
    expect(hosts.has("comply-quick.com")).toBe(true);
    expect(hosts.has("app.example.com")).toBe(true);
  });

  it("canonicalAppHost returns a single hostname, never a comma-separated string", () => {
    process.env.NEXT_PUBLIC_APP_HOST = "comply-quick.com,www.comply-quick.com";
    expect(canonicalAppHost()).toBe("comply-quick.com");
    expect(canonicalAppHost()).not.toContain(",");
  });

  it("canonicalAppHost strips any :port so the value is a valid DNS target", () => {
    process.env.NEXT_PUBLIC_APP_HOST = "comply-quick.com:3000";
    expect(canonicalAppHost()).toBe("comply-quick.com");
  });

  it("canonicalAppHost falls back to the site URL host, then the product default", () => {
    delete process.env.NEXT_PUBLIC_APP_HOST;
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.example.com";
    expect(canonicalAppHost()).toBe("staging.example.com");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(canonicalAppHost()).toBe("comply-quick.com");
  });
});
