import { NextRequest, NextResponse } from "next/server";
import {
  generateCompliancePackage,
  exportToMarkdown,
  VALID_USER_TYPES,
  VALID_FRAMEWORKS,
  VALID_PIXELS,
  VALID_REGIONS,
  VALID_MODULES,
  type ComplianceInput,
  type UserType,
  type Framework,
  type TrackingPixel,
  type TargetRegion,
  type ComplianceModule,
} from "@/components/ClauseEngine";
import { authenticateApiRequest } from "@/lib/api/auth";
import { recordApiUsage } from "@/lib/api/usage";
import { errorResponse, ValidationError } from "@/services";

const ENDPOINT = "/api/v1/compliance";

// Cap the request body to avoid a memory-exhaustion vector even on this
// authenticated endpoint (a compromised key must not be able to OOM the route).
const MAX_BODY_BYTES = 16 * 1024;

interface ApiRequestBody {
  userType: string;
  framework: string;
  trackingPixels: string[];
  targetRegions: string[];
  complianceModules?: string[];
  format?: "json" | "markdown";
}

function validateBody(body: unknown): asserts body is ApiRequestBody {
  if (typeof body !== "object" || body === null) throw new ValidationError("Request body must be a JSON object.");
  const obj = body as Record<string, unknown>;
  if (typeof obj.userType !== "string" || !VALID_USER_TYPES.has(obj.userType))
    throw new ValidationError(`Invalid userType. Must be one of: ${[...VALID_USER_TYPES].join(", ")}`);
  if (typeof obj.framework !== "string" || !VALID_FRAMEWORKS.has(obj.framework))
    throw new ValidationError(`Invalid framework. Must be one of: ${[...VALID_FRAMEWORKS].join(", ")}`);
  if (!Array.isArray(obj.trackingPixels) || obj.trackingPixels.some((p) => !VALID_PIXELS.has(String(p))))
    throw new ValidationError(`Invalid trackingPixels. Allowed: ${[...VALID_PIXELS].join(", ")}`);
  if (!Array.isArray(obj.targetRegions) || obj.targetRegions.some((r) => !VALID_REGIONS.has(String(r))))
    throw new ValidationError(`Invalid targetRegions. Allowed: ${[...VALID_REGIONS].join(", ")}`);
  if (
    obj.complianceModules &&
    (!Array.isArray(obj.complianceModules) || obj.complianceModules.some((m) => !VALID_MODULES.has(String(m))))
  )
    throw new ValidationError(`Invalid complianceModules. Allowed: ${[...VALID_MODULES].join(", ")}`);
}

/** Metered programmatic compliance-package generation ($0.01 per call). */
export async function POST(request: NextRequest) {
  try {
    const ctx = await authenticateApiRequest(request);

    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      throw new ValidationError("Request body too large.");
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw new ValidationError("Request body too large.");
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    validateBody(body);

    const input: ComplianceInput = {
      userType: body.userType as UserType,
      framework: body.framework as Framework,
      trackingPixels: body.trackingPixels as TrackingPixel[],
      targetRegions: body.targetRegions as TargetRegion[],
      complianceModules: body.complianceModules as ComplianceModule[] | undefined,
    };

    const result = generateCompliancePackage(input);
    await recordApiUsage({ userId: ctx.userId, apiKeyId: ctx.keyId, endpoint: ENDPOINT, meter: "api_call" });

    if (body.format === "markdown") {
      return new NextResponse(exportToMarkdown(result), {
        status: 200,
        headers: {
          ...ctx.rateHeaders,
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": "attachment; filename=compliance-package.md",
        },
      });
    }

    return NextResponse.json(
      { success: true, data: result, meta: { generatedAt: new Date().toISOString(), version: "2.0.0" } },
      { headers: ctx.rateHeaders }
    );
  } catch (err) {
    return errorResponse(err);
  }
}
