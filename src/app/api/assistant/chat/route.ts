import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createRateLimiter, getClientKey, enforceRateLimit, errorResponse, logger } from "@/services";
import { answerAssistant, type AssistantMessage, type AssistantRole } from "@/lib/assistant/service";

const log = logger.child({ module: "api/assistant/chat" });

// Model calls cost money — cap per-client volume.
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
const MAX_BODY_BYTES = 32 * 1024;

interface ChatBody {
  messages: { role: string; content: string }[];
  context?: { tier?: string; projectCount?: number; frameworks?: string[] };
}

function isValid(body: unknown): body is ChatBody {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  if (!Array.isArray(obj.messages) || obj.messages.length === 0) return false;
  return obj.messages.every(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      ((m as Record<string, unknown>).role === "user" || (m as Record<string, unknown>).role === "assistant") &&
      typeof (m as Record<string, unknown>).content === "string"
  );
}

export async function POST(request: NextRequest) {
  // Authenticated feature — assistant is a signed-in tool. `createClient` throws
  // if Supabase env vars are missing/misconfigured; handle it rather than
  // letting it surface as an unhandled 500 (consistent with the other routes).
  let user: User | null = null;
  try {
    const supabase = await createClient();
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (authErr) {
    return errorResponse(authErr);
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rateHeaders: Record<string, string>;
  try {
    rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (limitErr) {
    return errorResponse(limitErr);
  }

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
  if (!isValid(body)) {
    return NextResponse.json(
      { error: "Invalid request body", required: { messages: "{ role: 'user'|'assistant', content: string }[]" } },
      { status: 400 }
    );
  }

  const messages: AssistantMessage[] = body.messages.map((m) => ({
    role: m.role as AssistantRole,
    content: m.content,
  }));

  try {
    const result = await answerAssistant(messages, body.context);
    log.info("Assistant reply", { live: result.live, turns: messages.length });
    return NextResponse.json({ success: true, ...result }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
