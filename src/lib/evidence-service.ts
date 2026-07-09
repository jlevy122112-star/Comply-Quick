// Audit & Evidence — orchestration between the agent and persistence.
//
// Ties the pure Audit & Evidence agent (compileEvidencePack) to the static
// control catalog and the persisted evidence ledger so a caller gets a fully
// grounded, up-to-date pack, and can save it back. No fabrication: controls
// come from the license-safe catalog, statuses from the user's own records.

import { compileEvidencePack, type AuditEvidencePack } from "@/lib/agents";
import { controlsForFramework, FRAMEWORKS_WITH_STATIC_CONTROLS } from "@/lib/regulations/controls";
import { getEvidenceLedger, saveEvidencePack } from "@/lib/evidence-db";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";

export { FRAMEWORKS_WITH_STATIC_CONTROLS };

/**
 * Compiles a framework's evidence pack from the static control catalog + the
 * caller's persisted ledger. Returns null when the framework has no static
 * controls (full-text frameworks are ingestion-only).
 */
export async function getEvidencePack(
  framework: RegulationFrameworkId,
  projectId: string | null = null
): Promise<AuditEvidencePack | null> {
  const controls = controlsForFramework(framework);
  if (controls.length === 0) return null;
  const ledger = await getEvidenceLedger(framework, projectId);
  return compileEvidencePack(framework, controls, ledger);
}

/** Compiles and persists the pack (materializes per-control evidence rows). */
export async function compileAndSaveEvidencePack(
  framework: RegulationFrameworkId,
  projectId: string | null = null
): Promise<AuditEvidencePack | null> {
  const pack = await getEvidencePack(framework, projectId);
  if (!pack) return null;
  await saveEvidencePack(pack, projectId);
  return pack;
}
