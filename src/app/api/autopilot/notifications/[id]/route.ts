import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markNotificationRead } from "@/lib/autopilot/service";
import { UnauthorizedError, NotFoundError, errorResponse } from "@/services";

/** Marks a notification read: PATCH (no body). */
export async function PATCH(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await ctx.params;
    const ok = await markNotificationRead(id);
    if (!ok) throw new NotFoundError("Notification not found.");
    return NextResponse.json({ success: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
