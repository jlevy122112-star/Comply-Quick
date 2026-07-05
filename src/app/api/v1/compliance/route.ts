import { NextRequest, NextResponse } from "next/server";
import {
  generateCompliancePackage,
  exportToMarkdown,
  type ComplianceInput,
  type UserType,
  type Framework,
  type TrackingPixel,
  type TargetRegion,
} from "@/components/ClauseEngine";
import type { ComplianceModule } from "@/components/EnterpriseModules";
import { authenticateApiRequest } from "@/lib/api/auth";
import { recordApiUsage } from "@/lib/api/usage";
import { errorResponse, ValidationError } from "@/services";

const ENDPOINT = "/api/v1/compliance";

const VALID_USER_TYPES = new Set<string>(["developer", "merchant"]);
const VALID_FRAMEWORKS = new Set<string>([
  "shopify",
  "nextjs",
  "wordpress",
  "wix",
  "squarespace",
  "godaddy",
  "webflow",
  "woocommerce",
  "bigcommerce",
]);
const VALID_PIXELS = new Set<string>(["meta", "google", "tiktok", "linkedin", "pinterest", "snapchat"]);
const VALID_REGIONS = new Set<string>([
  "us_general",
  "california_ccpa",
  "eu_gdpr",
  "canada_pipeda",
  "brazil_lgpd",
  "australia_privacy",
]);
const VALID_MODULES = new Set<string>(["hipaa", "pci_dss", "ada_wcag", "soc2"]);

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

    let body: unknown;
    try {
      body = await request.json();
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
