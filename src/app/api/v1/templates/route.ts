import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api/auth";
import { recordApiUsage } from "@/lib/api/usage";
import { createTemplateForUser, type TemplateInput } from "@/lib/marketplace/service";
import { errorResponse, ValidationError } from "@/services";

const ENDPOINT = "/api/v1/templates";

/**
 * Programmatic template upload. Metered at $0.01 (api_call) + $50
 * (api_template_upload) per the pricing source of truth. The $50 charge applies
 * to API uploads only — Creator-Studio listings remain free to publish.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await authenticateApiRequest(request);

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    if (typeof body.title !== "string" || !body.title.trim()) throw new ValidationError("A title is required.");

    const input: TemplateInput = {
      title: body.title,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      priceCents: typeof body.priceCents === "number" ? body.priceCents : undefined,
      content:
        typeof body.content === "object" && body.content !== null
          ? (body.content as TemplateInput["content"])
          : undefined,
      preview: typeof body.preview === "string" ? body.preview : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
    };

    const template = await createTemplateForUser(ctx.userId, input);

    // Meter the call plus the programmatic-upload surcharge.
    await recordApiUsage({ userId: ctx.userId, apiKeyId: ctx.keyId, endpoint: ENDPOINT, meter: "api_call" });
    await recordApiUsage({ userId: ctx.userId, apiKeyId: ctx.keyId, endpoint: ENDPOINT, meter: "api_template_upload" });

    return NextResponse.json({ template }, { status: 201, headers: ctx.rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
