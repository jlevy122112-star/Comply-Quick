// Centralized scan-target security checks (SSRF hardening).
//
// The scanner fetches arbitrary user-supplied URLs, so every entry point must
// reject non-public destinations (loopback, private RFC-1918 space, link-local,
// non-http(s) schemes). This module is the single source of truth; the crawler
// and the scan API both go through it.

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** True when a hostname points at loopback / private / link-local space. */
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

/**
 * Boolean guard for a scan target. Returns false for anything that isn't a
 * public http(s) URL — invalid syntax, non-web schemes (file:, gopher:, …), or
 * private/loopback hosts. Safe to call with untrusted input (never throws).
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
