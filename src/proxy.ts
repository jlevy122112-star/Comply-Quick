import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { bareHost, primaryHosts } from "@/lib/appHost";
import { buildCsp, cspHeaderName, generateNonce } from "@/lib/security/csp";
import {
  EXPERIMENT_ID_COOKIE,
  PRICING_EXPERIMENT_COOKIE,
  resolveServerPricingVariant,
} from "@/lib/experiments/pricing";
import { isProfitOptimizationEnabled } from "@/lib/optimizations/flags";

/**
 * White-label custom-domain routing (Phase 5).
 *
 * A request arriving on a custom (client-owned) domain rather than the primary
 * app host is rewritten to the domain-scoped portal, which resolves the agency
 * by that hostname. The check is a pure string comparison (no DB/network), so
 * traffic on the primary host, Vercel preview hosts, and localhost is unaffected
 * and continues to the normal Supabase session refresh.
 *
 * The set of primary hosts (see `@/lib/appHost`) is derived from several sources
 * so that the app's own marketing/dashboard domain is ALWAYS treated as primary
 * — even if the `NEXT_PUBLIC_APP_HOST` env var is misconfigured or absent (an
 * unset var must never route the main site into the portal and 404 it). Apex and
 * `www.` variants are both recognized.
 */
const PRIMARY_HOSTS = primaryHosts();

function isPrimaryHost(host: string): boolean {
  const h = bareHost(host);
  return PRIMARY_HOSTS.has(h) || h.endsWith(".vercel.app") || h === "vercel.app";
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const path = request.nextUrl.pathname;

  // Per-request CSP nonce. Stamp it onto the request headers Next.js renders
  // with (both `x-nonce` for our own components and the CSP header Next parses
  // to nonce its scripts), and set the browser-facing CSP header on whatever
  // response we ultimately return.
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const withCsp = (response: NextResponse): NextResponse => {
    response.headers.set(cspHeaderName(), csp);
    return response;
  };

  const withExperimentCookies = (response: NextResponse): NextResponse => {
    if (!isProfitOptimizationEnabled()) return response;
    const existingId = request.cookies.get(EXPERIMENT_ID_COOKIE)?.value ?? null;
    const { variant, id } = resolveServerPricingVariant(existingId);
    response.cookies.set(EXPERIMENT_ID_COOKIE, id, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
    response.cookies.set(PRICING_EXPERIMENT_COOKIE, variant, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  };

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
    const rewriteHeaders = new Headers(request.headers);
    rewriteHeaders.set("x-nonce", nonce);
    rewriteHeaders.set("content-security-policy", csp);
    return withExperimentCookies(withCsp(NextResponse.rewrite(url, { request: { headers: rewriteHeaders } })));
  }

  return withExperimentCookies(withCsp(await updateSession(request, { nonce, policy: csp })));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets and image optimization files.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
