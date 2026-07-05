import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAlerts } from "@/lib/intelligence/service";
import { UnauthorizedError, errorResponse } from "@/services";

/** Lists the current user's alerts. `?resolved=1` includes resolved ones. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const includeResolved = request.nextUrl.searchParams.get("resolved") === "1";
    const alerts = await listAlerts(includeResolved);
    return NextResponse.json({ alerts });
  } catch (err) {
    return errorResponse(err);
  }
}
