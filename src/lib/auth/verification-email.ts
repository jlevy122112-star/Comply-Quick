import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send";

export type VerificationEmailType = "signup" | "magiclink";

export interface VerificationEmailInput {
  type: VerificationEmailType;
  email: string;
  password?: string;
  metadata?: Record<string, unknown>;
  redirectTo: string;
}

export interface VerificationEmailResult {
  configured: boolean;
  delivered: boolean;
  reason?: string;
}

export function verificationEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RESEND_API_KEY && env.NOTIFICATIONS_FROM_EMAIL);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function contentFor(type: VerificationEmailType, actionLink: string) {
  const isSignup = type === "signup";
  const title = isSignup ? "Confirm your Comply-Quick email" : "Your Comply-Quick sign-in link";
  const intro = isSignup
    ? "Thanks for creating your Comply-Quick account. Confirm your email address to continue."
    : "Use the secure link below to sign in to your Comply-Quick account.";
  const button = isSignup ? "Confirm email address" : "Sign in to Comply-Quick";
  const safeLink = escapeHtml(actionLink);

  return {
    subject: title,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#030712;color:#e5e7eb;font-family:Arial,sans-serif;">
    <main style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <div style="border:1px solid #1f2937;border-radius:16px;background:#111827;padding:32px;">
        <p style="margin:0 0 24px;color:#a5b4fc;font-size:14px;font-weight:700;letter-spacing:.04em;">COMPLY-QUICK</p>
        <h1 style="margin:0 0 16px;color:#fff;font-size:24px;">${title}</h1>
        <p style="margin:0 0 24px;color:#d1d5db;font-size:16px;line-height:1.6;">${intro}</p>
        <p style="margin:0 0 28px;">
          <a href="${safeLink}" style="display:inline-block;border-radius:8px;background:#4f46e5;color:#fff;padding:12px 20px;text-decoration:none;font-weight:700;">${button}</a>
        </p>
        <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break:break-all;margin:8px 0 0;color:#a5b4fc;font-size:13px;"><a href="${safeLink}" style="color:#a5b4fc;">${safeLink}</a></p>
      </div>
    </main>
  </body>
</html>`,
    text: `${title}\n\n${intro}\n\n${button}: ${actionLink}\n\nIf you did not request this email, you can safely ignore it.`,
  };
}

export async function sendVerificationEmail(input: VerificationEmailInput): Promise<VerificationEmailResult> {
  if (!verificationEmailConfigured()) {
    return { configured: false, delivered: false, reason: "not_configured" };
  }

  const admin = createAdminClient();
  const { data, error } =
    input.type === "signup"
      ? input.password
        ? await admin.auth.admin.generateLink({
            type: "signup",
            email: input.email,
            password: input.password,
            options: {
              redirectTo: input.redirectTo,
              ...(input.metadata ? { data: input.metadata } : {}),
            },
          })
        : { data: null, error: { message: "A password is required to create a signup link." } }
      : await admin.auth.admin.generateLink({
          type: "magiclink",
          email: input.email,
          options: { redirectTo: input.redirectTo },
        });

  if (error || !data?.properties?.action_link) {
    const message = error?.message ?? "Could not generate an email action link.";
    const alreadyRegistered = /already.*(registered|exists)|user.*already/i.test(message);
    return {
      configured: true,
      delivered: false,
      reason: alreadyRegistered ? "already_registered" : message,
    };
  }

  const content = contentFor(input.type, data.properties.action_link);
  const result = await sendTransactionalEmail({
    to: input.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  return {
    configured: true,
    delivered: result.delivered,
    reason: result.delivered ? undefined : result.reason,
  };
}
