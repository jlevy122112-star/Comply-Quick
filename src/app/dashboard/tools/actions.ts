"use server";

import { revalidatePath } from "next/cache";
import { recordToolUsage, type QuickToolKey } from "@/lib/tools/usage";

/**
 * Records that the signed-in user generated output from a quick tool, then
 * revalidates the Command Center so the onboarding tracker reflects it.
 * Best-effort — never throws into the client generation flow.
 */
export async function recordToolUsageAction(tool: QuickToolKey): Promise<void> {
  const ok = await recordToolUsage(tool);
  if (ok) revalidatePath("/dashboard/home");
}
