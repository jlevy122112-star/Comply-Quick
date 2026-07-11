// Transactional email sender (Resend REST API).
//
// Env-gated and dependency-free: sends HTML email over plain HTTPS when
// RESEND_API_KEY + NOTIFICATIONS_FROM_EMAIL are set, and is a safe no-op
// otherwise so the funnel works in every environment. Never throws — callers
// get a structured result they can log without breaking the request path.

import { logger } from "@/services";

const log = logger.child({ module: "email:send" });

type Fetch = typeof fetch;
type Env = Record<string, string | undefined>;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Override the default NOTIFICATIONS_FROM_EMAIL sender (e.g. support@ / info@). */
  from?: string;
  /** Optional Reply-To so customer replies thread back to the right inbox. */
  replyTo?: string;
}

export interface SendEmailResult {
  delivered: boolean;
  reason?: string;
}

export interface SendEmailDeps {
  fetchImpl?: Fetch;
  env?: Env;
}

export async function sendTransactionalEmail(
  input: SendEmailInput,
  deps: SendEmailDeps = {}
): Promise<SendEmailResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;
  const apiKey = env.RESEND_API_KEY;
  const from = input.from ?? env.NOTIFICATIONS_FROM_EMAIL;
  if (!apiKey || !from) return { delivered: false, reason: "not_configured" };
  if (!input.to) return { delivered: false, reason: "no_address" };

  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    if (!res.ok) return { delivered: false, reason: `http_${res.status}` };
    return { delivered: true };
  } catch (err) {
    log.warn("email send failed", { reason: err instanceof Error ? err.message : "error" });
    return { delivered: false, reason: err instanceof Error ? err.message : "error" };
  }
}
