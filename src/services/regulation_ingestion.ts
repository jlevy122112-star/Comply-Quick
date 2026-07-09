// Regulation ingestion pipeline.
//
// Fetches each framework's authoritative text from its official source (see
// `src/lib/regulations/sources/registry.ts`), normalizes it into the shared
// `NormalizedRegulation` shape, hashes it for change detection, and writes the
// structured JSON into `regulations/structured/`. Run it from the CLI
// (`npm run ingest:regulations`) or on a schedule; the monitoring agent consumes
// its output + `contentHash` to detect real-world regulatory changes.
//
// Normalizers are pure and unit-tested against small fixtures. Only the
// orchestrator touches the network and disk.

import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  REGULATION_SOURCES,
  ALL_FRAMEWORK_IDS,
  type RegulationFrameworkId,
  type RegulationSource,
} from "@/lib/regulations/sources/registry";
import { PROPRIETARY_CONTROL_INDEX } from "@/lib/regulations/proprietary-index";
import type { NormalizedRegulation, RegulationControl, RiskLevel } from "@/lib/regulations/types";

export const STRUCTURED_DIR = path.join(process.cwd(), "regulations", "structured");

/** Stable, order-independent content hash (djb2 → base36) over controls. */
export function hashControls(controls: RegulationControl[]): string {
  const seed = controls
    .map((c) => `${c.id}::${c.title}::${c.description}::${c.requirements.join("|")}`)
    .sort()
    .join("\n");
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  return hash.toString(36).toUpperCase().padStart(7, "0");
}

// ─── OSCAL (NIST) ─────────────────────────────────────────────────────────────

interface OscalPart {
  name?: string;
  prose?: string;
  parts?: OscalPart[];
}
interface OscalControl {
  id: string;
  title: string;
  parts?: OscalPart[];
  controls?: OscalControl[];
}
interface OscalGroup {
  title?: string;
  controls?: OscalControl[];
  groups?: OscalGroup[];
}
interface OscalCatalog {
  catalog?: {
    metadata?: { "last-modified"?: string; version?: string };
    groups?: OscalGroup[];
    controls?: OscalControl[];
  };
}

function collectProse(parts: OscalPart[] | undefined, wanted: string): string[] {
  if (!parts) return [];
  const out: string[] = [];
  for (const p of parts) {
    if (p.name === wanted && p.prose) out.push(p.prose);
    out.push(...collectProse(p.parts, wanted));
  }
  return out;
}

function flattenOscalControls(group: OscalGroup): OscalControl[] {
  // Controls declared directly on this group, plus their nested enhancements.
  const direct: OscalControl[] = [...(group.controls ?? [])];
  const nested: OscalControl[] = [];
  for (const c of direct) if (c.controls) nested.push(...c.controls);
  // Sub-group recursion already returns each sub-group's controls AND their
  // enhancements, so it must not be re-scanned for `.controls` (that double-counts).
  const fromSubGroups: OscalControl[] = [];
  for (const g of group.groups ?? []) fromSubGroups.push(...flattenOscalControls(g));
  return [...direct, ...nested, ...fromSubGroups];
}

/** Normalizes a NIST OSCAL catalog into controls. Pure. */
export function normalizeOscal(
  raw: OscalCatalog,
  source: RegulationSource,
  framework: RegulationFrameworkId
): RegulationControl[] {
  const cat = raw.catalog;
  if (!cat) return [];
  const groups = cat.groups ?? [];
  const flat: OscalControl[] = [...(cat.controls ?? [])];
  for (const g of groups) flat.push(...flattenOscalControls(g));

  return flat.map((c) => {
    const statement = collectProse(c.parts, "statement");
    const guidance = collectProse(c.parts, "guidance");
    const description = statement[0]?.trim() || c.title;
    return {
      framework,
      id: c.id.toUpperCase(),
      title: c.title,
      description: description.slice(0, 600),
      requirements: statement.map((s) => s.trim()).filter(Boolean),
      evidenceExamples: guidance
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3),
      riskLevel: inferRisk(`${c.title} ${description}`),
      remediationSteps: [],
      sourceText: source.ingestFullText ? statement.join("\n\n").slice(0, 4000) || null : null,
      sourceUrl: source.officialUrl,
    };
  });
}

// ─── eCFR structure (HHS/HIPAA, FTC/COPPA — Title 45/16) ────────────────────────
// The eCFR "structure" endpoint returns the regulation's hierarchy (parts →
// subparts → sections) with official identifiers and headings, but not the full
// prose. We extract real section IDs + titles from the official source (no
// fabricated text; `sourceText` stays null) so the app cites accurate control
// identifiers and detects structural changes. Full-text ingestion via the eCFR
// `/full` XML endpoint is a follow-up.

interface EcfrNode {
  type?: string;
  identifier?: string;
  label?: string;
  label_description?: string;
  children?: EcfrNode[];
}

function collectEcfrSections(node: EcfrNode, out: EcfrNode[] = []): EcfrNode[] {
  if (node.type === "section" && node.identifier) out.push(node);
  for (const child of node.children ?? []) collectEcfrSections(child, out);
  return out;
}

/** Normalizes an eCFR structure document into reference controls. Pure. */
export function normalizeEcfrStructure(
  raw: EcfrNode,
  source: RegulationSource,
  framework: RegulationFrameworkId
): RegulationControl[] {
  return collectEcfrSections(raw).map((s) => ({
    framework,
    id: `§ ${s.identifier}`,
    title: (s.label_description || s.label || `Section ${s.identifier}`).trim(),
    description: (s.label || "").trim(),
    requirements: [],
    evidenceExamples: [],
    riskLevel: inferRisk(`${s.label_description ?? ""} ${s.label ?? ""}`),
    remediationSteps: [],
    sourceText: null,
    sourceUrl: source.officialUrl,
  }));
}

