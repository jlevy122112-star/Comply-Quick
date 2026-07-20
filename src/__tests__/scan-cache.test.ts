import { describe, it, expect, vi, beforeEach } from "vitest";

// Verifies the DB-backed 7-day scan cache in createScan: a recent completed scan
// of the same URL is reused (no re-crawl, no quota charge); `force` bypasses it.

const runScanSpy = vi.fn();
const getUser = vi.fn();
let cacheRow: Record<string, unknown> | null = null;
let insertedRow: Record<string, unknown> | null = null;

function makeQuery() {
  return new Proxy({} as Record<string, unknown>, {
    get(_, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) => resolve({ data: [] });
      }
      if (prop === "maybeSingle") {
        return async () => ({ data: cacheRow });
      }
      if (prop === "single") {
        return async () => ({ data: insertedRow, error: null });
      }
      return () => makeQuery();
    },
  });
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUser },
    from: () => makeQuery(),
  }),
}));

vi.mock("@/lib/scanner/pipeline", () => ({
  runScan: (...args: unknown[]) => runScanSpy(...args),
}));

vi.mock("@/lib/entitlements", () => ({
  getEntitlement: async () => ({ isPremium: true }),
}));

vi.mock("@/services/ai", () => ({ getAiClient: () => ({}) }));
vi.mock("@/lib/billing/usage", () => ({
  recordScanUsage: async () => undefined,
  currentPeriod: () => "2026-07",
  periodStartIso: () => "2026-07-01T00:00:00.000Z",
}));

async function load() {
  vi.resetModules();
  return await import("@/lib/scanner/service");
}

describe("createScan — 7-day DB cache", () => {
  beforeEach(() => {
    runScanSpy.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user_1" } } });
    cacheRow = null;
    insertedRow = null;
  });

  it("returns a recent scan without re-crawling", async () => {
    cacheRow = {
      id: "scan_cached",
      url: "https://example.com/",
      status: "completed",
      score: 82,
      detected_tools: [],
      findings: [],
      summary: "cached",
      error: null,
      created_at: new Date().toISOString(),
    };
    const { createScan } = await load();

    const result = await createScan("example.com");

    expect(result.id).toBe("scan_cached");
    expect(runScanSpy).not.toHaveBeenCalled();
  });

  it("re-crawls when force is set, even if a cached scan exists", async () => {
    cacheRow = {
      id: "scan_cached",
      url: "https://example.com/",
      status: "completed",
      created_at: new Date().toISOString(),
    };
    insertedRow = {
      id: "scan_fresh",
      url: "https://example.com/",
      status: "completed",
      score: 90,
      detected_tools: [],
      findings: [],
      summary: "fresh",
      error: null,
      created_at: new Date().toISOString(),
    };
    runScanSpy.mockResolvedValue({
      url: "https://example.com/",
      score: 90,
      detectedTools: [],
      findings: [],
      summary: "fresh",
    });
    const { createScan } = await load();

    const result = await createScan("example.com", { force: true });

    expect(runScanSpy).toHaveBeenCalledTimes(1);
    expect(result.id).toBe("scan_fresh");
  });
});
