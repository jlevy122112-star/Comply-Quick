import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getScan } from "@/lib/scanner/service";
import { UnauthorizedError, NotFoundError, errorResponse } from "@/services";

/** Returns a single scan owned by the current user. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await params;
    const scan = await getScan(id);
    if (!scan) throw new NotFoundError("Scan not found.");
    return NextResponse.json({ scan });
  } catch (err) {
    return errorResponse(err);
  }
}
