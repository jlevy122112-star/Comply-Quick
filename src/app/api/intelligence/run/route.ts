import { NextResponse } from "next/server";
import { runIntelligence } from "@/lib/intelligence/service";
import { UnauthorizedError, errorResponse, logger } from "@/services";

const log = logger.child({ module: "intelligence-cron" });

/**
 * Intelligence cron entrypoint. Invoked by the Supabase scheduled Edge Function
 * (see supabase/functions/intelligence-weekly). Re-scans every active, due
 * monitor owned by a premium user and raises alerts on increased risk.
 * Authenticated by the shared CRON_SECRET so it cannot be triggered publicly.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!secret || provided !== secret) throw new UnauthorizedError("Invalid cron secret.");

    log.info("Intelligence run triggered");
    const result = await runIntelligence();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
