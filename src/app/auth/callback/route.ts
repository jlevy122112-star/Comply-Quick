import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analytics } from "@/services";
import { createSystemAuditLog } from "@/lib/audit";
import { getRequestIp } from "@/lib/audit/requests";

/** Accounts created within this window before a first sign-in count as signups. */
const SIGNUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Only allow same-origin relative destinations. A leading single "/" (but not
 * "//" or "/\", which browsers treat as protocol-relative absolute URLs) keeps
 * the redirect on our own origin and closes the open-redirect vector, since the
 * `redirect` query param is attacker-controllable in a crafted callback link.
 */
function safeRelativePath(raw: string | null): string {
  const fallback = "/dashboard/home";
  if (!raw || raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return fallback;
  return raw;
}

/**
 * Handles the magic-link redirect. Supabase appends a `code` that we exchange
 * for a session cookie, then redirect the user to their intended destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const channel = searchParams.get("channel") ?? undefined;
  const redirectPath = safeRelativePath(searchParams.get("redirect"));
  const ip = await getRequestIp(request.headers);

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user;
      const isSignup = user ? Date.now() - new Date(user.created_at).getTime() <= SIGNUP_WINDOW_MS : false;
      if (user) {
        if (isSignup) {
          analytics.track({ event: "signup", userId: user.id, channel });
        }
        await createSystemAuditLog({
          eventType: "AUTH_LOGIN",
          actorType: "USER",
          actorId: user.id,
          targetResource: "auth/callback",
          ipAddress: ip,
          details: { channel, isSignup, redirect: redirectPath },
        });
      }
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }

    await createSystemAuditLog({
      eventType: "AUTH_FAILED",
      actorType: "USER",
      actorId: null,
      targetResource: "auth/callback",
      ipAddress: ip,
      details: { reason: error.message, code: code.slice(0, 8), redirect: redirectPath },
    });
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
