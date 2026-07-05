// Calendar — one-way ICS feed service ([Up7] calendar linking).
//
// Manages a per-user, unguessable feed token and resolves the token into a
// windowed set of the user's calendar events for the public ICS endpoint. The
// feed is strictly one-way: our events project into the subscriber's calendar.
//
//   • getOrCreateFeed / rotateFeed / revokeFeed run under the RLS session client.
//   • getFeedEvents runs under the service-role client (no session on the public
//     ICS request) but always filters by the token's owning user_id.

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UnauthorizedError } from "@/services/errors";
import { addDays, toDayKey, type CalendarEvent } from "./events";
import { collectPersonalEvents } from "./service";

/** How far back / forward the feed publishes events, relative to today (UTC). */
export const FEED_PAST_DAYS = 31;
export const FEED_FUTURE_DAYS = 183; // ~6 months

export interface CalendarFeed {
  token: string;
  createdAt: string;
}

/** Unguessable URL-safe feed token (~32 chars of base64url entropy). */
function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError("Sign in to manage your calendar feed.");
  return { supabase, user };
}

/** Returns the caller's live feed, creating one on first use. */
export async function getOrCreateFeed(): Promise<CalendarFeed> {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("calendar_feeds")
    .select("token, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) return { token: existing.token as string, createdAt: existing.created_at as string };

  const { data, error } = await supabase
    .from("calendar_feeds")
    .insert({ user_id: user.id, token: generateToken() })
    .select("token, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create calendar feed.");
  return { token: data.token as string, createdAt: data.created_at as string };
}

/** Revokes the caller's current feed (the old subscription URL stops resolving). */
export async function revokeFeed(): Promise<void> {
  const { supabase, user } = await requireUser();
  await supabase
    .from("calendar_feeds")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("revoked_at", null);
}

/** Rotates the feed: revokes the current token and issues a fresh one. */
export async function rotateFeed(): Promise<CalendarFeed> {
  await revokeFeed();
  return getOrCreateFeed();
}

/**
 * Resolves a public feed token to its owner's events across the publish window.
 * Returns null for unknown / revoked tokens. Uses the service-role client since
 * the ICS request carries no session; every query is scoped to the owner's id.
 */
export async function getFeedEvents(token: string, now: Date = new Date()): Promise<CalendarEvent[] | null> {
  const admin = createAdminClient();
  const { data: feed } = await admin
    .from("calendar_feeds")
    .select("user_id, revoked_at")
    .eq("token", token)
    .maybeSingle();
  if (!feed || feed.revoked_at) return null;

  const today = toDayKey(now);
  const start = addDays(today, -FEED_PAST_DAYS);
  const end = addDays(today, FEED_FUTURE_DAYS);
  return collectPersonalEvents(admin, feed.user_id as string, start, end);
}
