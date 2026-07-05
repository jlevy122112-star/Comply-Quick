import { NextResponse } from "next/server";
import { getOrCreateFeed, rotateFeed, revokeFeed } from "@/lib/calendar/feed";
import { errorResponse } from "@/services";

// Authenticated management of the caller's one-way ICS calendar feed.
export const dynamic = "force-dynamic";

/** GET → the caller's live feed token (created on first use). */
export async function GET() {
  try {
    const feed = await getOrCreateFeed();
    return NextResponse.json({ feed });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST → rotates the feed (old subscription URL stops working). */
export async function POST() {
  try {
    const feed = await rotateFeed();
    return NextResponse.json({ feed });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE → revokes the feed entirely. */
export async function DELETE() {
  try {
    await revokeFeed();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
