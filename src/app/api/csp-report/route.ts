// CSP violation sink. Browsers POST here (via the policy's `report-uri`) when a
// directive is violated. We forward a compact summary to Sentry so violations
// are visible during the Report-Only rollout and after enforcing, then always
// answer 204 so the browser never retries.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

interface CspReportBody {
  "csp-report"?: Record<string, unknown>;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CspReportBody | Record<string, unknown> | null;
    const report =
      body && typeof body === "object" && "csp-report" in body ? (body as CspReportBody)["csp-report"] : body;
    if (report && typeof report === "object") {
      const r = report as Record<string, unknown>;
      Sentry.captureMessage("CSP violation", {
        level: "warning",
        tags: { violated_directive: String(r["violated-directive"] ?? r["effective-directive"] ?? "unknown") },
        extra: {
          blockedUri: r["blocked-uri"],
          documentUri: r["document-uri"],
          violatedDirective: r["violated-directive"] ?? r["effective-directive"],
        },
      });
    }
  } catch {
    // Malformed or empty report bodies are ignored — never error back to the browser.
  }
  return new NextResponse(null, { status: 204 });
}
