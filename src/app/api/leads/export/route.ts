import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "crypto";

// Owner-only CSV export of the collected email list. Guarded by a shared secret
// (LEADS_EXPORT_TOKEN) supplied via the `Authorization: Bearer <token>` header,
// compared in constant time. When the token isn't configured the route is a
// hard 404 so it can't be probed. Never exposed to the client bundle.

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function csvCell(value: string | null): string {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(request: Request) {
  const expected = process.env.LEADS_EXPORT_TOKEN;
  if (!expected) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!provided || !tokenMatches(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("leads")
    .select("email, source, utm_source, utm_medium, utm_campaign, founding_member, welcomed, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  const header = "email,source,utm_source,utm_medium,utm_campaign,founding_member,welcomed,created_at";
  const rows = (data ?? []).map((r) =>
    [
      csvCell(r.email),
      csvCell(r.source),
      csvCell(r.utm_source),
      csvCell(r.utm_medium),
      csvCell(r.utm_campaign),
      String(r.founding_member),
      String(r.welcomed),
      csvCell(r.created_at),
    ].join(",")
  );
  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="comply-quick-leads.csv"`,
    },
  });
}
