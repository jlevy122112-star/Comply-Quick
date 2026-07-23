// OAuth Compliance Connector — Shopify Admin API client (reference write adapter).
//
// Thin wrapper over the Shopify Admin REST API for the resources the compliance
// agent touches: script tags (consent banner injection) and pages (policy
// publishing). Every mutating call returns enough to snapshot the prior state
// for rollback. Network I/O is injected so the adapter is unit-testable.
//
// The public interfaces use camelCase; the Shopify REST API uses snake_case
// (`display_scope`, `body_html`). We translate on the wire in both directions so
// callers never see snake_case and, critically, page/script payloads are never
// silently dropped by Shopify ignoring an unknown camelCase key.

import { assertPublicScanHost, getScanDispatcher } from "@/lib/security";

export interface ShopifyClientConfig {
  shop: string;
  accessToken: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  assertHost?: (hostname: string) => Promise<unknown>;
}

export interface ScriptTag {
  id?: number;
  src: string;
  event?: "onload";
  displayScope?: "all" | "online_store" | "order_status";
}

export interface ShopifyPage {
  id?: number;
  title: string;
  handle?: string;
  bodyHtml: string;
}

// ── Wire shapes (exactly what Shopify sends/expects) ────────────────────────
interface ScriptTagWire {
  id?: number;
  src: string;
  event?: "onload";
  display_scope?: "all" | "online_store" | "order_status";
}

interface ShopifyPageWire {
  id?: number;
  title?: string;
  handle?: string;
  body_html?: string;
}

function toScriptTagWire(tag: ScriptTag): ScriptTagWire {
  const { displayScope, ...rest } = tag;
  return { ...rest, ...(displayScope !== undefined ? { display_scope: displayScope } : {}) };
}

function fromScriptTagWire(wire: ScriptTagWire): ScriptTag {
  const { display_scope, ...rest } = wire;
  return { ...rest, ...(display_scope !== undefined ? { displayScope: display_scope } : {}) };
}

function toPageWire(page: Partial<ShopifyPage>): ShopifyPageWire {
  const { bodyHtml, ...rest } = page;
  return { ...rest, ...(bodyHtml !== undefined ? { body_html: bodyHtml } : {}) };
}

function fromPageWire(wire: ShopifyPageWire): ShopifyPage {
  // Build explicitly so a null from the API (title/body_html on drafts, handle
  // on unpublished pages) can never leak through as null and violate the types.
  const { id, title, handle, body_html } = wire;
  return {
    ...(id !== undefined ? { id } : {}),
    ...(handle != null ? { handle } : {}),
    title: title ?? "",
    bodyHtml: body_html ?? "",
  };
}

export class ShopifyAdminClient {
  private readonly base: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly assertHost: (hostname: string) => Promise<unknown>;
  private readonly injectedFetch: boolean;
  private readonly shouldValidateHost: boolean;

  constructor(cfg: ShopifyClientConfig) {
    const version = cfg.apiVersion ?? "2024-10";
    this.base = `https://${cfg.shop}/admin/api/${version}`;
    this.token = cfg.accessToken;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.assertHost = cfg.assertHost ?? assertPublicScanHost;
    this.injectedFetch = cfg.fetchImpl !== undefined;
    this.shouldValidateHost = cfg.assertHost !== undefined || !this.injectedFetch;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (this.shouldValidateHost) await this.assertHost(new URL(this.base).hostname);
    const headers: Record<string, string> = {
      "X-Shopify-Access-Token": this.token,
      Accept: "application/json",
    };
    // Content-Type only describes a request body; omit it on bodyless requests.
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const init: RequestInit & { dispatcher?: unknown } = {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    };
    if (!this.injectedFetch) init.dispatcher = getScanDispatcher();
    const res = await this.fetchImpl(`${this.base}${path}`, init);
    if (!res.ok) throw new Error(`Shopify API ${method} ${path} failed: ${res.status}`);
    // Shopify returns an empty body for 204/DELETE; don't try to parse JSON then.
    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return undefined as T;
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async listScriptTags(): Promise<ScriptTag[]> {
    const json = await this.request<{ script_tags: ScriptTagWire[] }>("GET", "/script_tags.json");
    return (json?.script_tags ?? []).map(fromScriptTagWire);
  }

  async createScriptTag(tag: ScriptTag): Promise<ScriptTag> {
    const json = await this.request<{ script_tag: ScriptTagWire }>("POST", "/script_tags.json", {
      script_tag: { event: "onload", display_scope: "all", ...toScriptTagWire(tag) },
    });
    return fromScriptTagWire(json.script_tag);
  }

  async deleteScriptTag(id: number): Promise<void> {
    await this.request<unknown>("DELETE", `/script_tags/${id}.json`);
  }

  async createPage(page: ShopifyPage): Promise<ShopifyPage> {
    const json = await this.request<{ page: ShopifyPageWire }>("POST", "/pages.json", {
      page: toPageWire(page),
    });
    return fromPageWire(json.page);
  }

  async listPages(): Promise<ShopifyPage[]> {
    const json = await this.request<{ pages: ShopifyPageWire[] }>("GET", "/pages.json");
    return (json?.pages ?? []).map(fromPageWire);
  }

  async deletePage(id: number): Promise<void> {
    await this.request<unknown>("DELETE", `/pages/${id}.json`);
  }

  async updatePage(id: number, page: Partial<ShopifyPage>): Promise<ShopifyPage> {
    const json = await this.request<{ page: ShopifyPageWire }>("PUT", `/pages/${id}.json`, {
      // `id` last so the path id always wins over any id in the partial payload.
      page: { ...toPageWire(page), id },
    });
    return fromPageWire(json.page);
  }
}
