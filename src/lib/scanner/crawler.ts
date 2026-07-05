// Compliance Scanner crawler (Phase 3).
//
// Fetches a page's HTML for analysis. Kept separate from the analyzer so the
// analyzer stays pure/offline. Includes SSRF guards: only http(s), and reject
// hostnames that resolve to loopback/private/link-local space by name.

import { ValidationError, ServiceUnavailableError } from "@/services/errors";
import { isBlockedScanHost } from "@/lib/security";

const MAX_BYTES = 2_000_000; // 2 MB cap — enough for markup, avoids huge payloads.
const FETCH_TIMEOUT_MS = 10_000;

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
  if (isBlockedScanHost(url.hostname)) {
    throw new ValidationError("That address points to a private network and cannot be scanned.");
  }
  return url;
}

export interface FetchedPage {
  url: string;
  status: number;
  html: string;
  /** Outbound request URLs captured during a headless render (empty for plain fetch). */
  requestUrls: string[];
  /** True when the page was rendered by the headless worker (JS executed). */
  rendered: boolean;
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
    return { url: url.toString(), status: res.status, html, requestUrls: [], rendered: false };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ServiceUnavailableError("Could not reach that website. Check the URL and try again.");
  } finally {
    clearTimeout(timer);
  }
}

const WORKER_TIMEOUT_MS = 45_000; // headless render is slower than a plain fetch.

interface WorkerResponse {
  url: string;
  status: number;
  html: string;
  requestUrls: string[];
}

function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.url === "string" &&
    typeof v.status === "number" &&
    typeof v.html === "string" &&
    Array.isArray(v.requestUrls) &&
    v.requestUrls.every((u) => typeof u === "string")
  );
}

/**
 * Renders a page in the headless scanner worker so client-side scripts execute
 * and their outbound requests (Meta/TikTok pixels, GA hits, etc.) are captured.
 * Requires SCANNER_WORKER_URL; SCANNER_WORKER_SECRET authenticates the call.
 * Throws ServiceUnavailableError on any transport/worker failure so the caller
 * can fall back to a plain fetch.
 */
export async function renderPageViaWorker(
  raw: string,
  workerUrl: string,
  workerSecret: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<FetchedPage> {
  const url = normalizeScanUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);
  try {
    const res = await fetchImpl(new URL("/scan", workerUrl).toString(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(workerSecret ? { authorization: `Bearer ${workerSecret}` } : {}),
      },
      body: JSON.stringify({ url: url.toString() }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableError("The scanner worker could not render that page.");
    }
    const json: unknown = await res.json();
    if (!isWorkerResponse(json)) {
      throw new ServiceUnavailableError("The scanner worker returned an unexpected response.");
    }
    const html = json.html.length > MAX_BYTES ? json.html.slice(0, MAX_BYTES) : json.html;
    return {
      url: json.url || url.toString(),
      status: json.status,
      html,
      requestUrls: json.requestUrls,
      rendered: true,
    };
  } catch (err) {
    if (err instanceof ValidationError || err instanceof ServiceUnavailableError) throw err;
    throw new ServiceUnavailableError("Could not reach the scanner worker.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads a page for analysis. When a headless worker is configured it renders the
 * page (executing JS to catch dynamically-injected trackers); otherwise, or if
 * the worker fails, it falls back to a plain server-side fetch of the markup.
 */
export async function scanPage(raw: string, fetchImpl: typeof fetch = fetch): Promise<FetchedPage> {
  const workerUrl = process.env.SCANNER_WORKER_URL;
  if (workerUrl) {
    try {
      return await renderPageViaWorker(raw, workerUrl, process.env.SCANNER_WORKER_SECRET, fetchImpl);
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      // Worker unavailable — degrade gracefully to a static fetch.
    }
  }
  return fetchPageHtml(raw, fetchImpl);
}
