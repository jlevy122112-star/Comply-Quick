// Compliance Scanner crawler (Phase 3).
//
// Fetches a page's HTML for analysis. Kept separate from the analyzer so the
// analyzer stays pure/offline. Includes SSRF guards: only http(s), and reject
// hostnames that resolve to loopback/private/link-local space by name.

import { ValidationError, ServiceUnavailableError } from "@/services/errors";

const MAX_BYTES = 2_000_000; // 2 MB cap — enough for markup, avoids huge payloads.
const FETCH_TIMEOUT_MS = 10_000;

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** Validates and normalizes a target URL, rejecting non-public destinations. */
export function normalizeScanUrl(raw: string): URL {
  let url: URL;
  const trimmed = raw.trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ValidationError("Enter a valid website URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ValidationError("Only http and https URLs can be scanned.");
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) {
    throw new ValidationError("That address points to a private network and cannot be scanned.");
  }
  return url;
}

export interface FetchedPage {
  url: string;
  status: number;
  html: string;
}

/** Fetches the HTML of a public page, enforcing timeout and size limits. */
export async function fetchPageHtml(raw: string, fetchImpl: typeof fetch = fetch): Promise<FetchedPage> {
  const url = normalizeScanUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "ComplyQuickScanner/1.0 (+https://comply-quick.com)", accept: "text/html" },
    });
    const body = await res.text();
    const html = body.length > MAX_BYTES ? body.slice(0, MAX_BYTES) : body;
    return { url: url.toString(), status: res.status, html };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ServiceUnavailableError("Could not reach that website. Check the URL and try again.");
  } finally {
    clearTimeout(timer);
  }
}
