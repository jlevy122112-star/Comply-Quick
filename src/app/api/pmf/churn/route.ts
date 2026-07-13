import { NextResponse } from "next/server";
import { submitChurnSurvey } from "@/lib/pmf/service";
import { ValidationError, errorResponse } from "@/services";
import { isChurnReason, type ChurnReason } from "@/lib/pmf/metrics";

/** Submit a cancellation exit survey: POST { reason, comment?, channel?, outcome? }. */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const b = body as { reason?: unknown; comment?: unknown; channel?: unknown; outcome?: unknown };
    if (!isChurnReason(b.reason)) throw new ValidationError("A valid reason is required.");
    await submitChurnSurvey({
      reason: b.reason as ChurnReason,
      comment: typeof b.comment === "string" ? b.comment : undefined,
      channel: typeof b.channel === "string" ? b.channel : undefined,
      outcome:
        b.outcome === "proceed_to_cancel" || b.outcome === "save_offer_clicked"
          ? (b.outcome as "proceed_to_cancel" | "save_offer_clicked")
          : undefined,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
