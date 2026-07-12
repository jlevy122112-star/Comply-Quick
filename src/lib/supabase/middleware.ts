import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decodeJwtAal, mfaGate } from "@/lib/auth/mfa";

/**
 * Refreshes the Supabase auth session on every request and guards protected
 * routes. Unauthenticated users hitting a protected route are redirected to
 * /login.
 */
const PROTECTED_PREFIXES = ["/dashboard"];

/** Where sessions with an unmet second factor are sent to complete the challenge. */
const MFA_CHALLENGE_PATH = "/auth/mfa";

/** Cookie that carries a partner referral code from first touch until checkout. */
const REFERRAL_COOKIE = "cq_ref";
const REFERRAL_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

/**
 * Persists a partner referral code (?ref=<code>) into a first-party cookie so it
 * survives navigation and (eventual) sign-up until the referred user checks out.
 * First touch wins — an existing referral cookie is not overwritten.
 */
function captureReferral(request: NextRequest, response: NextResponse) {
  const code = request.nextUrl.searchParams.get("ref");
  if (!code) return;
  if (request.cookies.get(REFERRAL_COOKIE)) return; // first touch wins
  const trimmed = code.trim().slice(0, 64);
  if (!trimmed) return;
  response.cookies.set(REFERRAL_COOKIE, trimmed, {
    maxAge: REFERRAL_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function updateSession(request: NextRequest, csp?: { nonce: string; policy: string }) {
  // Builds the init for NextResponse.next, re-reading `request.headers` each time
  // so any cookies Supabase just refreshed (via request.cookies.set in setAll)
  // are forwarded to the render — while re-stamping the per-request CSP nonce the
  // proxy asked us to propagate so Next.js can nonce its own scripts.
  const nextInit = () => {
    if (!csp) return { request };
    const headers = new Headers(request.headers);
    headers.set("x-nonce", csp.nonce);
    headers.set("content-security-policy", csp.policy);
    return { request: { headers } };
  };

  let supabaseResponse = NextResponse.next(nextInit());

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  // When Supabase isn't configured (missing env vars) the auth client can't be
  // constructed. Rather than throw a 500 across the entire site — including
  // public marketing pages — degrade gracefully: keep public routes serving and
  // send protected routes to /login (we can't verify a session without config).
  if (!supabaseUrl || !supabaseAnonKey) {
    if (PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", `${path}${request.nextUrl.search}`);
      const redirectResponse = NextResponse.redirect(url);
      captureReferral(request, redirectResponse);
      return redirectResponse;
    }
    captureReferral(request, supabaseResponse);
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next(nextInit());
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", `${path}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(url);
    captureReferral(request, redirectResponse);
    return redirectResponse;
  }

  // Second-factor gate: an authenticated session that has a verified TOTP factor
  // but hasn't cleared it (aal1 → aal2) is sent to the challenge page before it
  // can reach any protected route — regardless of how it signed in (password,
  // magic link, OAuth). Only sessions that actually have a verified factor read
  // the `aal` claim (locally, no network round-trip); everyone else skips it.
  if (isProtected && user && (user.factors ?? []).some((f) => f.status === "verified")) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (mfaGate(decodeJwtAal(session?.access_token), "aal2") === "challenge") {
      const url = request.nextUrl.clone();
      url.pathname = MFA_CHALLENGE_PATH;
      // Preserve the full original target (path + query) so deep links survive.
      url.searchParams.set("redirect", `${path}${request.nextUrl.search}`);
      const redirectResponse = NextResponse.redirect(url);
      captureReferral(request, redirectResponse);
      return redirectResponse;
    }
  }

  captureReferral(request, supabaseResponse);
  return supabaseResponse;
}
