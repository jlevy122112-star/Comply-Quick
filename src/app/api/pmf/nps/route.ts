import { NextResponse } from "next/server";
import { submitNps } from "@/lib/pmf/service";
import { ValidationError, errorResponse } from "@/services";

/** Submit an NPS response: POST { score: 0-10, comment?, channel? }. */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const b = body as { score?: unknown; comment?: unknown; channel?: unknown };
    if (typeof b.score !== "number") throw new ValidationError("score is required.");
    await submitNps({
      score: b.score,
      comment: typeof b.comment === "string" ? b.comment : undefined,
      channel: typeof b.channel === "string" ? b.channel : undefined,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
