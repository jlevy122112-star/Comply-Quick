// OAuth Compliance Connector — Shopify Admin API client (reference write adapter).
//
// Thin wrapper over the Shopify Admin REST API for the resources the compliance
// agent touches: script tags (consent banner injection) and pages (policy
// publishing). Every mutating call returns enough to snapshot the prior state
// for rollback. Network I/O is injected so the adapter is unit-testable.

export interface ShopifyClientConfig {
  shop: string;
  accessToken: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
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

export class ShopifyAdminClient {
  private readonly base: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: ShopifyClientConfig) {
    const version = cfg.apiVersion ?? "2024-10";
    this.base = `https://${cfg.shop}/admin/api/${version}`;
    this.token = cfg.accessToken;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      method,
      headers: {
        "X-Shopify-Access-Token": this.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Shopify API ${method} ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async listScriptTags(): Promise<ScriptTag[]> {
    const json = await this.request<{ script_tags: ScriptTag[] }>("GET", "/script_tags.json");
    return json.script_tags;
  }

  async createScriptTag(tag: ScriptTag): Promise<ScriptTag> {
    const json = await this.request<{ script_tag: ScriptTag }>("POST", "/script_tags.json", {
      script_tag: { event: "onload", display_scope: "all", ...tag },
    });
    return json.script_tag;
  }

  async deleteScriptTag(id: number): Promise<void> {
    await this.request<unknown>("DELETE", `/script_tags/${id}.json`);
  }

  async createPage(page: ShopifyPage): Promise<ShopifyPage> {
    const json = await this.request<{ page: ShopifyPage }>("POST", "/pages.json", { page });
    return json.page;
  }

  async updatePage(id: number, page: Partial<ShopifyPage>): Promise<ShopifyPage> {
    const json = await this.request<{ page: ShopifyPage }>("PUT", `/pages/${id}.json`, { page: { id, ...page } });
    return json.page;
  }
}
