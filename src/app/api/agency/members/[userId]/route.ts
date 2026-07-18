import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { removeMember } from "@/lib/agency/service";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";
import { updateMemberRole } from "@/lib/agency/service";
import { AGENCY_ROLES, type AgencyRole } from "@/lib/agency/roles";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** Removes a team seat. The owner seat is protected. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const body = (await request.json()) as Record<string, unknown>;
    const role = body.role;
    if (typeof role !== "string" || !AGENCY_ROLES.includes(role as AgencyRole) || role === "owner") {
      throw new ValidationError("Choose a valid agency role.");
    }
    const { userId } = await params;
    const member = await updateMemberRole(userId, role as AgencyRole);
    return NextResponse.json({ member }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
