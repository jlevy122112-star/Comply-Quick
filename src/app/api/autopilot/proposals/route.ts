import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listProposals, canUseAutopilot } from "@/lib/autopilot/service";
import { paidPlansLabel } from "@/lib/tier-copy";
import { UnauthorizedError, ForbiddenError, errorResponse } from "@/services";

/** Lists the current user's Autopilot proposals (paid-plan gated). */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    if (!(await canUseAutopilot())) {
      throw new ForbiddenError(`Compliance Autopilot requires one of the ${paidPlansLabel()} plans.`);
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") === "all" ? "all" : "proposed";
    const proposals = await listProposals(status);
    return NextResponse.json({ proposals });
  } catch (err) {
    return errorResponse(err);
  }
}
