import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeMember } from "@/lib/agency/service";
import { InMemoryRateLimiter, getClientKey, enforceRateLimit, errorResponse, UnauthorizedError } from "@/services";

const limiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

/** Removes a team seat. The owner seat is protected. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const rateHeaders = enforceRateLimit(limiter.check(getClientKey(request.headers)));
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const { userId } = await params;
    const removed = await removeMember(userId);
    return NextResponse.json({ removed }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
