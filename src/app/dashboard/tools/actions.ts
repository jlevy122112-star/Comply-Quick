"use server";

import { revalidatePath } from "next/cache";
import { isQuickToolKey, recordToolUsage } from "@/lib/tools/usage";

/**
 * Records that the signed-in user generated output from a quick tool, then
 * revalidates the Command Center so the onboarding tracker reflects it.
 * Best-effort — never throws into the client generation flow. The `tool`
 * argument is validated at runtime (TS types are erased) before any DB write.
 */
export async function recordToolUsageAction(tool: string): Promise<void> {
  if (!isQuickToolKey(tool)) return;
  const ok = await recordToolUsage(tool);
  if (ok) revalidatePath("/dashboard/home");
}
