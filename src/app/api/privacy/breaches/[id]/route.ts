import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateBreachIncident, BREACH_STATUSES, type BreachStatus, type BreachUpdate } from "@/lib/privacy/breach";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Optional timestamp: accepts null (clear), or a valid ISO string. */
function optionalTimestamp(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    throw new ValidationError(`${field} must be a valid timestamp or null.`);
  }
  return new Date(value).toISOString();
}

/** Updates status / notification timestamps on one of the caller's incidents. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
    await requireUser();

    const { id } = await params;
    if (!UUID_RE.test(id)) throw new ValidationError("Invalid incident id.");

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const update: BreachUpdate = {};

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !BREACH_STATUSES.includes(body.status as BreachStatus)) {
        throw new ValidationError("Invalid status.");
      }
      update.status = body.status as BreachStatus;
    }

    const contained = optionalTimestamp(body.containedAt, "containedAt");
    if (contained !== undefined) update.containedAt = contained;
    const authority = optionalTimestamp(body.authorityNotifiedAt, "authorityNotifiedAt");
    if (authority !== undefined) update.authorityNotifiedAt = authority;
    const individuals = optionalTimestamp(body.individualsNotifiedAt, "individualsNotifiedAt");
    if (individuals !== undefined) update.individualsNotifiedAt = individuals;

    if (body.notes !== undefined) {
      update.notes = body.notes === null ? null : String(body.notes);
    }

    const result = await updateBreachIncident(id, update);
    if (!result.ok) throw new ValidationError(result.error);

    return NextResponse.json({ ok: true }, { status: 200, headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
