import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteMonitor } from "@/lib/intelligence/service";
import { UnauthorizedError, NotFoundError, errorResponse } from "@/services";

/** Removes a monitor: DELETE. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await ctx.params;
    const ok = await deleteMonitor(id);
    if (!ok) throw new NotFoundError("Monitor not found.");
    return NextResponse.json({ success: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
