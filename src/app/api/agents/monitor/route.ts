import { NextResponse } from "next/server";
import { runComplianceMonitoringCycle } from "@/lib/agents";
import { UnauthorizedError, errorResponse, logger } from "@/services";

const log = logger.child({ module: "agent-monitor-cron" });

/**
 * Regulation-monitoring cron entrypoint. Runs the full agent cycle: the
 * Regulation Monitor sweeps every appropriate agency for real-world changes,
 * then the Autopilot Remediation Agent offers affected users a human-approvable
 * compliance edit plan (propose-only). Authenticated by the shared CRON_SECRET.
 *
 * Scheduled daily via the Supabase Edge Function / Vercel cron.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!secret || provided !== secret) throw new UnauthorizedError("Invalid cron secret.");

    log.info("Regulation monitoring cycle triggered");
    const result = await runComplianceMonitoringCycle();
    return NextResponse.json({
      success: true,
      changesDetected: result.monitor.findings.length,
      proposalsCreated: result.remediation.proposalsCreated,
      summary: result.monitor.summary,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
