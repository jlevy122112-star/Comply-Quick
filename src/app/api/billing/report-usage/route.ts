import { NextResponse } from "next/server";
import { reportMeteredUsage } from "@/lib/api/stripe-metered";
import { previousPeriod, currentPeriod } from "@/lib/billing/usage";
import { UnauthorizedError, errorResponse, logger } from "@/services";

const log = logger.child({ module: "usage-report-cron" });

/**
 * Metered-usage reporting cron. Reports accrued API + scan-overage meters to
 * Stripe billing meter events. Runs at period boundaries: reports the just-closed
 * month (default) plus the current month so late-arriving usage still bills.
 * Authenticated by the shared CRON_SECRET so it cannot be triggered publicly.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!secret || provided !== secret) throw new UnauthorizedError("Invalid cron secret.");

    log.info("Usage reporting triggered");
    const results = await Promise.all([reportMeteredUsage(previousPeriod()), reportMeteredUsage(currentPeriod())]);
    return NextResponse.json({ success: true, results });
  } catch (err) {
    return errorResponse(err);
  }
}
