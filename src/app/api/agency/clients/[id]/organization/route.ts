import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { provisionClientOrganization } from "@/lib/agency/service";
import { errorResponse, UnauthorizedError } from "@/services";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const { id } = await params;
    const organization = await provisionClientOrganization(id);
    return NextResponse.json({ organization });
  } catch (error) {
    return errorResponse(error);
  }
}
