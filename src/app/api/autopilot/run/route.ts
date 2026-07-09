import { NextResponse } from "next/server";
import { runAutopilot, type RegulationUpdate } from "@/lib/autopilot/service";
import { ValidationError, errorResponse, logger } from "@/services";
import { assertCronAuthorized } from "@/lib/api/cron";

const log = logger.child({ module: "autopilot-cron" });

/**
 * Autopilot cron entrypoint. Invoked by the Supabase scheduled Edge Function
 * (see supabase/functions/autopilot-daily) with a curated feed of observed
 * regulation sources. Authenticated by a shared CRON_SECRET so it cannot be
 * triggered by the public.
 *
 * Body: { updates: RegulationUpdate[] }
 */
export async function POST(request: Request) {
  try {
    assertCronAuthorized(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }

    const updates = (body as { updates?: unknown })?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new ValidationError("updates must be a non-empty array of regulation sources.");
    }
    for (const u of updates as Partial<RegulationUpdate>[]) {
      if (
        !u ||
        typeof u.id !== "string" ||
        typeof u.name !== "string" ||
        typeof u.content !== "string" ||
        u.region == null
      ) {
        throw new ValidationError("each update requires { id, name, region, content }.");
      }
    }

    log.info("Autopilot run triggered", { updateCount: updates.length });
    const result = await runAutopilot(updates as RegulationUpdate[]);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}
