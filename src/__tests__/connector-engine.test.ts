import { describe, it, expect } from "vitest";
import { encryptToken, decryptToken, resolveTokenKey } from "@/lib/connector/crypto";
import { canTransition, transition, canAutoWrite, isMonitoring } from "@/lib/connector/state-machine";
import { evaluateBreaker, DEFAULT_BREAKER, type BreakerSignal } from "@/lib/connector/circuit-breaker";
import { planRemediations } from "@/lib/connector/remediation";
import { evaluateConnectionCycle } from "@/lib/connector/agent";
import {
  isValidShopDomain,
  buildAuthorizeUrl,
  verifyOAuthHmac,
  exchangeCodeForToken,
  SHOPIFY_SCOPES,
} from "@/lib/connector/shopify/oauth";
import { verifyWebhookHmac, mapTopicToEvent, shouldRescan } from "@/lib/connector/shopify/webhooks";
import { ShopifyAdminClient } from "@/lib/connector/shopify/client";
import { createHmac } from "node:crypto";
import type { LintFinding } from "@/lib/compliance/linter";

const KEY = Buffer.alloc(32, 7); // deterministic 32-byte key for tests

describe("connector/crypto — token encryption at rest", () => {
  it("round-trips a secret through AES-256-GCM", () => {
    const enc = encryptToken("shpat_supersecret", KEY);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("shpat_supersecret");
    expect(decryptToken(enc, KEY)).toBe("shpat_supersecret");
  });

  it("detects tampering via the auth tag", () => {
    const enc = encryptToken("token", KEY);
    const parts = enc.split(":");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("evil").toString("base64")].join(":");
    expect(() => decryptToken(tampered, KEY)).toThrow();
  });

  it("resolveTokenKey rejects a wrong-length key", () => {
    expect(() => resolveTokenKey({ CONNECTOR_TOKEN_KEY: "deadbeef" } as unknown as NodeJS.ProcessEnv)).toThrow();
    const hex = "a".repeat(64);
    expect(resolveTokenKey({ CONNECTOR_TOKEN_KEY: hex } as unknown as NodeJS.ProcessEnv).length).toBe(32);
  });

  it("resolveTokenKey accepts valid base64 and rejects garbled base64 (no silent truncation)", () => {
    const b64 = Buffer.alloc(32, 9).toString("base64");
    expect(resolveTokenKey({ CONNECTOR_TOKEN_KEY: b64 } as unknown as NodeJS.ProcessEnv).length).toBe(32);
    // Contains characters outside the base64 alphabet → must throw, not silently
    // drop them and decode to some other length.
    expect(() =>
      resolveTokenKey({ CONNECTOR_TOKEN_KEY: "not*valid*base64*key!!" } as unknown as NodeJS.ProcessEnv)
    ).toThrow();
  });
});

describe("connector/state-machine", () => {
  it("permits legal transitions and blocks illegal ones", () => {
    expect(canTransition("pending", "active")).toBe(true);
    expect(canTransition("active", "frozen")).toBe(true);
    expect(canTransition("revoked", "active")).toBe(false);
    expect(() => transition("revoked", "active")).toThrow();
  });

  it("only allows auto-write when active AND auto", () => {
    expect(canAutoWrite("active", "auto")).toBe(true);
    expect(canAutoWrite("active", "propose_only")).toBe(false);
    expect(canAutoWrite("frozen", "auto")).toBe(false);
    expect(canAutoWrite("degraded", "auto")).toBe(false);
  });

  it("monitors in active/degraded/frozen but not pending/revoked", () => {
    expect(isMonitoring("active")).toBe(true);
    expect(isMonitoring("degraded")).toBe(true);
    expect(isMonitoring("frozen")).toBe(true);
    expect(isMonitoring("pending")).toBe(false);
    expect(isMonitoring("revoked")).toBe(false);
  });
});

