import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and guards protected
 * routes. Unauthenticated users hitting a protected route are redirected to
 * /login.
 */
const PROTECTED_PREFIXES = ["/dashboard/home"];

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

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
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
