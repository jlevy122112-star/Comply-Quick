import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMonitors, createMonitor, MonitorLimitError } from "@/lib/intelligence/service";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
} from "@/services";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Lists the current user's monitors. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const monitors = await listMonitors();
    return NextResponse.json({ monitors });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Registers a URL for weekly monitoring (paid-plan feature). Body: { url, label? }. */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    const url = (body as { url?: unknown } | null)?.url;
    const label = (body as { label?: unknown } | null)?.label;
    if (typeof url !== "string" || url.trim().length === 0) {
      throw new ValidationError("A website URL is required.");
    }

    try {
      const monitor = await createMonitor(url, typeof label === "string" ? label : "");
      return NextResponse.json({ monitor }, { headers: rateHeaders });
    } catch (err) {
      if (err instanceof MonitorLimitError) throw new ForbiddenError(err.message);
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
