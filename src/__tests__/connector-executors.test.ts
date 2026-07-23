import { describe, expect, it } from "vitest";
import {
  applyApprovedRemediation,
  executePlannedRemediation,
  getRemediationCapabilities,
  rollbackRemediation,
} from "@/lib/connector/executor";
import type { RemediationChange } from "@/lib/connector/types";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const consentChange: RemediationChange = {
  id: "inject_consent_banner",
  summary: "Install consent",
  target: "script_tag:consent",
  risk: "high",
};

const privacyChange: RemediationChange = {
  id: "publish_privacy_policy",
  summary: "Publish policy",
  target: "page:privacy",
  risk: "medium",
};

describe("connector executor capabilities", () => {
  it("exposes platform write targets and manual downgrades", () => {
    expect(getRemediationCapabilities("shopify").executableTargets).toEqual(["script_tag:consent", "page:privacy"]);
    expect(getRemediationCapabilities("wordpress").executableTargets).toContain("page:privacy");
    expect(getRemediationCapabilities("webflow").manualTargets).toContain("page:privacy");
    expect(getRemediationCapabilities("webflow").executableTargets).toEqual(["script_tag:consent"]);
    expect(getRemediationCapabilities("gtm").supportsAutoApply).toBe(false);
  });

  it("preserves planner proposal disposition before any network write", async () => {
    let calls = 0;
    const result = await executePlannedRemediation(
      { change: consentChange, disposition: "propose" },
      {
        connection: { id: "wp-1", platform: "wordpress", externalAccountId: "https://example.test" },
        fetchImpl: (async () => {
          calls += 1;
          return response({});
        }) as typeof fetch,
      }
    );
    expect(result.status).toBe("proposed");
    expect(calls).toBe(0);
  });

  it("rechecks the safety invariant if an unsafe auto plan is supplied", async () => {
    const result = await executePlannedRemediation(
      { change: consentChange, disposition: "auto_apply" },
      { connection: { id: "wp-unsafe", platform: "wordpress", externalAccountId: "https://example.test" } }
    );
    expect(result.status).toBe("proposed");
    expect(result.detail).toContain("safety policy");
  });

  it("downgrades Webflow policy pages to a generated manual proposal", async () => {
    const result = await applyApprovedRemediation(privacyChange, {
      connection: { id: "webflow-1", platform: "webflow", externalAccountId: "site-123" },
      privacyPolicyHtml: "<h1>Privacy</h1>",
    });
    expect(result.status).toBe("proposed");
    expect(result.manualInstructions).toContain("<h1>Privacy</h1>");
  });

  it("generates an installable manual snippet for platforms without an API", async () => {
    const result = await applyApprovedRemediation(consentChange, {
      connection: { id: "generic-1", platform: "gtm", externalAccountId: "site.example" },
      consentScript: "<script data-test-consent></script>",
    });
    expect(result.status).toBe("proposed");
    expect(result.manualInstructions).toContain("<script data-test-consent></script>");
    expect(result.manualInstructions).toContain("manually");
  });
});

describe("WordPress executor", () => {
  it("is idempotent when the consent endpoint already has the requested script", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      return response({ installed: true, script: "<script>consent</script>" });
    }) as typeof fetch;
    const result = await applyApprovedRemediation(consentChange, {
      connection: { id: "wp-1", platform: "wordpress", externalAccountId: "https://wp.test" },
      consentScript: "<script>consent</script>",
      fetchImpl,
      snapshotRef: "snapshot:wp-consent",
    });
    expect(result.status).toBe("applied");
    expect(result.previousStateRef).toBe("snapshot:wp-consent");
    expect(calls).toEqual(["GET https://wp.test/wp-json/comply-quick/v1/consent-script"]);
  });

  it("translates a policy page write and restores its prior state on rollback", async () => {
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method: init.method ?? "GET", url, body });
      if (init.method === "GET")
        return response([
          { id: 44, slug: "privacy-policy", title: { rendered: "Old" }, content: { rendered: "<p>Old</p>" } },
        ]);
      return response({ id: 44 });
    }) as typeof fetch;
    const result = await applyApprovedRemediation(privacyChange, {
      connection: { id: "wp-2", platform: "wordpress", externalAccountId: "https://wp.test" },
      privacyPolicyHtml: "<p>New</p>",
      fetchImpl,
      snapshotRef: "snapshot:wp-page",
    });
    expect(result.status).toBe("applied");
    expect(calls[1]).toMatchObject({
      method: "POST",
      url: "https://wp.test/wp-json/wp/v2/pages/44",
      body: { content: "<p>New</p>", status: "publish" },
    });
    const rolledBack = await rollbackRemediation(result, {
      connection: { id: "wp-2", platform: "wordpress", externalAccountId: "https://wp.test" },
      fetchImpl,
    });
    expect(rolledBack.status).toBe("reverted");
    expect(calls[3]).toMatchObject({
      method: "POST",
      url: "https://wp.test/wp-json/wp/v2/pages/44",
      body: { content: "<p>Old</p>", status: "publish" },
    });
  });
});

describe("Webflow and Shopify executors", () => {
  it("writes Webflow head custom code once and rolls it back", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? "GET", url });
      if (init.method === "GET" && calls.length === 1) return response([]);
      if (init.method === "GET") {
        return response([
          { id: "custom-1", displayName: "Comply-Quick Consent", code: "<script>consent</script>", location: "head" },
        ]);
      }
      return response({ id: "custom-1" });
    }) as typeof fetch;
    const result = await applyApprovedRemediation(consentChange, {
      connection: { id: "wf-1", platform: "webflow", externalAccountId: "site-123" },
      consentScript: "<script>consent</script>",
      apiToken: "wf-token",
      fetchImpl,
      snapshotRef: "snapshot:wf",
    });
    expect(result.status).toBe("applied");
    expect(calls).toEqual([
      { method: "GET", url: "https://api.webflow.com/v2/sites/site-123/custom_code" },
      { method: "POST", url: "https://api.webflow.com/v2/sites/site-123/custom_code" },
      { method: "GET", url: "https://api.webflow.com/v2/sites/site-123/custom_code" },
    ]);
    const rolledBack = await rollbackRemediation(result, {
      connection: { id: "wf-1", platform: "webflow", externalAccountId: "site-123" },
      apiToken: "wf-token",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ method: init.method ?? "GET", url });
        return response([{ id: "custom-1", displayName: "Comply-Quick Consent" }]);
      }) as typeof fetch,
    });
    expect(rolledBack.status).toBe("reverted");
    expect(calls.at(-1)).toEqual({
      method: "DELETE",
      url: "https://api.webflow.com/v2/sites/site-123/custom_code/custom-1",
    });
  });

  it("uses Shopify API translation and captures an empty prior state", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ method: init.method ?? "GET", url });
      if (init.method === "GET") {
        return calls.length === 1
          ? response({ script_tags: [] })
          : response({ script_tags: [{ id: 9, src: "https://cdn.test/consent.js" }] });
      }
      return response({ script_tag: { id: 9, src: "https://cdn.test/consent.js" } });
    }) as typeof fetch;
    const result = await applyApprovedRemediation(consentChange, {
      connection: { id: "shop-1", platform: "shopify", externalAccountId: "shop.test" },
      accessToken: "token",
      consentScriptUrl: "https://cdn.test/consent.js",
      fetchImpl,
      snapshotRef: "snapshot:shopify",
    });
    expect(result.status).toBe("applied");
    expect(result.previousStateRef).toBe("snapshot:shopify");
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "GET"]);
  });
});
