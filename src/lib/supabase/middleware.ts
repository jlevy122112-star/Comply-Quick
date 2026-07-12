import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and guards protected
 * routes. Unauthenticated users hitting a protected route are redirected to
 * /login.
 */
const PROTECTED_PREFIXES = ["/dashboard"];

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

export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  // When the caller (proxy) has stamped a per-request nonce onto `requestHeaders`,
  // forward those headers to the rendered request so Next.js can read the nonce
  // and apply it to its scripts. Falls back to the original request otherwise.
  const nextInit = requestHeaders ? { request: { headers: requestHeaders } } : { request };
  let supabaseResponse = NextResponse.next(nextInit);

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
      url.searchParams.set("redirect", path);
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
        supabaseResponse = NextResponse.next(nextInit);
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
    url.searchParams.set("redirect", path);
    const redirectResponse = NextResponse.redirect(url);
    captureReferral(request, redirectResponse);
    return redirectResponse;
  }

  captureReferral(request, supabaseResponse);
  return supabaseResponse;
}
