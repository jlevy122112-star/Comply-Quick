import { NextRequest, NextResponse } from "next/server";
import {
  generateCompliancePackage,
  exportToMarkdown,
  FRAMEWORKS,
  TRACKING_PIXELS,
  TARGET_REGIONS,
  VALID_USER_TYPES,
  VALID_FRAMEWORKS,
  VALID_PIXELS,
  VALID_REGIONS,
  VALID_MODULES,
  COMPLIANCE_MODULES,
  type ComplianceInput,
  type UserType,
  type Framework,
  type TrackingPixel,
  type TargetRegion,
  type ComplianceModule,
} from "@/components/ClauseEngine";
import { createRateLimiter, getClientKey, enforceRateLimit, errorResponse, logger } from "@/services";
import { recordAuditLog } from "@/lib/audit-log";

const log = logger.child({ module: "api/compliance" });

// Public generation endpoint — cap per-client volume to protect the instance.
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

// Reject oversized bodies before parsing to avoid a memory-exhaustion vector on
// this public, unauthenticated endpoint. The largest valid request (every field
// at max cardinality) is well under 2 KB; 16 KB leaves generous headroom.
const MAX_BODY_BYTES = 16 * 1024;

interface ApiRequestBody {
  userType: string;
  framework: string;
  trackingPixels: string[];
  targetRegions: string[];
  complianceModules?: string[];
  format?: "json" | "markdown";
}

function validateRequestBody(body: unknown): body is ApiRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.userType === "string" &&
    typeof obj.framework === "string" &&
    Array.isArray(obj.trackingPixels) &&
    Array.isArray(obj.targetRegions)
  );
}

function buildValidationErrors(body: ApiRequestBody): string[] {
  const errors: string[] = [];

  if (!VALID_USER_TYPES.has(body.userType)) {
    errors.push(`Invalid userType: "${body.userType}". Must be one of: ${[...VALID_USER_TYPES].join(", ")}`);
  }
  if (!VALID_FRAMEWORKS.has(body.framework)) {
    errors.push(`Invalid framework: "${body.framework}". Must be one of: ${[...VALID_FRAMEWORKS].join(", ")}`);
  }
  for (const pixel of body.trackingPixels) {
    if (!VALID_PIXELS.has(pixel)) {
      errors.push(`Invalid tracking pixel: "${pixel}". Must be one of: ${[...VALID_PIXELS].join(", ")}`);
    }
  }
  for (const region of body.targetRegions) {
    if (!VALID_REGIONS.has(region)) {
      errors.push(`Invalid target region: "${region}". Must be one of: ${[...VALID_REGIONS].join(", ")}`);
    }
  }
  if (body.complianceModules) {
    for (const mod of body.complianceModules) {
      if (!VALID_MODULES.has(mod)) {
        errors.push(`Invalid compliance module: "${mod}". Must be one of: ${[...VALID_MODULES].join(", ")}`);
      }
    }
  }
  if (body.format && body.format !== "json" && body.format !== "markdown") {
    errors.push(`Invalid format: "${body.format}". Must be "json" or "markdown"`);
  }

  return errors;
}

export async function POST(request: NextRequest) {
  let rateHeaders: Record<string, string>;
  try {
    rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (limitErr) {
    return errorResponse(limitErr);
  }

  // Reject bodies larger than the cap before buffering/parsing. Check the
  // advertised Content-Length first (cheap), then verify the actual byte length
  // in case the header is missing or understated.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!validateRequestBody(body)) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        required: {
          userType: [...VALID_USER_TYPES].join(" | "),
          framework: FRAMEWORKS.join(" | "),
          trackingPixels: `string[] — ${TRACKING_PIXELS.join(", ")}`,
          targetRegions: `string[] — ${TARGET_REGIONS.join(", ")}`,
        },
        optional: {
          complianceModules: `string[] — ${COMPLIANCE_MODULES.join(", ")}`,
          format: "json | markdown (default: json)",
        },
      },
      { status: 400 }
    );
  }

  const errors = buildValidationErrors(body);
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
  }

  const input: ComplianceInput = {
    userType: body.userType as UserType,
    framework: body.framework as Framework,
    trackingPixels: body.trackingPixels as TrackingPixel[],
    targetRegions: body.targetRegions as TargetRegion[],
    complianceModules: body.complianceModules as ComplianceModule[] | undefined,
  };

  const result = generateCompliancePackage(input);
  log.info("Generated compliance package", {
    framework: input.framework,
    regions: input.targetRegions.length,
    modules: input.complianceModules?.length ?? 0,
  });

  if (body.format === "markdown") {
    const markdown = exportToMarkdown(result);
    // Best-effort audit entry — no-op for anonymous API callers (no session).
    await recordAuditLog({
      action: "package.exported",
      entityType: "compliance_package",
      summary: `Exported an audit-ready ${input.framework} compliance package (markdown).`,
      metadata: { framework: input.framework, regions: input.targetRegions.length },
    });
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        ...rateHeaders,
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=compliance-package.md",
      },
    });
  }

  return NextResponse.json(
    {
      success: true,
      data: result,
      meta: {
        generatedAt: new Date().toISOString(),
        version: "2.0.0",
        tier: input.complianceModules && input.complianceModules.length > 0 ? "enterprise" : "standard",
      },
    },
    { headers: rateHeaders }
  );
}
