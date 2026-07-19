// app/api/github/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== process.env.COMPLY_QUICK_ACTION_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { repo, commit } = body;

  const { error } = await supabase.from("github_scan_queue").insert({
    repo,
    commit,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: "Failed to enqueue scan" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
