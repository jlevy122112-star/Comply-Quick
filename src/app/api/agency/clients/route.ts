import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listClients, createClient_ } from "@/lib/agency/service";
import {
  InMemoryRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

/** Lists the caller's agency clients. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const clients = await listClients();
    return NextResponse.json({ clients });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Creates a client. Body: { name, contactEmail?, websiteUrl?, notes? }. */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(limiter.check(getClientKey(request.headers)));
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw new ValidationError("A client name is required.");
    }

    const client = await createClient_({
      name: body.name,
      contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : null,
      websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : null,
      notes: typeof body.notes === "string" ? body.notes : "",
    });
    return NextResponse.json({ client }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
