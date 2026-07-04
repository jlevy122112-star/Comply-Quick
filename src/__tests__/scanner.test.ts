import { describe, it, expect } from "vitest";
import { detectTools, analyzeHtml } from "@/lib/scanner/analyzer";
import { normalizeScanUrl, fetchPageHtml } from "@/lib/scanner/crawler";
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
