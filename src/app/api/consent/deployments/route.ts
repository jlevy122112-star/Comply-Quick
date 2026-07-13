import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createConsentDeployment, listConsentDeployments, normalizeConsentDeployment } from "@/lib/consent/deployments";
import {
  createRateLimiter,
  enforceRateLimit,
  errorResponse,
  getClientKey,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;
    const deployments = await listConsentDeployments(projectId);
    return NextResponse.json({ deployments });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
    await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    const input = normalizeConsentDeployment(body);
    if (!input.ok) throw new ValidationError(input.error);
    const result = await createConsentDeployment(input.value);
    if (!result.ok) throw new ValidationError(result.error);
    return NextResponse.json({ deployment: result.value }, { status: 201, headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
