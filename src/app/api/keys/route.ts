import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createApiKey, listApiKeys } from "@/lib/api/keys";
import { hasApiAccess } from "@/lib/api/usage";
import {
  InMemoryRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = new InMemoryRateLimiter({ limit: 20, windowMs: 60_000 });

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Lists the caller's API keys (no secrets). */
export async function GET() {
  try {
    await requireUser();
    const keys = await listApiKeys();
    return NextResponse.json({ keys });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Issues a new API key. Body: { name }. Paid plans only. Key shown once. */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(limiter.check(getClientKey(request.headers)));
    await requireUser();
    if (!(await hasApiAccess())) {
      throw new ForbiddenError("The API is available on paid plans (Pro, Agency, Enterprise).");
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    if (typeof body.name !== "string") throw new ValidationError("A key name is required.");

    const issued = await createApiKey(body.name);
    return NextResponse.json({ key: issued.key, record: issued.record }, { status: 201, headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
