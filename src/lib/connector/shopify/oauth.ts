// OAuth Compliance Connector — Shopify OAuth handshake (reference platform).
//
// Pure helpers for the Shopify OAuth 2.0 authorization-code flow plus the
// request-authenticity checks Shopify requires. Network I/O (the token
// exchange) is injected as a `fetchImpl` so the whole flow is unit-testable
// without hitting Shopify.

import { createHmac, timingSafeEqual } from "node:crypto";

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

/** Scopes the compliance agent requests (least-privilege for the reference build). */
export const SHOPIFY_SCOPES = [
  "read_themes",
  "write_themes",
  "read_script_tags",
  "write_script_tags",
  "read_content",
  "write_content",
] as const;

export interface ShopifyOAuthConfig {
  apiKey: string;
  apiSecret: string;
  /** Absolute callback URL registered with the Shopify app. */
  redirectUri: string;
}

/** Validates a shop domain to prevent open-redirect / host-injection. */
export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN.test(shop);
}

/** Builds the authorization URL the merchant is redirected to. */
export function buildAuthorizeUrl(shop: string, cfg: ShopifyOAuthConfig, state: string): string {
  if (!isValidShopDomain(shop)) throw new Error("invalid shop domain");
  const params = new URLSearchParams({
    client_id: cfg.apiKey,
    scope: SHOPIFY_SCOPES.join(","),
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verifies the HMAC on an OAuth callback query. Shopify signs all params except
 * `hmac`/`signature` with the app secret (hex SHA-256 over the sorted,
 * URL-encoded query string). Uses a constant-time compare.
 */
export function verifyOAuthHmac(query: Record<string, string>, apiSecret: string): boolean {
  const { hmac, signature, ...rest } = query;
  if (!hmac) return false;
  void signature;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const digest = createHmac("sha256", apiSecret).update(message).digest("hex");
  return safeEqualHex(digest, hmac);
}

export interface ShopifyToken {
  accessToken: string;
  scope: string;
}

/** Exchanges an authorization code for an access token via the injected fetch. */
export async function exchangeCodeForToken(
  shop: string,
  code: string,
  cfg: ShopifyOAuthConfig,
  fetchImpl: typeof fetch = fetch
): Promise<ShopifyToken> {
  if (!isValidShopDomain(shop)) throw new Error("invalid shop domain");
  const res = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: cfg.apiKey, client_secret: cfg.apiSecret, code }),
  });
  if (!res.ok) throw new Error(`Shopify token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string; scope?: string };
  if (!json.access_token) throw new Error("Shopify token exchange: missing access_token");
  return { accessToken: json.access_token, scope: json.scope ?? "" };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
