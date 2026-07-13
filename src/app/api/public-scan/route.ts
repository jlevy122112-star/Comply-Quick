import { NextResponse } from "next/server";
import { fetchPageHtml } from "@/lib/scanner/crawler";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeHtml, type Severity } from "@/lib/scanner/analyzer";
import { ValidationError } from "@/services/errors";
import { createRateLimiter, getClientKey, enforceRateLimit, errorResponse, logger } from "@/services";

const log = logger.child({ module: "api:public-scan" });

// Public, unauthenticated preview scan for the landing page. Static fetch +
// offline analysis only (no headless worker, no AI) so it's fast and cheap, and
// rate-limited per client so it can't be used to hammer third-party sites.
const limiter = createRateLimiter({ limit: 8, windowMs: 60_000 });

export interface PublicScanResult {
  url: string;
  score: number;
  tools: string[];
  findings: { title: string; severity: Severity }[];
  counts: { critical: number; warning: number; info: number };
  hasConsentBanner: boolean;
  hasPrivacyPolicy: boolean;
}

export async function POST(request: Request) {
  let rateHeaders: Record<string, string>;
  try {
    rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (limitErr) {
    return errorResponse(limitErr);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: rateHeaders });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const rawUrl = typeof body.url === "string" ? body.url : "";
  if (!rawUrl.trim()) {
    return NextResponse.json({ error: "Enter a website URL to scan." }, { status: 400, headers: rateHeaders });
  }

  const freeScanToken = typeof body.freeScanToken === "string" ? body.freeScanToken : null;
  if (freeScanToken) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Free scans are temporarily unavailable." },
        { status: 503, headers: rateHeaders }
      );
    }

    const { data, error } = await createAdminClient()
      .from("free_scan_claims")
      .update({ used_at: new Date().toISOString() })
      .eq("token", freeScanToken)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (error) {
      log.error("free scan claim consumption failed", { reason: error.message });
      return NextResponse.json({ error: "Could not verify your free scan." }, { status: 500, headers: rateHeaders });
    }
    if (!data) {
      return NextResponse.json(
        { error: "This free scan has already been used or is no longer valid." },
        { status: 409, headers: rateHeaders }
      );
    }
  }

  try {
    const page = await fetchPageHtml(rawUrl);
    const analysis = analyzeHtml(page.html, page.requestUrls);

    const counts = { critical: 0, warning: 0, info: 0 };
    for (const f of analysis.findings) counts[f.severity] += 1;

    const result: PublicScanResult = {
      url: page.url,
      score: analysis.score,
      tools: analysis.detectedTools.map((t) => t.name),
      // Teaser: title + severity only. Full detail/recommendations are gated
      // behind the email capture on the landing page.
      findings: analysis.findings.map((f) => ({ title: f.title, severity: f.severity })),
      counts,
      hasConsentBanner: analysis.hasConsentBanner,
      hasPrivacyPolicy: analysis.hasPrivacyPolicy,
    };
    return NextResponse.json(result, { headers: rateHeaders });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400, headers: rateHeaders });
    }
    log.warn("public scan failed", { reason: err instanceof Error ? err.message : "error" });
    return NextResponse.json(
      { error: "Could not reach that website. Check the URL and try again." },
      { status: 502, headers: rateHeaders }
    );
  }
}
