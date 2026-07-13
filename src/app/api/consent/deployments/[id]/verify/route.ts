import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyConsentDeployment } from "@/lib/consent/deployments";
import {
  createRateLimiter,
  enforceRateLimit,
  errorResponse,
  getClientKey,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const { id } = await params;
    const result = await verifyConsentDeployment(id);
    if (!result.ok) throw new ValidationError(result.error);
    return NextResponse.json({ deployment: result.value }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
