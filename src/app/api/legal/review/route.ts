import { NextResponse } from "next/server";
import { listReviewItems, enqueueReviewItem } from "@/lib/legal/review-queue";
import { ValidationError, errorResponse } from "@/services";
import { isReviewCategory, type ReviewCategory } from "@/lib/legal/review";

/** Lists the legal review queue (admin-gated). */
export async function GET() {
  try {
    const items = await listReviewItems();
    return NextResponse.json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Adds an artifact to the review queue: POST { title, category, contentRef? }. */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const b = body as { title?: unknown; category?: unknown; contentRef?: unknown };
    if (typeof b.title !== "string") throw new ValidationError("title is required.");
    if (!isReviewCategory(b.category)) throw new ValidationError("A valid category is required.");
    const item = await enqueueReviewItem({
      title: b.title,
      category: b.category as ReviewCategory,
      contentRef: typeof b.contentRef === "string" ? b.contentRef : undefined,
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
