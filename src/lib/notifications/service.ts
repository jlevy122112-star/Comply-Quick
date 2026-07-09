// Notification service — persists the in-app row (source of truth) and fans the
// same event out to email + mobile push via the dispatch layer. Used anywhere in
// the app that needs to notify a user of a change (regulatory or otherwise).

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/services";
import {
  dispatchNotification,
  type NotificationCategory,
  type NotificationEvent,
  type NotificationRecipient,
} from "./dispatch";

const log = logger.child({ module: "notifications:service" });

/** Maps the app-wide notification category to the DB `notifications.type` enum. */
const CATEGORY_TO_DB_TYPE: Record<NotificationCategory, string> = {
  regulation_change: "regulation_change",
  document_proposed: "document_proposed",
  action_needed: "action_needed",
  scan_complete: "info",
  billing: "info",
  team: "info",
  system: "info",
};

/** Loads a user's reachable channels + opt-outs for dispatch. */
export async function loadRecipient(admin: SupabaseClient, userId: string): Promise<NotificationRecipient> {
  const [{ data: userRes }, { data: tokens }, { data: prefs }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("push_tokens").select("token").eq("user_id", userId),
    admin
      .from("notification_preferences")
      .select("email_enabled, push_enabled, muted_categories")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const emailEnabled = prefs?.email_enabled ?? true;
  const pushEnabled = prefs?.push_enabled ?? true;
  return {
    email: emailEnabled ? (userRes?.user?.email ?? null) : null,
    pushTokens: pushEnabled ? (tokens ?? []).map((t) => t.token as string) : [],
    mutedCategories: ((prefs?.muted_categories as string[] | null) ?? []) as NotificationCategory[],
  };
}

export interface NotifyInput extends NotificationEvent {
  relatedProjectId?: string | null;
  relatedVersionId?: string | null;
}

/**
 * Records an in-app notification and dispatches it to the user's external
 * channels. The DB insert is authoritative; external delivery is best-effort and
 * never blocks the insert. Requires a service-role client (cross-user fan-out).
 */
export async function notifyUser(admin: SupabaseClient, input: NotifyInput): Promise<void> {
  const { error } = await admin.from("notifications").insert({
    user_id: input.userId,
    type: CATEGORY_TO_DB_TYPE[input.category],
    title: input.title,
    body: input.body,
    related_project_id: input.relatedProjectId ?? null,
    related_version_id: input.relatedVersionId ?? null,
  });
  if (error) log.warn("in-app notification insert failed", { error: error.message });

  try {
    const recipient = await loadRecipient(admin, input.userId);
    await dispatchNotification(recipient, input);
  } catch (err) {
    log.warn("external dispatch failed", { error: err instanceof Error ? err.message : String(err) });
  }
}
