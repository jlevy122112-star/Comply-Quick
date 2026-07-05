import { NextResponse } from "next/server";
import { createTask, type CreateTaskInput } from "@/lib/calendar/service";
import { ValidationError, errorResponse } from "@/services";

/** Creates a manual compliance task: POST { title, dueDate, category?, severity?, description?, agencyClientId? }. */
export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body");
    }
    const b = body as Partial<CreateTaskInput>;
    if (typeof b.title !== "string" || typeof b.dueDate !== "string") {
      throw new ValidationError("title and dueDate are required.");
    }
    const task = await createTask({
      title: b.title,
      dueDate: b.dueDate,
      description: typeof b.description === "string" ? b.description : undefined,
      category: b.category,
      severity: b.severity,
      agencyClientId: typeof b.agencyClientId === "string" ? b.agencyClientId : null,
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
