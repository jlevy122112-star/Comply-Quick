import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeApiKey } from "@/lib/api/keys";
import { errorResponse, UnauthorizedError } from "@/services";

/** Revokes one of the caller's API keys. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await params;
    await revokeApiKey(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
