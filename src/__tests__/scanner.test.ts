import { describe, it, expect, afterEach } from "vitest";
import { detectTools, analyzeHtml } from "@/lib/scanner/analyzer";
import { normalizeScanUrl, fetchPageHtml, renderPageViaWorker, scanPage } from "@/lib/scanner/crawler";
import { runScan } from "@/lib/scanner/pipeline";
import { DeterministicAiClient, type AiClient } from "@/services/ai";
import { ValidationError, ServiceUnavailableError } from "@/services/errors";

const CLEAN_PAGE = `
  <html><head></head><body>
    <a href="/privacy-policy">Privacy Policy</a>
    <a href="/terms">Terms of Service</a>
  </body></html>
`;

const RISKY_PAGE = `
  <html><head>
    <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
    <script>gtag('config','G-XXX');</script>
    <script src="https://static.hotjar.com/c/hotjar.js"></script>
  </head><body>No policy links here.</body></html>
`;

const CONSENTED_PAGE = `
  <html><head>
    <script src="https://consent.cookiebot.com/uc.js"></script>
    <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
  </head><body><a href="/privacy">Privacy</a><a href="/terms">Terms</a></body></html>
`;

describe("detectTools", () => {
  it("fingerprints trackers and session-replay tools", () => {
    const tools = detectTools(RISKY_PAGE);
    const ids = tools.map((t) => t.id);
    expect(ids).toContain("meta");
    expect(ids).toContain("google");
    expect(ids).toContain("hotjar");
  });

  it("finds nothing on a clean page", () => {
    expect(detectTools(CLEAN_PAGE)).toEqual([]);
  });

  it("detects JS-injected pixels from captured network requests, not the HTML", () => {
    // The static markup is clean; the trackers are only visible as outbound
    // requests fired at runtime (what the headless worker captures).
    const requests = [
      "https://www.facebook.com/tr?id=123&ev=PageView",
      "https://analytics.tiktok.com/api/v2/pixel",
      "https://region1.google-analytics.com/g/collect?v=2",
    ];
    const ids = detectTools(CLEAN_PAGE, requests).map((t) => t.id);
    expect(ids).toContain("meta");
    expect(ids).toContain("tiktok");
    expect(ids).toContain("google");
  });
});

describe("analyzeHtml", () => {
  it("flags trackers without consent and missing privacy policy as critical", () => {
    const result = analyzeHtml(RISKY_PAGE);
    const ids = result.findings.map((f) => f.id);
    expect(ids).toContain("trackers_without_consent");
    expect(ids).toContain("missing_privacy_policy");
    expect(ids).toContain("session_replay_present");
    expect(result.score).toBeLessThan(60);
    expect(result.hasConsentBanner).toBe(false);
  });

  it("scores a clean page highly with no critical findings", () => {
    const result = analyzeHtml(CLEAN_PAGE);
    expect(result.score).toBe(100);
    expect(result.findings.some((f) => f.severity === "critical")).toBe(false);
  });

  it("recognizes a consent banner alongside trackers", () => {
    const result = analyzeHtml(CONSENTED_PAGE);
    expect(result.hasConsentBanner).toBe(true);
    expect(result.findings.some((f) => f.id === "trackers_without_consent")).toBe(false);
    expect(result.findings.some((f) => f.id === "consent_present")).toBe(true);
  });
});

describe("normalizeScanUrl", () => {
  it("adds https scheme when missing", () => {
    expect(normalizeScanUrl("example.com").toString()).toBe("https://example.com/");
  });

  it("rejects private and non-http targets", () => {
    expect(() => normalizeScanUrl("http://localhost")).toThrow(ValidationError);
    expect(() => normalizeScanUrl("http://192.168.1.1")).toThrow(ValidationError);
    expect(() => normalizeScanUrl("ftp://example.com")).toThrow(ValidationError);
  });
});

describe("fetchPageHtml", () => {
  it("returns fetched html via an injected fetch", async () => {
    const fakeFetch = (async () => new Response(CLEAN_PAGE, { status: 200 })) as unknown as typeof fetch;
    const page = await fetchPageHtml("example.com", fakeFetch);
    expect(page.status).toBe(200);
    expect(page.html).toContain("Privacy Policy");
  });

  it("wraps network failures as ServiceUnavailableError", async () => {
    const failing = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(fetchPageHtml("example.com", failing)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("renderPageViaWorker", () => {
  it("posts to the worker and returns rendered html + captured requests", async () => {
    const workerFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://worker.test/scan");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer sekret");
      return new Response(
        JSON.stringify({
          url: "https://example.com/",
          status: 200,
          html: CLEAN_PAGE,
          requestUrls: ["https://www.facebook.com/tr?id=1"],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const page = await renderPageViaWorker("example.com", "https://worker.test", "sekret", workerFetch);
    expect(page.rendered).toBe(true);
    expect(page.requestUrls).toContain("https://www.facebook.com/tr?id=1");
  });

  it("throws ServiceUnavailableError when the worker errors", async () => {
    const workerFetch = (async () => new Response("nope", { status: 502 })) as unknown as typeof fetch;
    await expect(
      renderPageViaWorker("example.com", "https://worker.test", undefined, workerFetch)
    ).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("scanPage", () => {
  afterEach(() => {
    delete process.env.SCANNER_WORKER_URL;
    delete process.env.SCANNER_WORKER_SECRET;
  });

  it("uses the worker render when SCANNER_WORKER_URL is set", async () => {
    process.env.SCANNER_WORKER_URL = "https://worker.test";
    const workerFetch = (async () =>
      new Response(JSON.stringify({ url: "https://example.com/", status: 200, html: CLEAN_PAGE, requestUrls: [] }), {
        status: 200,
      })) as unknown as typeof fetch;
    const page = await scanPage("example.com", workerFetch);
    expect(page.rendered).toBe(true);
  });

  it("falls back to a static fetch when the worker is unreachable", async () => {
    process.env.SCANNER_WORKER_URL = "https://worker.test";
    let calls = 0;
    const flakyFetch = (async (input: RequestInfo | URL) => {
      calls += 1;
      if (String(input).includes("/scan")) throw new Error("worker down");
      return new Response(CLEAN_PAGE, { status: 200 });
    }) as unknown as typeof fetch;
    const page = await scanPage("example.com", flakyFetch);
    expect(page.rendered).toBe(false);
    expect(page.html).toContain("Privacy Policy");
    expect(calls).toBe(2); // worker attempt, then fallback fetch
  });
});

describe("runScan", () => {
  it("produces a scored outcome with a deterministic summary", async () => {
    const fakeFetch = (async () => new Response(RISKY_PAGE, { status: 200 })) as unknown as typeof fetch;
    const outcome = await runScan({ url: "example.com", ai: new DeterministicAiClient(), fetchImpl: fakeFetch });
    expect(outcome.score).toBeLessThan(60);
    expect(outcome.detectedTools.length).toBeGreaterThan(0);
    expect(outcome.summary).toContain("Compliance score");
  });

  it("uses a live AI client's summary when available", async () => {
    const fakeFetch = (async () => new Response(CLEAN_PAGE, { status: 200 })) as unknown as typeof fetch;
    const fakeLive: AiClient = {
      id: "fake:live",
      live: true,
      async complete() {
        return "  Looks compliant.  ";
      },
    };
    const outcome = await runScan({ url: "example.com", ai: fakeLive, fetchImpl: fakeFetch });
    expect(outcome.summary).toBe("Looks compliant.");
  });
});
