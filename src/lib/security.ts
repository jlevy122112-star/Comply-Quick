// Centralized scan-target security checks (SSRF hardening).
//
// The scanner fetches arbitrary user-supplied URLs, so every entry point must
// reject non-public destinations (loopback, private RFC-1918 space, link-local,
// non-http(s) schemes). This module is the single source of truth; the crawler
// and the scan API both go through it.
//
// A hostname string check alone is not enough: a public-looking hostname can
// resolve to a private/loopback address (DNS-rebinding style SSRF), and HTTP
// redirects can point at internal hosts. So we also resolve the host to its IPs
// and reject any that fall in non-public ranges, and callers must validate every
// redirect hop (see the crawler's manual redirect handling).

import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** True when a hostname literal points at loopback / private / link-local space. */
export function isBlockedScanHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

/** True when a resolved IP address is not in public/routable space. */
export function isPrivateIp(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (net.isIPv4(addr)) {
    const p = addr.split(".").map(Number);
    return (
      p[0] === 0 || // "this" network
      p[0] === 10 || // RFC-1918
      p[0] === 127 || // loopback
      (p[0] === 169 && p[1] === 254) || // link-local
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || // RFC-1918
      (p[0] === 192 && p[1] === 168) || // RFC-1918
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || // CGNAT (RFC-6598)
      p[0] >= 224 // multicast / reserved
    );
  }
  if (net.isIPv6(addr)) {
    // IPv4-mapped (::ffff:a.b.c.d) — validate the embedded v4 address.
    const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return (
      addr === "::1" || // loopback
      addr === "::" || // unspecified
      addr.startsWith("fc") || // unique-local
      addr.startsWith("fd") || // unique-local
      addr.startsWith("fe80") || // link-local
      addr.startsWith("ff") // multicast
    );
  }
  return true; // unparseable — treat as unsafe.
}

/**
 * Resolves a hostname and throws when it (or any of its addresses) points at a
 * non-public destination. Async because it performs DNS resolution. Returns the
 * resolved public IP addresses so callers can pin the connection if they wish.
 */
export async function assertPublicScanHost(hostname: string): Promise<string[]> {
  if (isBlockedScanHost(hostname)) {
    throw new Error("host is not a public address");
  }
  // A bare IP literal never hits DNS; validate it directly.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("host is not a public address");
    return [hostname];
  }
  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new Error("host could not be resolved");
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new Error("host is not a public address");
  }
  return records.map((r) => r.address);
}

/**
 * Boolean guard for a scan target. Returns false for anything that isn't a
 * public http(s) URL — invalid syntax, non-web schemes (file:, gopher:, …), or
 * private/loopback hosts. Safe to call with untrusted input (never throws).
 * Note: this is a synchronous, best-effort check (no DNS); the crawler performs
 * the authoritative DNS-based check via assertPublicScanHost before fetching.
 */
export function validateScanUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (isBlockedScanHost(parsed.hostname)) return false;
  return true;
}
