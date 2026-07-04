import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listNotifications } from "@/lib/autopilot/service";
import { UnauthorizedError, errorResponse } from "@/services";

/** Lists the current user's in-app notifications. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const notifications = await listNotifications();
    return NextResponse.json({ notifications });
  } catch (err) {
    return errorResponse(err);
  }
}
