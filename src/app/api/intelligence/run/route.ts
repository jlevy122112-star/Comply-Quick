import { NextResponse } from "next/server";
import { runIntelligence } from "@/lib/intelligence/service";
import { errorResponse, logger } from "@/services";
import { assertCronAuthorized } from "@/lib/api/cron";

const log = logger.child({ module: "intelligence-cron" });

/**
 * Intelligence cron entrypoint. Invoked by the Supabase scheduled Edge Function
 * (see supabase/functions/intelligence-weekly). Re-scans every active, due
 * monitor owned by a premium user and raises alerts on increased risk.
 * Authenticated by the shared CRON_SECRET so it cannot be triggered publicly.
 */
export async function POST(request: Request) {
  try {
    assertCronAuthorized(request);

    log.info("Intelligence run triggered");
    const result = await runIntelligence();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
