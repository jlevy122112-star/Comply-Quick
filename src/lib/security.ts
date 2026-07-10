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
import { lookup as lookupCb } from "node:dns";
import net, { type LookupFunction } from "node:net";
import { Agent, type Dispatcher } from "undici";
import { ValidationError } from "@/services/errors";

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

/** Expands any valid IPv6 string into its 8 numeric 16-bit groups. */
function expandIPv6(addr: string): number[] {
  // Split off a trailing embedded IPv4 (e.g. ::ffff:127.0.0.1) into two groups.
  let head = addr;
  const v4 = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  let tailGroups: number[] = [];
  if (v4) {
    const o = v4[1].split(".").map(Number);
    tailGroups = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]];
    head = addr.slice(0, addr.length - v4[1].length).replace(/:$/, "") || "::";
  }
  const [left, right] = head.split("::");
  const leftParts = left ? left.split(":").filter(Boolean) : [];
  const rightParts = right ? right.split(":").filter(Boolean) : [];
  const leftNums = leftParts.map((h) => parseInt(h, 16));
  const rightNums = rightParts.map((h) => parseInt(h, 16));
  const groups = [...leftNums];
  if (head.includes("::")) {
    const fill = 8 - tailGroups.length - leftNums.length - rightNums.length;
    for (let i = 0; i < fill; i++) groups.push(0);
  }
  groups.push(...rightNums, ...tailGroups);
  while (groups.length < 8) groups.push(0);
  return groups.slice(0, 8);
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
    const g = expandIPv6(addr);
    // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible — validate the embedded
    // v4 address regardless of dotted-decimal or hex encoding.
    const isMapped = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0;
    if (isMapped && (g[5] === 0xffff || g[5] === 0)) {
      const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
      // ::/128 and ::1/128 are handled below; only recurse for real embedded v4.
      if (g[6] !== 0 || g[7] > 1) return isPrivateIp(v4);
    }
    const allZeroButLast = g.slice(0, 7).every((x) => x === 0);
    return (
      (allZeroButLast && g[7] === 1) || // ::1 loopback
      g.every((x) => x === 0) || // :: unspecified
      (g[0] & 0xfe00) === 0xfc00 || // fc00::/7 unique-local
      (g[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
      (g[0] & 0xff00) === 0xff00 // ff00::/8 multicast
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
    throw new ValidationError("That address points at a private network and can't be scanned.");
  }
  // A bare IP literal never hits DNS; validate it directly.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new ValidationError("That address points at a private network and can't be scanned.");
    }
    return [hostname];
  }
  let records: { address: string }[];
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new ValidationError("That website's address could not be resolved.");
  }
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new ValidationError("That address points at a private network and can't be scanned.");
  }
  return records.map((r) => r.address);
}

/**
 * A DNS lookup that rejects any resolution to non-public space. Used as the
 * connector's `lookup` so the address the socket actually connects to is the
 * one we validate — closing the check-vs-use (DNS-rebinding) gap that a
 * separate pre-flight resolution would leave open.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  lookupCb(hostname, { ...options, all: false }, (err, address, family) => {
    if (err) return callback(err, address, family);
    if (isPrivateIp(address)) {
      return callback(
        Object.assign(new Error("connection to a private address is not allowed"), { code: "EAI_PRIVATE" }),
        address,
        family
      );
    }
    callback(null, address, family);
  });
};

let cachedDispatcher: Dispatcher | undefined;

/**
 * A fetch dispatcher whose socket connections resolve DNS through
 * {@link guardedLookup}, so a scan fetch physically cannot open a socket to a
 * private/loopback address even if DNS rebinds between validation and use.
 */
export function getScanDispatcher(): Dispatcher {
  if (!cachedDispatcher) {
    cachedDispatcher = new Agent({ connect: { lookup: guardedLookup } });
  }
  return cachedDispatcher;
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
