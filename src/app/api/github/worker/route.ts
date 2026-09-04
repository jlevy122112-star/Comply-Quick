import { NextResponse } from "next/server";
import { processGitHubScanQueue } from "@/lib/github/service";
import { errorResponse } from "@/services";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-worker-secret");
  return header === expected;
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const batchSize = Number.parseInt(url.searchParams.get("batchSize") ?? "5", 10);
    const workerId = request.headers.get("x-worker-id")?.trim() || `github-scan-worker-${Date.now()}`;
    const result = await processGitHubScanQueue({
      workerId,
      batchSize: Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 5,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
