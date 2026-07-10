import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send";
import { leadMagnetEmail } from "@/lib/email/templates";
import { FOUNDING_COUPON_CODE, FOUNDING_COUPON_REWARD, FOUNDING_MEMBER_LIMIT } from "@/lib/promo";
import { logger } from "@/services";

const log = logger.child({ module: "api:leads" });

// RFC-5322-lite: good enough to reject obvious junk without over-rejecting.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UTM_MAX = 200;

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, UTM_MAX) : null;
}

/**
 * Public lead-capture endpoint. Stores the email (first-touch UTM attribution)
 * and fires the lead-magnet email. Idempotent on email: a repeat submission is
 * accepted without error and without re-sending the welcome mail.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log.warn("lead capture skipped: supabase not configured");
    return NextResponse.json({ ok: true, stored: false });
  }

  const supabase = createAdminClient();

  // Upsert on the unique email so duplicate signups don't error; only a freshly
  // inserted row is "new" and triggers the welcome email.
  const { data: existing } = await supabase
    .from("leads")
    .select("id, welcomed, founding_member")
    .eq("email", email)
    .maybeSingle();

  const source = clean(body.source) ?? "landing";
  let founding = existing?.founding_member ?? false;

  if (!existing) {
    // First N unique signups qualify for the Founding 100 giveaway.
    const { count } = await supabase.from("leads").select("id", { count: "exact", head: true });
    founding = (count ?? 0) < FOUNDING_MEMBER_LIMIT;

    const { error } = await supabase.from("leads").insert({
      email,
      source,
      utm_source: clean(body.utm_source),
      utm_medium: clean(body.utm_medium),
      utm_campaign: clean(body.utm_campaign),
      founding_member: founding,
    });
    if (error) {
      log.error("lead insert failed", { reason: error.message });
      return NextResponse.json({ error: "store_failed" }, { status: 500 });
    }
  }

  const alreadyWelcomed = existing?.welcomed ?? false;
  let emailed = false;
  if (!alreadyWelcomed) {
    const content = leadMagnetEmail(
      founding ? { foundingCode: FOUNDING_COUPON_CODE, foundingReward: FOUNDING_COUPON_REWARD } : {}
    );
    const result = await sendTransactionalEmail({ to: email, ...content });
    emailed = result.delivered;
    if (result.delivered) {
      await supabase.from("leads").update({ welcomed: true }).eq("email", email);
    }
  }

  return NextResponse.json({
    ok: true,
    stored: true,
    emailed,
    founding,
    ...(founding ? { couponCode: FOUNDING_COUPON_CODE } : {}),
  });
}
