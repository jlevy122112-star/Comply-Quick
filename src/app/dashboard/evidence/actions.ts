"use server";

import { revalidatePath } from "next/cache";
import { compileAndSaveEvidencePack } from "@/lib/evidence-service";
import { setEvidenceStatus } from "@/lib/evidence-db";
import type { EvidenceStatus } from "@/lib/agents";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";

export async function compileEvidenceAction(framework: RegulationFrameworkId) {
  const pack = await compileAndSaveEvidencePack(framework);
  revalidatePath("/dashboard/evidence");
  return pack;
}

export async function setEvidenceStatusAction(id: string, status: EvidenceStatus, evidenceRef?: string | null) {
  await setEvidenceStatus(id, status, evidenceRef);
  revalidatePath("/dashboard/evidence");
}
