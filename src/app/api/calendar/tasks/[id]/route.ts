import { NextResponse } from "next/server";
import { setTaskStatus, deleteTask } from "@/lib/calendar/service";
import { ValidationError, errorResponse } from "@/services";
import type { CalendarStatus } from "@/lib/calendar/events";

/** Updates a task's status: PATCH { status: "pending" | "done" | "dismissed" }. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const status = (body as { status?: string })?.status as CalendarStatus | undefined;
    if (!status) throw new ValidationError("status is required.");
    const task = await setTaskStatus(id, status);
    return NextResponse.json({ task });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Deletes a task the caller owns. */
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await deleteTask(id);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
