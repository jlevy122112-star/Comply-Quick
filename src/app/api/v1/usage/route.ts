import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { getApiUsageSummaryForUser } from "@/lib/api/usage";
import { errorResponse } from "@/services";

/** Returns the caller's metered usage for the current calendar month. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await authenticateApiRequest(request);
    const usage = await getApiUsageSummaryForUser(ctx.userId);
    return NextResponse.json({ usage }, { headers: ctx.rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
