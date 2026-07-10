import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash, timingSafeEqual } from "crypto";

// Owner-only CSV export of the collected email list. Guarded by a shared secret
// (LEADS_EXPORT_TOKEN) supplied via the `Authorization: Bearer <token>` header,
// compared in constant time. When the token isn't configured the route is a
// hard 404 so it can't be probed. Never exposed to the client bundle.

function tokenMatches(provided: string, expected: string): boolean {
  // Hash both to a fixed-length digest first so the comparison is constant-time
  // regardless of input length (a raw length check would leak the token length).
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// Neutralize spreadsheet formula injection: a leading =, +, -, @, tab, or CR
// can be interpreted as a formula by Excel/Sheets, so prefix such cells with a
// single quote before applying normal RFC-4180 quoting.
function csvCell(value: string | null): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const PAGE_SIZE = 1000;

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

  // Page through the full table so the export isn't silently truncated at
  // PostgREST's default row cap once the list grows past a single page.
  type Row = {
    email: string;
    source: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    founding_member: boolean;
    welcomed: boolean;
    created_at: string;
  };
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("leads")
      .select("email, source, utm_source, utm_medium, utm_campaign, founding_member, welcomed, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });
    if (!data || data.length === 0) break;
    all.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) break;
  }

  const header = "email,source,utm_source,utm_medium,utm_campaign,founding_member,welcomed,created_at";
  const rows = all.map((r) =>
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
