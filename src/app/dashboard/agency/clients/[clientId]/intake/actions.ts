"use server";

import { revalidatePath } from "next/cache";
import { saveIntake } from "@/lib/agency/onboarding";

export type SaveIntakeResult =
  { ok: true; status: "draft" | "submitted"; updatedAt: string | null } | { ok: false; error: string };

/**
 * Persists the onboarding intake for a client. `submit` flips the record to
 * "submitted". All fields are re-validated/normalized server-side inside
 * `saveIntake`, so the client payload is never trusted as-is.
 */
export async function saveIntakeAction(
  clientId: string,
  rawAnswers: unknown,
  submit: boolean
): Promise<SaveIntakeResult> {
  try {
    const intake = await saveIntake(clientId, rawAnswers, submit);
    revalidatePath(`/dashboard/agency/clients/${clientId}/intake`);
    return { ok: true, status: intake.status, updatedAt: intake.updatedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save intake." };
  }
}
