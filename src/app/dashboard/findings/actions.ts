"use server";

import { revalidatePath } from "next/cache";
import { updateFindingStatus, assignFinding, type FindingStatus } from "@/lib/findings-db";

const VALID_STATUSES: FindingStatus[] = ["open", "in_progress", "resolved", "reopened"];

/** Server action: change a finding's status. Validates at runtime (types erased). */
export async function setFindingStatusAction(id: string, status: string): Promise<void> {
  if (!id || !VALID_STATUSES.includes(status as FindingStatus)) return;
  const ok = await updateFindingStatus(id, status as FindingStatus);
  if (ok) revalidatePath("/dashboard/findings");
}

/** Server action: assign (or clear) a finding's owner. */
export async function assignFindingAction(id: string, owner: string): Promise<void> {
  if (!id) return;
  const trimmed = owner.trim();
  const ok = await assignFinding(id, trimmed.length ? trimmed.slice(0, 120) : null);
  if (ok) revalidatePath("/dashboard/findings");
}
