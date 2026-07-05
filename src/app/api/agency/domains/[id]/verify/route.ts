import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyDomain } from "@/lib/agency/service";
import { errorResponse, UnauthorizedError } from "@/services";

/** Re-checks a custom domain with the provider and updates its status. */
export async function POST(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const { id } = await ctx.params;
    const domain = await verifyDomain(id);
    return NextResponse.json({ domain });
  } catch (err) {
    return errorResponse(err);
  }
}
