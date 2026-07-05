// Slack alerting for the Compliance OS.
//
// Posts operational + revenue alerts to a Slack Incoming Webhook (the
// `#revenue-alerts` channel per the build plan). Env-gated: with no
// `SLACK_WEBHOOK_URL` configured every call is a no-op that reports
// `delivered: false`, so local dev / previews stay inert and nothing throws.
//
// Keep this dependency-free (uses global `fetch`) and side-effect-light so it
// is safe to call from webhook handlers on the hot path — callers should not
// await-block the response on delivery when latency matters, but delivery is
// fast and failures never propagate.

import { logger } from "./logger";

const log = logger.child({ module: "slack" });

export type AlertSeverity = "info" | "warning" | "critical";

export interface SlackAlert {
  /** Short headline, e.g. "Payment failed". */
  title: string;
  /** Human-readable detail line. */
  message: string;
  severity?: AlertSeverity;
  /** Optional key/value context rendered as fields. */
  fields?: Record<string, string | number | undefined | null>;
}

export interface SlackDispatchResult {
  delivered: boolean;
  reason?: string;
}

export interface SlackClientOptions {
  webhookUrl?: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info: ":information_source:",
  warning: ":warning:",
  critical: ":rotating_light:",
};

/** Resolves the configured webhook URL, preferring a revenue-specific one. */
function resolveWebhookUrl(explicit?: string): string | undefined {
  return explicit ?? process.env.SLACK_REVENUE_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL ?? undefined;
}

/** Builds the Slack message payload (Block Kit) for an alert. */
export function formatSlackPayload(alert: SlackAlert): {
  text: string;
  blocks: unknown[];
} {
  const severity = alert.severity ?? "info";
  const emoji = SEVERITY_EMOJI[severity];
  const headline = `${emoji} *${alert.title}*`;
  const text = `${emoji} ${alert.title}: ${alert.message}`;

  const blocks: unknown[] = [{ type: "section", text: { type: "mrkdwn", text: `${headline}\n${alert.message}` } }];

  const fieldEntries = Object.entries(alert.fields ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && `${v}`.length > 0
  );
  if (fieldEntries.length > 0) {
    blocks.push({
      type: "section",
      fields: fieldEntries.map(([k, v]) => ({ type: "mrkdwn", text: `*${k}:*\n${v}` })),
    });
  }

  return { text, blocks };
}

export class SlackClient {
  private readonly webhookUrl?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SlackClientOptions = {}) {
    this.webhookUrl = resolveWebhookUrl(options.webhookUrl);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /** True when a webhook is configured (i.e. alerts can be delivered). */
  get enabled(): boolean {
    return Boolean(this.webhookUrl);
  }

  /**
   * Sends an alert. Never throws: transport/HTTP failures are logged and
   * returned as `{ delivered: false }` so callers on the request hot path are
   * not disrupted by Slack being unavailable or unconfigured.
   */
  async send(alert: SlackAlert): Promise<SlackDispatchResult> {
    if (!this.webhookUrl) {
      log.debug("Slack alert skipped (no webhook configured)", { title: alert.title });
      return { delivered: false, reason: "not_configured" };
    }

    const payload = formatSlackPayload(alert);
    try {
      const res = await this.fetchImpl(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        log.error("Slack alert delivery failed", { title: alert.title, status: res.status });
        return { delivered: false, reason: `http_${res.status}` };
      }
      log.info("Slack alert delivered", { title: alert.title, severity: alert.severity ?? "info" });
      return { delivered: true };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : "unknown_error";
      log.error("Slack alert threw", { title: alert.title, reason });
      return { delivered: false, reason };
    }
  }
}

/** Shared client using env-configured webhook. */
export const slack = new SlackClient();

/** Convenience: fire-and-safe revenue alert via the shared client. */
export function sendRevenueAlert(alert: SlackAlert): Promise<SlackDispatchResult> {
  return slack.send({ severity: "critical", ...alert });
}
