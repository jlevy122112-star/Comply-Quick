// Regulation Monitor Agent.
//
// Learns the current state of EVERY appropriate regulatory agency in the source
// registry, watches each official source for real-world changes, and — when a
// regulation is added or amended — raises a per-user alert classified by the
// industries and jurisdictions it affects. It then hands the change to the
// Autopilot Remediation Agent, which drafts a human-approvable edit plan.
//
// The detection core is pure and unit-tested; only `runRegulationMonitor`
// touches the network/disk (via the ingestion pipeline).

import { REGULATION_SOURCE_LIST, type RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import { ingestFramework, readStructured, writeStructured } from "@/services/regulation_ingestion";
import { logger } from "@/services";
import { industriesForFramework, regionsForFramework } from "./classify";
import type { AgentRunResult, RegulationChangeFinding } from "./types";

const log = logger.child({ module: "agent:regulation_monitor" });

/** A before/after hash pair for one source, as seen by a monitor sweep. */
export interface SourceHashObservation {
  framework: RegulationFrameworkId;
  previousHash: string | null;
  currentHash: string;
}

/**
 * Pure change-detection: turns hash observations into classified findings. A
 * finding is raised when there is no previous hash (newly learned) or the hash
 * changed (amended in real life).
 */
export function detectChanges(observations: SourceHashObservation[], detectedAt: string): RegulationChangeFinding[] {
  const byId = new Map(REGULATION_SOURCE_LIST.map((s) => [s.framework, s]));
  const findings: RegulationChangeFinding[] = [];
  for (const obs of observations) {
    if (obs.previousHash !== null && obs.previousHash === obs.currentHash) continue;
    const source = byId.get(obs.framework);
    if (!source) continue;
    findings.push({
      framework: obs.framework,
      label: source.label,
      institution: source.institution,
      officialUrl: source.officialUrl,
      previousHash: obs.previousHash,
      currentHash: obs.currentHash,
      affectedIndustries: industriesForFramework(obs.framework),
      affectedRegions: regionsForFramework(obs.framework),
      detectedAt,
    });
  }
  return findings;
}

export interface MonitorRunOptions {
  /** Limit the sweep to specific frameworks (default: all appropriate agencies). */
  frameworks?: RegulationFrameworkId[];
}

/**
 * Runs a full monitor sweep across every registered agency: re-ingests each
 * source, compares its content hash to the last stored snapshot, and returns
 * classified findings for everything that changed. Resilient — a single source
 * failing (network/format) is logged and skipped, never aborting the sweep.
 */
export async function runRegulationMonitor(options: MonitorRunOptions = {}): Promise<AgentRunResult> {
  const startedAt = new Date().toISOString();
  const frameworks = options.frameworks ?? (REGULATION_SOURCE_LIST.map((s) => s.framework) as RegulationFrameworkId[]);
  const observations: SourceHashObservation[] = [];

  for (const framework of frameworks) {
    try {
      const prev = await readStructured(framework);
      const next = await ingestFramework(framework);
      observations.push({ framework, previousHash: prev?.contentHash ?? null, currentHash: next.contentHash });
      // Persist the fresh snapshot so the next sweep compares against this state
      // instead of re-detecting the same change every run.
      if (!prev || prev.contentHash !== next.contentHash) await writeStructured(next);
    } catch (err) {
      log.warn("source sweep failed", { framework, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const findings = detectChanges(observations, startedAt);
  const finishedAt = new Date().toISOString();
  const status = findings.length > 0 ? "ok" : "no_changes";
  const summary =
    findings.length > 0
      ? `Detected ${findings.length} regulatory change(s) across ${new Set(findings.map((f) => f.institution)).size} agencies.`
      : `Swept ${observations.length} sources; no changes since last sweep.`;

  log.info("regulation monitor sweep complete", { swept: observations.length, changed: findings.length });
  return { agent: "regulation_monitor", status, startedAt, finishedAt, summary, findings };
}
