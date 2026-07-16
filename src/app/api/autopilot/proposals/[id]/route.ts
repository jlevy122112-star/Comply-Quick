import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveProposal, canUseAutopilot, type ResolveAction } from "@/lib/autopilot/service";
import { paidPlansLabel } from "@/lib/tier-copy";
import { UnauthorizedError, ForbiddenError, ValidationError, NotFoundError, errorResponse } from "@/services";

/** Accepts or rejects a proposal: PATCH { action: "accept" | "reject" }. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    if (!(await canUseAutopilot())) {
      throw new ForbiddenError(`Compliance Autopilot requires one of the ${paidPlansLabel()} plans.`);
    }

    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const action = (body as { action?: string })?.action;
    if (action !== "accept" && action !== "reject") {
      throw new ValidationError("action must be 'accept' or 'reject'");
    }

    const ok = await resolveProposal(id, action as ResolveAction);
    if (!ok) throw new NotFoundError("Proposal not found or already resolved.");
    return NextResponse.json({ success: true, id, action });
  } catch (err) {
    return errorResponse(err);
  }
}
