import { NextRequest, NextResponse } from "next/server";
import { publishScore } from "@/lib/score/publish";
import { errorResponse, ValidationError } from "@/services";

/** Publishes a public score page for one of the caller's scans. */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const scanId = (body as { scanId?: unknown } | null)?.scanId;
    if (typeof scanId !== "string" || !scanId) throw new ValidationError("A scanId is required.");
    const rawLabel = (body as { label?: unknown }).label;
    const label = typeof rawLabel === "string" ? rawLabel : undefined;

    const published = await publishScore(scanId, label);
    return NextResponse.json({ published });
  } catch (err) {
    return errorResponse(err);
  }
}
