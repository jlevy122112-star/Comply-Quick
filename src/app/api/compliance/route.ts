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

const VALID_USER_TYPES = new Set<string>(["developer", "merchant"]);
const VALID_FRAMEWORKS = new Set<string>(["shopify", "nextjs", "wordpress", "wix", "squarespace"]);
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!validateRequestBody(body)) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        required: {
          userType: "developer | merchant",
          framework: "shopify | nextjs | wordpress | wix | squarespace",
          trackingPixels: "string[] — meta, google, tiktok, linkedin, pinterest, snapchat",
          targetRegions:
            "string[] — us_general, california_ccpa, eu_gdpr, canada_pipeda, brazil_lgpd, australia_privacy",
        },
        optional: {
          complianceModules: "string[] — hipaa, pci_dss, ada_wcag, soc2",
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

  if (body.format === "markdown") {
    const markdown = exportToMarkdown(result);
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "attachment; filename=compliance-package.md",
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: result,
    meta: {
      generatedAt: new Date().toISOString(),
      version: "2.0.0",
      tier: input.complianceModules && input.complianceModules.length > 0 ? "enterprise" : "standard",
    },
  });
}
