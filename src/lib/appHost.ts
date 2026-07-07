/**
 * Shared resolution of the application's own host(s).
 *
 * This is a pure module (no Next.js/runtime imports) so it can be used from both
 * the request proxy and server-side providers (e.g. Cloudflare custom-hostname
 * provisioning). Centralizing it keeps the `NEXT_PUBLIC_APP_HOST` contract
 * (a comma-separated list) consistent everywhere.
 */

/** Last-resort default so an unset/misconfigured env var can never route the
 * app's own marketing site into the white-label portal. */
export const PRODUCT_DEFAULT_HOST = "comply-quick.com";

/** Normalize a host to its bare form: strip any port and a leading `www.`. */
export function bareHost(host: string): string {
  return host
    .split(":")[0]
    .toLowerCase()
    .replace(/^www\./, "");
}

/** Extract the hostname from a URL string, or undefined if it isn't a valid URL. */
export function hostFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

/** Configured app hosts (raw, trimmed, non-empty) from NEXT_PUBLIC_APP_HOST. */
function configuredAppHosts(): string[] {
  return (process.env.NEXT_PUBLIC_APP_HOST ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

/**
 * The set of primary (bare) hosts served directly by the app rather than routed
 * to the white-label portal. Derived from `NEXT_PUBLIC_APP_HOST`, the
 * `NEXT_PUBLIC_SITE_URL` hostname, a hardcoded product default, and localhost.
 * Apex and `www.` variants both resolve to the same bare host.
 */
export function primaryHosts(): Set<string> {
  return new Set(
    [
      ...configuredAppHosts(),
      hostFromUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? "",
      PRODUCT_DEFAULT_HOST,
      "localhost",
      "127.0.0.1",
    ]
      .map((h) => h.trim())
      .filter(Boolean)
      .map(bareHost)
  );
}

/**
 * A single canonical app hostname (never a comma-separated list, never a port)
 * — suitable as a CNAME target for client custom domains. Prefers the first
 * configured `NEXT_PUBLIC_APP_HOST`, then the site URL host, then the product
 * default. Any `:port` is stripped so the value is always a valid DNS target.
 */
export function canonicalAppHost(): string {
  const host = configuredAppHosts()[0] ?? hostFromUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? PRODUCT_DEFAULT_HOST;
  return host.split(":")[0];
}
