import { describe, it, expect, vi, beforeEach } from "vitest";

const consumeFreeScanToken = vi.fn();
const getFreeScanClaimByToken = vi.fn();
const releaseConsumedFreeScan = vi.fn();
const recordPublicScanEvent = vi.fn();
const fetchPageHtml = vi.fn();
const analyzeHtml = vi.fn();

vi.mock("@/lib/free-scan", () => ({
  consumeFreeScanToken: (...args: unknown[]) => consumeFreeScanToken(...args),
  getFreeScanClaimByToken: (...args: unknown[]) => getFreeScanClaimByToken(...args),
  releaseConsumedFreeScan: (...args: unknown[]) => releaseConsumedFreeScan(...args),
  recordPublicScanEvent: (...args: unknown[]) => recordPublicScanEvent(...args),
}));

vi.mock("@/lib/scanner/crawler", () => ({
  fetchPageHtml: (...args: unknown[]) => fetchPageHtml(...args),
}));

vi.mock("@/lib/scanner/analyzer", () => ({
  analyzeHtml: (...args: unknown[]) => analyzeHtml(...args),
}));

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/public-scan/route");
}

describe("POST /api/public-scan", () => {
  beforeEach(() => {
    consumeFreeScanToken.mockReset();
    getFreeScanClaimByToken.mockReset();
    releaseConsumedFreeScan.mockReset();
    recordPublicScanEvent.mockReset();
    fetchPageHtml.mockReset();
    analyzeHtml.mockReset();
  });

  it("requires a claim token", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("http://localhost/api/public-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "example.com" }),
      })
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("claim_required");
  });

  it("rejects reused token", async () => {
    consumeFreeScanToken.mockResolvedValue(null);
    getFreeScanClaimByToken.mockResolvedValue({ usedAt: new Date().toISOString() });
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("http://localhost/api/public-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "example.com", token: "token_1" }),
      })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("token_used");
  });

  it("rejects unknown token", async () => {
    consumeFreeScanToken.mockResolvedValue(null);
    getFreeScanClaimByToken.mockResolvedValue(null);
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("http://localhost/api/public-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "example.com", token: "missing" }),
      })
    );
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("invalid_token");
  });

  it("returns a teaser scan response when token is valid", async () => {
    consumeFreeScanToken.mockResolvedValue({ usedAt: new Date().toISOString() });
    fetchPageHtml.mockResolvedValue({
      url: "https://example.com/",
      html: "<html></html>",
      requestUrls: [],
    });
    analyzeHtml.mockReturnValue({
      score: 82,
      detectedTools: [{ name: "Google Analytics" }],
      findings: [{ title: "Missing privacy policy link", severity: "warning" }],
      hasConsentBanner: false,
      hasPrivacyPolicy: false,
    });
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("http://localhost/api/public-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "example.com", token: "token_1" }),
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://example.com/");
    expect(data.score).toBe(82);
    expect(data.counts.warning).toBe(1);
  });

  it("releases consumed token when scan fails", async () => {
    consumeFreeScanToken.mockResolvedValue({ usedAt: "2026-09-04T00:00:00.000Z" });
    fetchPageHtml.mockRejectedValue(new Error("network"));
    const { POST } = await loadRoute();
    const res = await POST(
      new Request("http://localhost/api/public-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "example.com", token: "token_1" }),
      })
    );
    expect(res.status).toBe(502);
    expect(releaseConsumedFreeScan).toHaveBeenCalledWith("token_1", "2026-09-04T00:00:00.000Z");
  });
});
