import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateClient, deleteClient, type AgencyClient } from "@/lib/agency/service";
import { errorResponse, UnauthorizedError, NotFoundError, ValidationError } from "@/services";

/** Updates a client. Body may include name, contactEmail, websiteUrl, notes, status. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    const status = body.status;
    if (status !== undefined && status !== "active" && status !== "archived") {
      throw new ValidationError('status must be "active" or "archived".');
    }

    const { id } = await ctx.params;
    const client = await updateClient(id, {
      name: typeof body.name === "string" ? body.name : undefined,
      contactEmail: typeof body.contactEmail === "string" ? body.contactEmail : undefined,
      websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      status: status as AgencyClient["status"] | undefined,
    });
    return NextResponse.json({ client });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Deletes a client (its monitors/projects are detached, not deleted). */
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const { id } = await ctx.params;
    const ok = await deleteClient(id);
    if (!ok) throw new NotFoundError("Client not found.");
    return NextResponse.json({ success: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
