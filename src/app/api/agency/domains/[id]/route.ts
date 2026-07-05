import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteDomain } from "@/lib/agency/service";
import { errorResponse, UnauthorizedError, NotFoundError } from "@/services";

/** Removes a custom domain. */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const { id } = await ctx.params;
    const ok = await deleteDomain(id);
    if (!ok) throw new NotFoundError("Domain not found.");
    return NextResponse.json({ success: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
