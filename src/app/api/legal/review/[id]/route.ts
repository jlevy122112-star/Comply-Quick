import { NextResponse } from "next/server";
import { recordReview } from "@/lib/legal/review-queue";
import { ValidationError, errorResponse } from "@/services";
import { isReviewStatus, type ReviewStatus } from "@/lib/legal/review";

/** Records a review decision: PATCH { status, notes? }. Admin-gated. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const b = body as { status?: unknown; notes?: unknown };
    if (!isReviewStatus(b.status)) throw new ValidationError("A valid status is required.");
    const item = await recordReview(id, {
      status: b.status as ReviewStatus,
      notes: typeof b.notes === "string" ? b.notes : undefined,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
