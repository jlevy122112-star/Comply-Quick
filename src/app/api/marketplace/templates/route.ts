import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listPublishedTemplates, createTemplate, type TemplateContent } from "@/lib/marketplace/service";
import {
  InMemoryRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

/** Lists published templates. Query params: `q` (search), `category`. Public. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templates = await listPublishedTemplates({
      search: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      type: searchParams.get("type") ?? undefined,
    });
    return NextResponse.json({ templates });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Creates a draft template (seller only). Body: TemplateInput. */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(limiter.check(getClientKey(request.headers)));
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      throw new ValidationError("A title is required.");
    }

    const template = await createTemplate({
      title: body.title,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      priceCents: typeof body.priceCents === "number" ? body.priceCents : undefined,
      content:
        typeof body.content === "object" && body.content !== null ? (body.content as TemplateContent) : undefined,
      preview: typeof body.preview === "string" ? body.preview : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
    });
    return NextResponse.json({ template }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
