import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAlertFix } from "@/lib/intelligence/service";
import { UnauthorizedError, NotFoundError, errorResponse } from "@/services";

/**
 * "Fix It" — returns an AI-generated remediation plan for an alert, cached on
 * the alert after first generation. POST (no body).
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await ctx.params;
    const recommendation = await getAlertFix(id);
    if (recommendation === null) throw new NotFoundError("Alert not found.");
    return NextResponse.json({ recommendation });
  } catch (err) {
    return errorResponse(err);
  }
}
