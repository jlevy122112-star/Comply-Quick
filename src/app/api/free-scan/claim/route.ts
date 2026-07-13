import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter, enforceRateLimit, errorResponse, getClientKey, logger } from "@/services";

const log = logger.child({ module: "api:free-scan:claim" });
const limiter = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNIQUE_VIOLATION = "23505";

export async function POST(request: Request) {
  let rateHeaders: Record<string, string>;
  try {
    rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (error) {
    return errorResponse(error);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: rateHeaders });
  }

  const rawEmail = (payload as { email?: unknown } | null)?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400, headers: rateHeaders });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log.warn("free scan claim rejected: supabase not configured");
    return NextResponse.json({ error: "service_unavailable" }, { status: 503, headers: rateHeaders });
  }

  const { data, error } = await createAdminClient()
    .from("free_scan_claims")
    .insert({ email, source: "exit_intent" })
    .select("token")
    .single();

  if (error?.code === UNIQUE_VIOLATION) {
    return NextResponse.json({ error: "already_claimed" }, { status: 409, headers: rateHeaders });
  }
  if (error || !data?.token) {
    log.error("free scan claim insert failed", { reason: error?.message ?? "missing_token" });
    return NextResponse.json({ error: "claim_failed" }, { status: 500, headers: rateHeaders });
  }

  return NextResponse.json({ ok: true, token: data.token }, { status: 201, headers: rateHeaders });
}
