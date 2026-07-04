import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listScans, getScanQuota } from "@/lib/scanner/service";
import { UnauthorizedError, errorResponse } from "@/services";

/** Lists the current user's scan history plus their current quota. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const [scans, quota] = await Promise.all([listScans(), getScanQuota()]);
    return NextResponse.json({ scans, quota });
  } catch (err) {
    return errorResponse(err);
  }
}
