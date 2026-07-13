// [Up11] PMF validation — DB-backed service.
//
// Users submit NPS + churn surveys (RLS: insert-own). The admin summary reads
// aggregates via the service-role client, gated by the PMF_ADMIN_EMAILS
// allowlist.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { analytics, logger } from "@/services";
import { UnauthorizedError, ForbiddenError, ValidationError } from "@/services/errors";
import { computeNps, tallyBy, rate, isChurnReason, isPmfAdmin, type NpsSummary, type ChurnReason } from "./metrics";

const log = logger.child({ module: "pmf" });

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export interface SubmitNpsInput {
  score: number;
  comment?: string;
  channel?: string;
}

/** Records an NPS response for the signed-in user. */
export async function submitNps(input: SubmitNpsInput): Promise<void> {
  const { supabase, user } = await getUser();
  if (!user) throw new UnauthorizedError("Sign in to submit feedback.");
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 10) {
    throw new ValidationError("Score must be an integer between 0 and 10.");
  }
  const { error } = await supabase.from("nps_responses").insert({
    user_id: user.id,
    score: input.score,
    comment: input.comment?.slice(0, 2000) ?? "",
    channel: input.channel ?? null,
  });
  if (error) {
    log.error("failed to insert nps response", { err: error.message });
    throw new Error("Could not save your feedback.");
  }
  analytics.track({
    event: "nps_submitted",
    userId: user.id,
    channel: input.channel,
    properties: { score: input.score },
  });
}

export interface SubmitChurnInput {
  reason: ChurnReason;
  comment?: string;
  channel?: string;
  outcome?: "proceed_to_cancel" | "save_offer_clicked";
}

/** Records a cancellation exit-survey response for the signed-in user. */
export async function submitChurnSurvey(input: SubmitChurnInput): Promise<void> {
  const { supabase, user } = await getUser();
  if (!user) throw new UnauthorizedError("Sign in to submit feedback.");
  if (!isChurnReason(input.reason)) throw new ValidationError("Invalid reason.");
  const { error } = await supabase.from("churn_surveys").insert({
    user_id: user.id,
    reason: input.reason,
    comment: input.comment?.slice(0, 2000) ?? "",
    channel: input.channel ?? null,
  });
  if (error) {
    log.error("failed to insert churn survey", { err: error.message });
    throw new Error("Could not save your feedback.");
  }
  analytics.track({
    event: "subscription_canceled",
    userId: user.id,
    channel: input.channel,
    properties: { reason: input.reason, outcome: input.outcome ?? "proceed_to_cancel" },
  });
}

/** Auth + PMF admin allowlist. Returns the caller email. */
export async function requirePmfAdmin(): Promise<string> {
  const { user } = await getUser();
  if (!user) throw new UnauthorizedError("Sign in to view PMF metrics.");
  if (!isPmfAdmin(user.email ?? null, process.env.PMF_ADMIN_EMAILS)) {
    throw new ForbiddenError("You are not authorized to view PMF metrics.");
  }
  return user.email as string;
}

export interface PmfSummary {
  nps: { overall: NpsSummary; byChannel: Record<string, NpsSummary> };
  churn: { total: number; byReason: Record<string, number>; byChannel: Record<string, number> };
  subscriptions: {
    total: number;
    active: number;
    paid: number;
    canceled: number;
    /** paid / total signups. */
    trialToPaid: number;
    /** non-canceled / total. */
    activeRetention: number;
  };
}

const UNSEGMENTED = "unattributed";

/** Aggregates NPS, churn, and subscription-funnel metrics for the dashboard. */
export async function getPmfSummary(): Promise<PmfSummary> {
  await requirePmfAdmin();
  const admin = createAdminClient();

  const [npsRes, churnRes, subsRes] = await Promise.all([
    admin.from("nps_responses").select("score, channel"),
    admin.from("churn_surveys").select("reason, channel"),
    admin.from("subscriptions").select("tier, status"),
  ]);

  if (npsRes.error || churnRes.error || subsRes.error) {
    log.error("failed to load pmf summary", {
      err: npsRes.error?.message ?? churnRes.error?.message ?? subsRes.error?.message,
    });
    throw new Error("Could not load PMF metrics.");
  }

  const npsRows = (npsRes.data ?? []) as { score: number; channel: string | null }[];
  const churnRows = (churnRes.data ?? []) as { reason: string; channel: string | null }[];
  const subRows = (subsRes.data ?? []) as { tier: string; status: string }[];

  // NPS overall + per channel.
  const byChannelScores: Record<string, number[]> = {};
  for (const r of npsRows) {
    const key = r.channel ?? UNSEGMENTED;
    (byChannelScores[key] ??= []).push(r.score);
  }
  const npsByChannel: Record<string, NpsSummary> = {};
  for (const [k, scores] of Object.entries(byChannelScores)) npsByChannel[k] = computeNps(scores);

  // Subscription funnel.
  const total = subRows.length;
  const active = subRows.filter((s) => s.status === "active").length;
  const paid = subRows.filter((s) => s.status === "active" && s.tier !== "free").length;
  const canceled = subRows.filter((s) => s.status === "canceled").length;

  return {
    nps: { overall: computeNps(npsRows.map((r) => r.score)), byChannel: npsByChannel },
    churn: {
      total: churnRows.length,
      byReason: tallyBy(churnRows, (r) => r.reason),
      byChannel: tallyBy(churnRows, (r) => r.channel ?? UNSEGMENTED),
    },
    subscriptions: {
      total,
      active,
      paid,
      canceled,
      trialToPaid: rate(paid, total),
      activeRetention: rate(total - canceled, total),
    },
  };
}
