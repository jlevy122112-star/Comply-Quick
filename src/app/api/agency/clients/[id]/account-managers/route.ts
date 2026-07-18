import { NextRequest, NextResponse } from "next/server";
import { assignAccountManager, listClientAssignments, unassignAccountManager } from "@/lib/agency/service";
import { errorResponse } from "@/services";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json({ assignments: await listClientAssignments(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { userId?: unknown };
    if (typeof body.userId !== "string" || body.userId.length === 0) {
      return NextResponse.json({ message: "A user is required." }, { status: 400 });
    }
    return NextResponse.json({ assignment: await assignAccountManager(id, body.userId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { userId?: unknown };
    if (typeof body.userId !== "string" || body.userId.length === 0) {
      return NextResponse.json({ message: "A user is required." }, { status: 400 });
    }
    await unassignAccountManager(id, body.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