describe("connector/circuit-breaker", () => {
  const now = 1_000_000_000_000;
  it("trips on repeated human undos in the window", () => {
    const signals: BreakerSignal[] = [
      { kind: "human_undo", at: now - 1000 },
      { kind: "human_undo", at: now - 2000 },
      { kind: "human_undo", at: now - 3000 },
    ];
    const d = evaluateBreaker(signals, now, DEFAULT_BREAKER);
    expect(d.tripped).toBe(true);
    expect(d.reason).toBe("repeated_human_undo");
  });

  it("ignores undos older than the window", () => {
    const old = now - DEFAULT_BREAKER.windowMs - 1;
    const signals: BreakerSignal[] = [
      { kind: "human_undo", at: old },
      { kind: "human_undo", at: old - 1 },
      { kind: "human_undo", at: old - 2 },
    ];
    expect(evaluateBreaker(signals, now).tripped).toBe(false);
  });

  it("trips on consecutive write failures but resets after a success", () => {
    const failing: BreakerSignal[] = [
      { kind: "write_failed", at: now - 3000 },
      { kind: "write_failed", at: now - 2000 },
      { kind: "write_failed", at: now - 1000 },
    ];
    expect(evaluateBreaker(failing, now).tripped).toBe(true);
    const recovered: BreakerSignal[] = [
      ...failing,
      { kind: "write_ok", at: now - 500 },
      { kind: "write_failed", at: now - 100 },
    ];
    expect(evaluateBreaker(recovered, now).tripped).toBe(false);
  });
});

const missingPrivacy: LintFinding = {
  id: "missing_privacy_policy",
  severity: "error",
  obligationId: "gdpr.art13.privacy_notice",
  message: "x",
};
const trackersNoConsent: LintFinding = {
  id: "trackers_without_consent",
  severity: "error",
  obligationId: "gdpr.art7.consent",
  message: "x",
};
const pciFinding: LintFinding = {
  id: "pci_not_addressed",
  severity: "warning",
  obligationId: "pci_dss.saq_scope",
  message: "x",
};

describe("connector/remediation — disposition gating", () => {
  it("proposes everything in propose_only mode", () => {
    const plan = planRemediations([missingPrivacy, trackersNoConsent], { mode: "propose_only", status: "active" });
    expect(plan.every((p) => p.disposition === "propose")).toBe(true);
  });

  it("never auto-applies document (page:) changes even in auto mode", () => {
    const plan = planRemediations([missingPrivacy], { mode: "auto", status: "active" });
    const privacy = plan.find((p) => p.change.id === "publish_privacy_policy");
    expect(privacy!.disposition).toBe("propose");
  });

  it("never auto-applies high-risk changes (consent banner) even in auto mode", () => {
    const plan = planRemediations([trackersNoConsent], { mode: "auto", status: "active" });
    expect(plan.find((p) => p.change.id === "inject_consent_banner")!.disposition).toBe("propose");
  });

  it("auto-applies a low-risk non-document config change in auto mode", () => {
    const plan = planRemediations([pciFinding], { mode: "auto", status: "active" });
    // pci notice targets page:privacy#payments → still a document → propose
    expect(plan.find((p) => p.change.id === "add_pci_notice")!.disposition).toBe("propose");
  });
});

describe("connector/agent — continuous cycle", () => {
  const coverage = {
    hasPrivacyPolicy: false,
    hasConsentMechanism: false,
    dpaWith: [],
    mentionsSccs: false,
    addressesPci: false,
  };

  it("derives obligations + findings + a propose plan for a fresh EU site", () => {
    const r = evaluateConnectionCycle({
      connection: { mode: "propose_only", status: "active" },
      detectedServices: ["google", "stripe"],
      jurisdictions: ["eu"],
      coverage,
      breakerSignals: [],
      now: Date.now(),
    });
    expect(r.obligations.length).toBeGreaterThan(0);
    expect(r.findings.some((f) => f.id === "missing_privacy_policy")).toBe(true);
    expect(r.plan.every((p) => p.disposition === "propose")).toBe(true);
    expect(r.nextStatus).toBe("active");
  });

  it("freezes the connection and forces propose_only when the breaker trips", () => {
    const now = Date.now();
    const r = evaluateConnectionCycle({
      connection: { mode: "auto", status: "active" },
      detectedServices: ["google"],
      jurisdictions: ["eu"],
      coverage,
      breakerSignals: [
        { kind: "human_undo", at: now - 1 },
        { kind: "human_undo", at: now - 2 },
        { kind: "human_undo", at: now - 3 },
      ],
      now,
    });
    expect(r.breaker.tripped).toBe(true);
    expect(r.nextStatus).toBe("frozen");
    expect(r.nextMode).toBe("propose_only");
    expect(r.plan.every((p) => p.disposition === "propose")).toBe(true);
  });
});

