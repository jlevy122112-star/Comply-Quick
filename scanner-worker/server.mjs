// Comply-Quick Compliance Scanner — headless render worker.
//
// A standalone Node service (deployed separately from the Next app) that renders
// a URL in headless Chromium, lets its JavaScript execute, and returns the final
// HTML together with every outbound request URL observed during load. Network
// capture is what reveals JS-injected trackers (Meta Pixel `facebook.com/tr`,
// TikTok, GA hits, etc.) that never appear in the statically-served markup.
//
// Endpoints:
//   GET  /health  -> { ok: true }
//   POST /scan    -> { url, status, html, requestUrls }
//                    body: { "url": "https://example.com" }
//                    auth: Authorization: Bearer $SCANNER_WORKER_SECRET (if set)

import { createServer } from "node:http";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = process.env.SCANNER_WORKER_SECRET;
const NAV_TIMEOUT_MS = Number(process.env.SCAN_NAV_TIMEOUT_MS ?? 30_000);
const SETTLE_MS = Number(process.env.SCAN_SETTLE_MS ?? 2_500);
const MAX_BYTES = 2_000_000;
const MAX_REQUESTS = 1_000;

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/** SSRF guard: only http(s), reject private / loopback / link-local hosts. */
function normalizeUrl(raw) {
  const trimmed = String(raw ?? "").trim();
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be scanned.");
  }
  const host = url.hostname.toLowerCase();
  const isPrivate =
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".local") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) throw new Error("That address points to a private network and cannot be scanned.");
  return url;
}

// One shared browser for the process; contexts are cheap and isolated per scan.
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  }
  return browserPromise;
}

async function renderPage(rawUrl) {
  const url = normalizeUrl(rawUrl);
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ComplyQuickScanner/1.0",
    viewport: { width: 1366, height: 900 },
  });
  const requestUrls = [];
  context.on("request", (req) => {
    if (requestUrls.length < MAX_REQUESTS) requestUrls.push(req.url());
  });

  const page = await context.newPage();
  let status = 0;
  try {
    const response = await page.goto(url.toString(), { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
    status = response ? response.status() : 0;
    // Let late-firing tags (consent-gated pixels, deferred analytics) settle.
    await page.waitForTimeout(SETTLE_MS);
    let html = await page.content();
    if (html.length > MAX_BYTES) html = html.slice(0, MAX_BYTES);
    return { url: page.url(), status, html, requestUrls };
  } finally {
    await context.close();
  }
}

function send(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10_000) reject(new Error("Request body too large."));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && req.url === "/scan") {
    if (SECRET) {
      const auth = req.headers.authorization ?? "";
      if (auth !== `Bearer ${SECRET}`) return send(res, 401, { error: "Unauthorized." });
    }
    let parsed;
    try {
      parsed = JSON.parse((await readBody(req)) || "{}");
    } catch {
      return send(res, 400, { error: "Invalid JSON body." });
    }
    let normalized;
    try {
      normalized = normalizeUrl(parsed.url);
    } catch (err) {
      return send(res, 422, { error: err instanceof Error ? err.message : "Invalid URL." });
    }
    try {
      const result = await renderPage(normalized.toString());
      return send(res, 200, result);
    } catch (err) {
      console.error("scan failed", { url: normalized.toString(), error: err?.message });
      return send(res, 502, { error: "Could not render that page." });
    }
  }

  return send(res, 404, { error: "Not found." });
});

server.listen(PORT, () => {
  console.log(`scanner-worker listening on :${PORT}`);
});

async function shutdown() {
  server.close();
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
