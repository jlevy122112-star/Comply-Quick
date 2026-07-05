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
 */
const PRIMARY_HOSTS = new Set(
  [process.env.NEXT_PUBLIC_APP_HOST, "localhost", "127.0.0.1"].filter(Boolean).map((h) => (h as string).toLowerCase())
);

function isPrimaryHost(host: string): boolean {
  const h = host.split(":")[0].toLowerCase();
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
