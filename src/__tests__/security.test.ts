import { describe, it, expect } from "vitest";
import { validateScanUrl, isBlockedScanHost, isPrivateIp } from "@/lib/security";

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

describe("isPrivateIp", () => {
  it("flags IPv4 private / loopback / link-local / CGNAT / multicast", () => {
    for (const ip of [
      "0.0.0.0",
      "10.0.0.5",
      "127.0.0.1",
      "169.254.1.1",
      "172.16.4.4",
      "192.168.1.10",
      "100.64.0.1",
      "224.0.0.1",
    ]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("allows public IPv4/IPv6", () => {
    for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:5db8:d822"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });

  it("flags IPv6 loopback/unspecified/ULA/link-local/multicast incl. non-canonical forms", () => {
    for (const ip of ["::1", "0:0:0:0:0:0:0:1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });

  it("flags hex-form IPv4-mapped IPv6 that URL/DNS can normalize to (regression)", () => {
    // ::ffff:7f00:1 is the hex encoding of ::ffff:127.0.0.1 (loopback).
    expect(isPrivateIp("::ffff:7f00:1")).toBe(true);
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:a00:1")).toBe(true); // 10.0.0.1
    expect(isPrivateIp("::ffff:a9fe:1")).toBe(true); // 169.254.0.1
  });

  it("treats unparseable input as unsafe", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});
