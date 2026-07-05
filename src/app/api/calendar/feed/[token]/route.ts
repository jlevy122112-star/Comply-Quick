import { NextResponse } from "next/server";
import { getFeedEvents } from "@/lib/calendar/feed";
import { buildIcs } from "@/lib/calendar/ics";

// Public, unauthenticated ICS feed keyed by an unguessable token. Calendar apps
// (Google / Outlook / Apple) poll this URL to project the user's compliance
// events into their own calendar. One-way: nothing is read back.
export const dynamic = "force-dynamic";

/** GET /api/calendar/feed/<token>.ics → text/calendar (or 404 for bad tokens). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");

  const events = await getFeedEvents(token);
  if (events === null) {
    return new NextResponse("Calendar feed not found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const body = buildIcs(events, { appOrigin: origin });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="comply-quick.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
