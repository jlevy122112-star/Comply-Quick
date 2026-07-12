import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeConsent, summarizeConsent, CONSENT_ACTIONS, type ConsentRecord } from "@/lib/consent/records";
import { generateConsentBanner } from "@/lib/tools/cookieConsent";
import type { TargetRegion } from "@/lib/tools/data";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

const insertSingle = vi.fn();
const projectMaybeSingle = vi.fn();
const fromCalls: string[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      fromCalls.push(table);
      if (table === "projects") {
        return { select: () => ({ eq: () => ({ maybeSingle: projectMaybeSingle }) }) };
      }
      return { insert: () => ({ select: () => ({ single: insertSingle }) }) };
    },
  }),
}));

async function loadRecords() {
  vi.resetModules();
  return await import("@/lib/consent/records");
}

describe("normalizeConsent", () => {
  it("accepts a well-formed payload and lowercases/filters categories", () => {
    const result = normalizeConsent({
      projectId: VALID_UUID,
      subjectRef: "visitor-abc",
      action: "custom",
      categories: ["Analytics", "advertising", "bogus", "analytics"],
      consentModel: "opt-in",
      policyVersion: "2026-01-01",
      region: "eu",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories).toEqual(["analytics", "advertising"]);
    expect(result.value.action).toBe("custom");
    expect(result.value.consentModel).toBe("opt-in");
    expect(result.value.policyVersion).toBe("2026-01-01");
  });

  it("rejects a non-UUID projectId", () => {
    const result = normalizeConsent({ projectId: "not-a-uuid", subjectRef: "x", action: "accept_all" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown action", () => {
    const result = normalizeConsent({ projectId: VALID_UUID, subjectRef: "x", action: "hack" });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing subjectRef", () => {
    const result = normalizeConsent({ projectId: VALID_UUID, action: "accept_all" });
    expect(result.ok).toBe(false);
  });

  it("rejects an over-long subjectRef", () => {
    const result = normalizeConsent({
      projectId: VALID_UUID,
      subjectRef: "x".repeat(200),
      action: "accept_all",
    });
    expect(result.ok).toBe(false);
  });

  it("defaults categories to [] and model to opt-in when omitted", () => {
    const result = normalizeConsent({ projectId: VALID_UUID, subjectRef: "v", action: "withdraw" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.categories).toEqual([]);
    expect(result.value.consentModel).toBe("opt-in");
    expect(result.value.policyVersion).toBeNull();
  });

  it("rejects a non-object payload", () => {
    expect(normalizeConsent(null).ok).toBe(false);
    expect(normalizeConsent("nope").ok).toBe(false);
  });
});

describe("summarizeConsent", () => {
  it("counts records per action", () => {
    const recs = [
      { action: "accept_all" },
      { action: "accept_all" },
      { action: "reject_non_essential" },
      { action: "do_not_sell" },
    ] as ConsentRecord[];
    const summary = summarizeConsent(recs);
    expect(summary.total).toBe(4);
    expect(summary.byAction.accept_all).toBe(2);
    expect(summary.byAction.reject_non_essential).toBe(1);
    expect(summary.byAction.do_not_sell).toBe(1);
    expect(summary.byAction.custom).toBe(0);
    // Every known action has a counter.
    for (const a of CONSENT_ACTIONS) expect(summary.byAction[a]).toBeGreaterThanOrEqual(0);
  });
});

describe("cookie banner audit-trail beacon", () => {
  const base = {
    companyName: "Acme",
    privacyPolicyUrl: "/privacy",
    regions: ["eu_gdpr"] as TargetRegion[],
    pixels: [] as [],
  };

  it("does not emit recording code when no endpoint/project is supplied", () => {
    const banner = generateConsentBanner({ ...base });
    // RECORD is null, so report() short-circuits and nothing is ever sent, even
    // though the (inert) reporting code is present in the snippet.
    expect(banner.js).toContain("var RECORD=null");
    expect(banner.js).toContain("if(!RECORD)return");
  });

  it("wires the beacon when a valid https endpoint + UUID project are supplied", () => {
    const banner = generateConsentBanner({
      ...base,
      recordEndpoint: "https://app.comply-quick.com/api/consent",
      projectId: VALID_UUID,
      policyVersion: "2026-07",
    });
    expect(banner.js).toContain("https://app.comply-quick.com/api/consent");
    expect(banner.js).toContain(VALID_UUID);
    expect(banner.js).toContain('var POLICY="2026-07"');
    expect(banner.js).toContain("navigator.sendBeacon");
    // Governing region is captured with each record for audit.
    expect(banner.js).toContain('var REGION="eu_gdpr"');
    expect(banner.js).toContain("region:REGION");
  });

  it("ignores an unsafe (non-http) endpoint scheme", () => {
    const banner = generateConsentBanner({
      ...base,
      recordEndpoint: "javascript:alert(1)",
      projectId: VALID_UUID,
    });
    expect(banner.js).toContain("var RECORD=null");
    expect(banner.js).not.toContain("javascript:alert");
  });

  it("rejects a plaintext http endpoint (consent data must not travel in cleartext)", () => {
    const banner = generateConsentBanner({
      ...base,
      recordEndpoint: "http://app.comply-quick.com/api/consent",
      projectId: VALID_UUID,
    });
    expect(banner.js).toContain("var RECORD=null");
  });

  it("escapes </script> sequences in embedded values to prevent script injection", () => {
    const banner = generateConsentBanner({
      ...base,
      recordEndpoint: "https://app.comply-quick.com/api/consent",
      projectId: VALID_UUID,
      policyVersion: "</script><script>alert(1)//",
    });
    // The raw breakout sequence must never appear verbatim in the snippet.
    expect(banner.js).not.toContain("</script><script>");
    expect(banner.js).toContain("\\u003c");
  });

  it("uses a preflight-free content type for the beacon", () => {
    const banner = generateConsentBanner({
      ...base,
      recordEndpoint: "https://app.comply-quick.com/api/consent",
      projectId: VALID_UUID,
    });
    expect(banner.js).toContain("text/plain;charset=UTF-8");
    expect(banner.js).not.toContain('type:"application/json"');
  });

  it("ignores a non-UUID project id", () => {
    const banner = generateConsentBanner({
      ...base,
      recordEndpoint: "https://app.comply-quick.com/api/consent",
      projectId: "nope",
    });
    expect(banner.js).toContain("var RECORD=null");
  });
});

describe("recordConsent (service)", () => {
  beforeEach(() => {
    insertSingle.mockReset();
    projectMaybeSingle.mockReset();
    fromCalls.length = 0;
  });

  it("rejects when the project does not exist", async () => {
    projectMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { recordConsent } = await loadRecords();
    const result = await recordConsent({ projectId: VALID_UUID, subjectRef: "v", action: "accept_all" });
    expect(result.ok).toBe(false);
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("inserts and returns the id when the project exists", async () => {
    projectMaybeSingle.mockResolvedValue({ data: { id: VALID_UUID }, error: null });
    insertSingle.mockResolvedValue({ data: { id: "rec_1" }, error: null });
    const { recordConsent } = await loadRecords();
    const result = await recordConsent({
      projectId: VALID_UUID,
      subjectRef: "v",
      action: "accept_all",
      categories: ["analytics"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe("rec_1");
    expect(fromCalls).toContain("projects");
    expect(fromCalls).toContain("consent_records");
  });
});
