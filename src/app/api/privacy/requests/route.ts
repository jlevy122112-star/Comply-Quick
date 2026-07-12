import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listDataRequests, requestDataExport, requestAccountDeletion } from "@/lib/privacy/dsar";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

// DSAR endpoints are sensitive and destructive; keep the budget tight.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Lists the caller's data-subject request history. */
export async function GET() {
  try {
    await requireUser();
    const requests = await listDataRequests();
    return NextResponse.json({ requests });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Files a data-subject request.
 * Body: { type: "export" } → returns the assembled data for download.
 *       { type: "deletion", confirmationEmail } → erases the account.
 */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
    const user = await requireUser();
    const authed = { id: user.id, email: user.email ?? null };

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    if (body.type === "export") {
      const result = await requestDataExport(authed);
      if (!result.ok) throw new ValidationError(result.error);
      return NextResponse.json(result.export, {
        status: 200,
        headers: {
          ...rateHeaders,
          "Content-Disposition": `attachment; filename="comply-quick-data-export.json"`,
        },
      });
    }

    if (body.type === "deletion") {
      if (typeof body.confirmationEmail !== "string") {
        throw new ValidationError("A confirmationEmail is required to delete the account.");
      }
      const result = await requestAccountDeletion(body.confirmationEmail, authed);
      if (!result.ok) throw new ValidationError(result.error);
      return NextResponse.json({ ok: true, deleted: true }, { status: 200, headers: rateHeaders });
    }

    throw new ValidationError('`type` must be "export" or "deletion".');
  } catch (err) {
    return errorResponse(err);
  }
}
