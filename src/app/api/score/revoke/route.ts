import { NextRequest, NextResponse } from "next/server";
import { revokeScore } from "@/lib/score/publish";
import { errorResponse, ValidationError } from "@/services";

/** Revokes (soft-deletes) a public score page the caller owns. */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const id = (body as { id?: unknown } | null)?.id;
    if (typeof id !== "string" || !id) throw new ValidationError("An id is required.");

    await revokeScore(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
