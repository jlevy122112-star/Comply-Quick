import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateTemplate, deleteTemplate, type TemplateContent } from "@/lib/marketplace/service";
import { errorResponse, UnauthorizedError, ValidationError } from "@/services";

/** Updates a template the caller owns. Body: partial TemplateInput. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    const template = await updateTemplate(id, {
      title: typeof body.title === "string" ? body.title : undefined,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      priceCents: typeof body.priceCents === "number" ? body.priceCents : undefined,
      content:
        typeof body.content === "object" && body.content !== null ? (body.content as TemplateContent) : undefined,
      preview: typeof body.preview === "string" ? body.preview : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
    });
    return NextResponse.json({ template });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Deletes a template the caller owns. */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const { id } = await ctx.params;
    await deleteTemplate(id);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
