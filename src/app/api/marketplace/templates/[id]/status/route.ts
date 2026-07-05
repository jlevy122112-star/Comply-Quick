import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setTemplateStatus, type Template } from "@/lib/marketplace/service";
import { errorResponse, UnauthorizedError, ValidationError } from "@/services";

const STATUSES: Template["status"][] = ["draft", "published", "unlisted"];

/** Publishes/unpublishes a template the caller owns. Body: { status }. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const { id } = await ctx.params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    const status = body.status;
    if (typeof status !== "string" || !STATUSES.includes(status as Template["status"])) {
      throw new ValidationError("status must be one of: draft, published, unlisted.");
    }

    const template = await setTemplateStatus(id, status as Template["status"]);
    return NextResponse.json({ template });
  } catch (err) {
    return errorResponse(err);
  }
}