// ─── Proprietary reference-only (SOC 2 / ISO 27001 / PCI DSS) ───────────────────

/**
 * Builds reference-only controls for a proprietary framework from the curated
 * public index of control IDs/titles. No licensed prose is stored — descriptions
 * are our own short summaries and `sourceText` stays null.
 */
export function normalizeReferenceOnly(
  source: RegulationSource,
  framework: RegulationFrameworkId
): RegulationControl[] {
  const index = PROPRIETARY_CONTROL_INDEX[framework] ?? [];
  return index.map((entry) => ({
    framework,
    id: entry.id,
    title: entry.title,
    description: entry.summary,
    requirements: [],
    evidenceExamples: [],
    riskLevel: entry.riskLevel,
    remediationSteps: [],
    sourceText: null,
    sourceUrl: source.officialUrl,
  }));
}

// ─── Heuristic risk inference ───────────────────────────────────────────────────

const HIGH_RISK = /breach|encryption|access control|authentication|incident|transfer|deletion|sensitive|consent/i;
const MEDIUM_RISK = /audit|log|monitor|retention|training|vendor|policy|assessment/i;

export function inferRisk(text: string): RiskLevel {
  if (HIGH_RISK.test(text)) return "high";
  if (MEDIUM_RISK.test(text)) return "medium";
  return "low";
}

// ─── Orchestrator ───────────────────────────────────────────────────────────────

const UA = { "user-agent": "Comply-Quick-Ingestion/1.0" };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return await res.text();
}

/**
 * Strips a fetched HTML page down to visible text and hashes it, for
 * change-detection on `source_watch` sources. Scripts/styles/markup are removed
 * so cosmetic markup churn doesn't produce false-positive change alerts.
 */
export function hashPageText(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  return hash.toString(36).toUpperCase().padStart(7, "0");
}

/** Fetches + normalizes one framework. Network for ingestable sources only. */
export async function ingestFramework(framework: RegulationFrameworkId): Promise<NormalizedRegulation> {
  const source = REGULATION_SOURCES[framework];
  const fetchedAt = new Date().toISOString();
  let controls: RegulationControl[] = [];
  let sourceVersion = fetchedAt.slice(0, 10);

  let contentHash: string;

  if (source.format === "oscal_json") {
    const raw = await fetchJson<OscalCatalog>(source.ingestUrl);
    controls = normalizeOscal(raw, source, framework);
    sourceVersion =
      raw.catalog?.metadata?.version ?? raw.catalog?.metadata?.["last-modified"]?.slice(0, 10) ?? sourceVersion;
    contentHash = hashControls(controls);
  } else if (source.format === "ecfr_json") {
    const raw = await fetchJson<EcfrNode>(source.ingestUrl);
    controls = normalizeEcfrStructure(raw, source, framework);
    contentHash = hashControls(controls);
  } else if (source.format === "reference_only") {
    controls = normalizeReferenceOnly(source, framework);
    contentHash = hashControls(controls);
  } else {
    // `source_watch` (and HTML sources without a dedicated parser yet): the agent
    // fetches the official page and hashes its visible text so it still detects
    // real-world changes and alerts. For proprietary bodies we attach the
    // reference-only control index; we never store the page's licensed text.
    controls = normalizeReferenceOnly(source, framework);
    const page = await fetchText(source.ingestUrl);
    contentHash = hashPageText(page);
  }

  return {
    framework,
    label: source.label,
    institution: source.institution,
    officialUrl: source.officialUrl,
    license: source.license,
    fetchedAt,
    sourceVersion,
    contentHash,
    controls,
  };
}

/** Reads the previously-ingested snapshot for a framework, if any. */
export async function readStructured(framework: RegulationFrameworkId): Promise<NormalizedRegulation | null> {
  try {
    const buf = await readFile(path.join(STRUCTURED_DIR, `${framework}.json`), "utf8");
    return JSON.parse(buf) as NormalizedRegulation;
  } catch {
    return null;
  }
}

/**
 * Persists a normalized snapshot to `regulations/structured/`. Callers that
 * detect changes MUST write the fresh snapshot back, otherwise the next sweep
 * compares against a stale file and re-detects the same change.
 */
export async function writeStructured(snapshot: NormalizedRegulation): Promise<void> {
  await mkdir(STRUCTURED_DIR, { recursive: true });
  await writeFile(path.join(STRUCTURED_DIR, `${snapshot.framework}.json`), JSON.stringify(snapshot, null, 2), "utf8");
}

export interface IngestResult {
  framework: RegulationFrameworkId;
  changed: boolean;
  controlCount: number;
  contentHash: string;
  /** Set when this framework's ingestion failed; other frameworks still run. */
  error?: string;
}

/**
 * Ingests all frameworks, writes structured JSON, and reports what changed. Each
 * framework is isolated: a transient fetch/parse failure on one source is
 * captured in its result and does not abort the batch (mirrors the monitor
 * agent's resilient sweep).
 */
export async function ingestAll(): Promise<IngestResult[]> {
  await mkdir(STRUCTURED_DIR, { recursive: true });
  const results: IngestResult[] = [];
  for (const framework of ALL_FRAMEWORK_IDS) {
    try {
      const prev = await readStructured(framework);
      const next = await ingestFramework(framework);
      const changed = !prev || prev.contentHash !== next.contentHash;
      await writeStructured(next);
      results.push({ framework, changed, controlCount: next.controls.length, contentHash: next.contentHash });
    } catch (err) {
      results.push({
        framework,
        changed: false,
        controlCount: 0,
        contentHash: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}
