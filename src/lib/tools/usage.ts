import { createClient } from "@/lib/supabase/server";

/** Quick tools whose usage is tracked as an activation signal. */
export type QuickToolKey = "cookie_banner" | "cookie_policy" | "dpa" | "subprocessors";

const VALID_TOOLS: readonly QuickToolKey[] = ["cookie_banner", "cookie_policy", "dpa", "subprocessors"];

export function isQuickToolKey(value: string): value is QuickToolKey {
  return (VALID_TOOLS as readonly string[]).includes(value);
}

/**
 * Records that the current user generated output from a quick tool. Best-effort:
 * returns false (without throwing) when unauthenticated or on any DB error so a
 * generation flow is never blocked by tracking.
 */
export async function recordToolUsage(tool: QuickToolKey): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    // Idempotent per (user, tool): the unique constraint caps rows at one per
    // distinct tool and keeps the first-use timestamp. Repeat generations are no-ops.
    const { error } = await supabase
      .from("tool_usage_events")
      .upsert({ user_id: user.id, tool }, { onConflict: "user_id,tool", ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

/** Distinct quick tools the current user has used at least once. */
export async function listCompletedTools(): Promise<QuickToolKey[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase.from("tool_usage_events").select("tool").eq("user_id", user.id);
    if (error || !data) return [];

    const seen = new Set<QuickToolKey>();
    for (const row of data as { tool: string }[]) {
      if (isQuickToolKey(row.tool)) seen.add(row.tool);
    }
    return [...seen];
  } catch {
    return [];
  }
}
