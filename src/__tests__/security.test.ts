import { describe, it, expect } from "vitest";
import { validateScanUrl, isBlockedScanHost } from "@/lib/security";

describe("validateScanUrl", () => {
  it("accepts public http(s) URLs", () => {
    expect(validateScanUrl("https://example.com")).toBe(true);
    expect(validateScanUrl("http://shop.example.co.uk/path?q=1")).toBe(true);
  });

  it("rejects loopback / private / link-local hosts (SSRF)", () => {
    for (const u of [
      "http://localhost",
      "http://127.0.0.1",
      "http://0.0.0.0",
      "http://10.0.0.5",
      "http://192.168.1.10",
      "http://172.16.4.4",
      "http://169.254.169.254", // cloud metadata endpoint
      "http://intranet.local",
    ]) {
      expect(validateScanUrl(u)).toBe(false);
    }
  });

  it("rejects non-http(s) schemes and malformed input", () => {
    expect(validateScanUrl("file:///etc/passwd")).toBe(false);
    expect(validateScanUrl("gopher://example.com")).toBe(false);
    expect(validateScanUrl("ftp://example.com")).toBe(false);
    expect(validateScanUrl("not a url")).toBe(false);
    expect(validateScanUrl("")).toBe(false);
  });
});

describe("isBlockedScanHost", () => {
  it("is case-insensitive and matches private ranges", () => {
    expect(isBlockedScanHost("LOCALHOST")).toBe(true);
    expect(isBlockedScanHost("172.31.255.255")).toBe(true);
    expect(isBlockedScanHost("172.32.0.1")).toBe(false);
    expect(isBlockedScanHost("example.com")).toBe(false);
  });
});
