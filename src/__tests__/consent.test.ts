import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeConsent, summarizeConsent, CONSENT_ACTIONS, type ConsentRecord } from "@/lib/consent/records";
import { generateConsentBanner } from "@/lib/tools/cookieConsent";
import type { TargetRegion } from "@/lib/tools/data";
import { normalizeConsentDeployment } from "@/lib/consent/deployments";

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

  it("rejects a malformed managed deployment id instead of silently unscoping it", () => {
    expect(
      normalizeConsent({ projectId: VALID_UUID, subjectRef: "x", action: "accept_all", deploymentId: "not-a-uuid" }).ok
    ).toBe(false);
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

  it("scopes preference persistence and automatic tag enforcement to a managed deployment", () => {
    const deploymentId = "22222222-2222-4222-8222-222222222222";
    const banner = generateConsentBanner({
      ...base,
      pixels: ["google"],
      recordEndpoint: "https://app.comply-quick.com/api/consent",
      projectId: VALID_UUID,
      deploymentId,
    });
    expect(banner.html).toContain(`data-cq-deployment="${deploymentId}"`);
    expect(banner.js).toContain('KEY="cq_consent_v1"+(DEPLOYMENT?"_"+DEPLOYMENT:"")');
    expect(banner.js).toContain('script[type="text/plain"][data-cq-category]');
    expect(banner.js).toContain("deploymentId:RECORD.deploymentId");
    expect(banner.html).toContain('data-cq="manage"');
    expect(banner.html).toContain('data-cq="save"');
  });

  it("persists granular preferences and activates marked tags only after the preference is saved", () => {
    const deploymentId = "33333333-3333-4333-8333-333333333333";
    const banner = generateConsentBanner({ ...base, pixels: ["google"], deploymentId });
    document.body.innerHTML = `${banner.html}<script type="text/plain" data-cq-category="analytics">window.__cqTagLoaded=true;</script>`;
    const executable = banner.js.replace(/^<script>\n/, "").replace(/\n<\/script>$/, "");
    // Generated code is intentionally framework-free and executes in the host
    // page. Execute it in jsdom to exercise the actual preference lifecycle.
    new Function(executable)();
    const dialog = document.getElementById("cq-consent")!;
    expect(dialog.hidden).toBe(false);
    (dialog.querySelector('[data-cq="manage"]') as HTMLButtonElement).click();
    (dialog.querySelector('[data-cq-category="analytics"]') as HTMLInputElement).checked = true;
    (dialog.querySelector('[data-cq="save"]') as HTMLButtonElement).click();
    expect(JSON.parse(localStorage.getItem(`cq_consent_v1_${deploymentId}`) ?? "{}").categories).toEqual(["analytics"]);
    expect(
      (
        window as typeof window & { complyQuickConsent: { allows: (category: string) => boolean } }
      ).complyQuickConsent.allows("analytics")
    ).toBe(true);
    expect(document.querySelector('script[data-cq-category="analytics"]')?.getAttribute("data-cq-loaded")).toBe("true");
    document.body.innerHTML = "";
    localStorage.clear();
  });
});

describe("normalizeConsentDeployment", () => {
  it("normalizes a managed deployment with valid project-owned configuration", () => {
    const result = normalizeConsentDeployment({
      projectId: VALID_UUID,
      siteUrl: "https://www.acme.test/store",
      privacyPolicyUrl: "/privacy",
      policyVersion: "2026-07",
      regions: ["eu_gdpr"],
      pixels: ["google"],
      enforcementMode: "automatic",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.siteUrl).toBe("https://www.acme.test/store");
    expect(result.value.enforcementMode).toBe("automatic");
  });

  it("rejects credentials and unknown vendors in a deployment", () => {
    expect(
      normalizeConsentDeployment({
        projectId: VALID_UUID,
        siteUrl: "https://user:pass@acme.test",
        privacyPolicyUrl: "/privacy",
        policyVersion: "1",
        regions: ["eu_gdpr"],
        pixels: [],
      }).ok
    ).toBe(false);
    expect(
      normalizeConsentDeployment({
        projectId: VALID_UUID,
        siteUrl: "https://acme.test",
        privacyPolicyUrl: "/privacy",
        policyVersion: "1",
        regions: ["eu_gdpr"],
        pixels: ["unknown"],
      }).ok
    ).toBe(false);
  });
});

describe("recordConsent (service)", () => {
  beforeEach(() => {
    insertSingle.mockReset();
    projectMaybeSingle.mockReset();
    fromCalls.length = 0;
  });

  function normalized(overrides: Record<string, unknown> = {}) {
    const result = normalizeConsent({
      projectId: VALID_UUID,
      subjectRef: "v",
      action: "accept_all",
      categories: ["analytics"],
      ...overrides,
    });
    if (!result.ok) throw new Error(`test fixture failed to normalize: ${result.error}`);
    return result.value;
  }

  it("rejects when the project does not exist", async () => {
    projectMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { recordConsent } = await loadRecords();
    const result = await recordConsent(normalized());
    expect(result.ok).toBe(false);
    expect(insertSingle).not.toHaveBeenCalled();
  });

  it("inserts and returns the id when the project exists", async () => {
    projectMaybeSingle.mockResolvedValue({ data: { id: VALID_UUID }, error: null });
    insertSingle.mockResolvedValue({ data: { id: "rec_1" }, error: null });
    const { recordConsent } = await loadRecords();
    const result = await recordConsent(normalized());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe("rec_1");
    expect(fromCalls).toContain("projects");
    expect(fromCalls).toContain("consent_records");
  });
});