describe("connector/shopify — oauth", () => {
  const cfg = { apiKey: "key", apiSecret: "secret", redirectUri: "https://app.example.com/cb" };

  it("validates shop domains strictly", () => {
    expect(isValidShopDomain("acme.myshopify.com")).toBe(true);
    expect(isValidShopDomain("evil.com")).toBe(false);
    expect(isValidShopDomain("acme.myshopify.com.evil.com")).toBe(false);
  });

  it("builds an authorize url with least-privilege scopes", () => {
    const url = buildAuthorizeUrl("acme.myshopify.com", cfg, "nonce123");
    expect(url).toContain("https://acme.myshopify.com/admin/oauth/authorize");
    expect(url).toContain(encodeURIComponent(SHOPIFY_SCOPES.join(",")));
    expect(url).toContain("state=nonce123");
  });

  it("verifies a correct OAuth callback HMAC and rejects a bad one", () => {
    const params: Record<string, string> = { code: "abc", shop: "acme.myshopify.com", timestamp: "123" };
    const message = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const hmac = createHmac("sha256", cfg.apiSecret).update(message).digest("hex");
    expect(verifyOAuthHmac({ ...params, hmac }, cfg.apiSecret)).toBe(true);
    expect(verifyOAuthHmac({ ...params, hmac: "00".repeat(32) }, cfg.apiSecret)).toBe(false);
  });

  it("exchanges a code for a token via injected fetch", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ access_token: "shpat_x", scope: "read_themes" }), {
        status: 200,
      })) as unknown as typeof fetch;
    const tok = await exchangeCodeForToken("acme.myshopify.com", "code", cfg, fakeFetch);
    expect(tok.accessToken).toBe("shpat_x");
  });
});

describe("connector/shopify — webhooks", () => {
  const secret = "whsecret";
  it("verifies a webhook body HMAC (base64)", () => {
    const body = JSON.stringify({ id: 1 });
    const hmac = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(verifyWebhookHmac(body, hmac, secret)).toBe(true);
    expect(verifyWebhookHmac(body, "bad", secret)).toBe(false);
    expect(verifyWebhookHmac(body, undefined, secret)).toBe(false);
  });

  it("maps topics and flags re-scans", () => {
    expect(mapTopicToEvent("app/uninstalled")).toBe("token");
    expect(mapTopicToEvent("themes/update")).toBe("webhook");
    expect(shouldRescan("themes/publish")).toBe(true);
    expect(shouldRescan("shop/update")).toBe(true);
    expect(shouldRescan("app_subscriptions/update")).toBe(false);
  });
});

describe("connector/shopify — admin client", () => {
  it("creates a script tag with sane defaults through injected fetch", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(JSON.stringify({ script_tag: { id: 9, src: "https://cdn/consent.js" } }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new ShopifyAdminClient({ shop: "acme.myshopify.com", accessToken: "shpat_x", fetchImpl: fakeFetch });
    const tag = await client.createScriptTag({ src: "https://cdn/consent.js" });
    expect(tag.id).toBe(9);
    expect(captured!.url).toContain("/admin/api/2024-10/script_tags.json");
    expect((captured!.init.headers as Record<string, string>)["X-Shopify-Access-Token"]).toBe("shpat_x");
  });

  it("serializes camelCase to Shopify snake_case (display_scope) and never drops the caller's scope", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({ script_tag: { id: 9, src: "https://cdn/consent.js", display_scope: "online_store" } }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const client = new ShopifyAdminClient({ shop: "acme.myshopify.com", accessToken: "shpat_x", fetchImpl: fakeFetch });
    const tag = await client.createScriptTag({ src: "https://cdn/consent.js", displayScope: "online_store" });
    const sent = JSON.parse(captured!.init.body as string);
    expect(sent.script_tag.display_scope).toBe("online_store");
    expect(sent.script_tag).not.toHaveProperty("displayScope");
    expect(tag.displayScope).toBe("online_store");
  });

  it("sends page body as body_html (not the ignored camelCase bodyHtml) and reads it back", async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({
          page: { id: 42, title: "Privacy Policy", handle: "privacy-policy", body_html: "<p>Policy</p>" },
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;
    const client = new ShopifyAdminClient({ shop: "acme.myshopify.com", accessToken: "shpat_x", fetchImpl: fakeFetch });
    const page = await client.createPage({ title: "Privacy Policy", bodyHtml: "<p>Policy</p>" });
    const sent = JSON.parse(captured!.init.body as string);
    expect(sent.page.body_html).toBe("<p>Policy</p>");
    expect(sent.page).not.toHaveProperty("bodyHtml");
    expect(page.bodyHtml).toBe("<p>Policy</p>");
    expect(page.id).toBe(42);
  });
});
