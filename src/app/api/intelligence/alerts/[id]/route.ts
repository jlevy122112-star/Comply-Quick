import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markAlertRead, resolveAlert } from "@/lib/intelligence/service";
import { UnauthorizedError, NotFoundError, ValidationError, errorResponse } from "@/services";

/**
 * Updates an alert: PATCH { action: "read" | "resolve" }. "resolve" also marks
 * it read. RLS ensures the alert belongs to the caller.
 */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
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
    const action = (body as { action?: unknown } | null)?.action;
    if (action !== "read" && action !== "resolve") {
      throw new ValidationError('action must be "read" or "resolve".');
    }

    const { id } = await ctx.params;
    const ok = action === "resolve" ? await resolveAlert(id) : await markAlertRead(id);
    if (!ok) throw new NotFoundError("Alert not found.");
    return NextResponse.json({ success: true, id, action });
  } catch (err) {
    return errorResponse(err);
  }
}
