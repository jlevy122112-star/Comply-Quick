import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * White-label custom-domain routing (Phase 5).
 *
 * A request arriving on a custom (client-owned) domain rather than the primary
 * app host is rewritten to the domain-scoped portal, which resolves the agency
 * by that hostname. The check is a pure string comparison (no DB/network), so
 * traffic on the primary host, Vercel preview hosts, and localhost is unaffected
 * and continues to the normal Supabase session refresh.
 *
 * The set of primary hosts is derived from several sources so that the app's own
 * marketing/dashboard domain is ALWAYS treated as primary — even if the
 * `NEXT_PUBLIC_APP_HOST` env var is misconfigured or absent (an unset var must
 * never route the main site into the portal and 404 it):
 *   • `NEXT_PUBLIC_APP_HOST` — comma-separated list of app hosts.
 *   • `NEXT_PUBLIC_SITE_URL` — the canonical site URL (its hostname).
 *   • a hardcoded product default (`comply-quick.com`) as a last-resort safety net.
 *   • `localhost` / `127.0.0.1` for local dev.
 * Every host is normalized to its bare form (port stripped, leading `www.`
 * removed) so the apex and `www.` variants are both recognized.
 */
const PRODUCT_DEFAULT_HOST = "comply-quick.com";

function bareHost(host: string): string {
  return host
    .split(":")[0]
    .toLowerCase()
    .replace(/^www\./, "");
}

function hostFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

const PRIMARY_HOSTS = new Set(
  [
    ...(process.env.NEXT_PUBLIC_APP_HOST ?? "").split(","),
    hostFromUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? "",
    PRODUCT_DEFAULT_HOST,
    "localhost",
    "127.0.0.1",
  ]
    .map((h) => h.trim())
    .filter(Boolean)
    .map(bareHost)
);

function isPrimaryHost(host: string): boolean {
  const h = bareHost(host);
  return PRIMARY_HOSTS.has(h) || h.endsWith(".vercel.app") || h === "vercel.app";
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;

  // On a custom domain, serve the branded white-label portal at the root and let
  // app internals (portal pages, static assets, the Sentry tunnel) pass through
  // untouched.
  if (
    host &&
    !isPrimaryHost(host) &&
    !path.startsWith("/portal") &&
    !path.startsWith("/_next") &&
    !path.startsWith("/monitoring")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/portal/domain/${encodeURIComponent(host.split(":")[0].toLowerCase())}`;
    return NextResponse.rewrite(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
