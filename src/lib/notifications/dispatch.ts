// Multi-channel notification dispatch.
//
// A single funnel for ALL user-facing app changes — not just regulatory ones.
// Every event is always recorded in-app (the DB `notifications` row is the
// source of truth); dispatch then fans the same event out to email and mobile
// push when those channels are configured and the user hasn't opted out.
//
// Providers are env-gated and reached over plain HTTPS (no new dependencies):
//   - Email:  RESEND_API_KEY + NOTIFICATIONS_FROM_EMAIL (Resend REST API).
//   - Push:   EXPO_ACCESS_TOKEN (Expo push) — token stored per device.
// When a provider's env is absent the channel is a safe no-op, so the funnel
// works in every environment and light up as secrets are added.

import { logger } from "@/services";

const log = logger.child({ module: "notifications:dispatch" });

/** Categories cover the whole app, so any change can flow through one funnel. */
export type NotificationCategory =
  "regulation_change" | "document_proposed" | "action_needed" | "scan_complete" | "billing" | "team" | "system";

export interface NotificationEvent {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** Deep link into the app for the CTA (e.g. /dashboard/autopilot). */
  url?: string;
}

/** A user's reachable channels + opt-outs, loaded from their profile. */
export interface NotificationRecipient {
  email?: string | null;
  /** Registered mobile push tokens (Expo). */
  pushTokens?: string[];
  /** Categories the user has muted. */
  mutedCategories?: NotificationCategory[];
}

export interface ChannelResult {
  channel: "email" | "push";
  delivered: boolean;
  reason?: string;
}

export interface DispatchResult {
  category: NotificationCategory;
  muted: boolean;
  results: ChannelResult[];
}

type Fetch = typeof fetch;
type Env = Record<string, string | undefined>;

export interface DispatchDeps {
  fetchImpl?: Fetch;
  env?: Env;
}

/**
 * True when at least one external channel (email or push) is configured. Lets
 * callers skip the per-recipient channel lookup entirely when no external
 * delivery is possible — avoiding needless DB/HTTP work in hot paths like the
 * daily autopilot cron.
 */
export function externalChannelsConfigured(env: Env = process.env): boolean {
  return Boolean((env.RESEND_API_KEY && env.NOTIFICATIONS_FROM_EMAIL) || env.EXPO_ACCESS_TOKEN);
}

async function sendEmail(
  recipient: NotificationRecipient,
  event: NotificationEvent,
  fetchImpl: Fetch,
  env: Env
): Promise<ChannelResult> {
  const apiKey = env.RESEND_API_KEY;
  const from = env.NOTIFICATIONS_FROM_EMAIL;
  if (!apiKey || !from) return { channel: "email", delivered: false, reason: "not_configured" };
  if (!recipient.email) return { channel: "email", delivered: false, reason: "no_address" };

  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: recipient.email,
        subject: event.title,
        text: event.url ? `${event.body}\n\n${event.url}` : event.body,
      }),
    });
    if (!res.ok) return { channel: "email", delivered: false, reason: `http_${res.status}` };
    return { channel: "email", delivered: true };
  } catch (err) {
    return { channel: "email", delivered: false, reason: err instanceof Error ? err.message : "error" };
  }
}

async function sendPush(
  recipient: NotificationRecipient,
  event: NotificationEvent,
  fetchImpl: Fetch,
  env: Env
): Promise<ChannelResult> {
  const token = env.EXPO_ACCESS_TOKEN;
  const tokens = recipient.pushTokens ?? [];
  if (!token) return { channel: "push", delivered: false, reason: "not_configured" };
  if (tokens.length === 0) return { channel: "push", delivered: false, reason: "no_devices" };

  try {
    const res = await fetchImpl("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({ to, title: event.title, body: event.body, data: { url: event.url } }))
      ),
    });
    if (!res.ok) return { channel: "push", delivered: false, reason: `http_${res.status}` };
    return { channel: "push", delivered: true };
  } catch (err) {
    return { channel: "push", delivered: false, reason: err instanceof Error ? err.message : "error" };
  }
}

/**
 * Fans a notification out to email + push. Respects per-category mutes. Callers
 * persist the in-app row separately (the source of truth); this handles only the
 * external channels and never throws — failures are reported per channel.
 */
export async function dispatchNotification(
  recipient: NotificationRecipient,
  event: NotificationEvent,
  deps: DispatchDeps = {}
): Promise<DispatchResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;

  if ((recipient.mutedCategories ?? []).includes(event.category)) {
    return { category: event.category, muted: true, results: [] };
  }

  const results = await Promise.all([
    sendEmail(recipient, event, fetchImpl, env),
    sendPush(recipient, event, fetchImpl, env),
  ]);

  const delivered = results.filter((r) => r.delivered).map((r) => r.channel);
  log.info("notification dispatched", { category: event.category, delivered });
  return { category: event.category, muted: false, results };
}
