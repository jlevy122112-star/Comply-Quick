// Deterministic obligation traversal (accuracy engine — phase 2).
//
// Input: the services detected on a site + the jurisdictions it targets +
// the data categories in play. Output: the list of applicable obligations, each
// with a traceable path (service → framework → obligation → source) and its
// provenance. This is pure and deterministic — the same inputs always yield the
// same obligations in the same order — so results are reproducible and auditable.

import { getObligation, type DataCategory, type JurisdictionId, type ObligationNode, type Provenance } from "./graph";
import { getService, type ServiceCatalogEntry } from "./catalog";

export interface ObligationResult {
  obligation: ObligationNode;
  /** Human-readable service names (or "jurisdiction baseline") that triggered it. */
  triggeredBy: string[];
  /** Traceable path, e.g. "Stripe → GDPR Art. 28(3) → DPA required → https://stripe.com/legal/dpa". */
  path: string;
  provenance: Provenance;
}

export interface TraversalInput {
  /** Detected service ids (scanner fingerprint ids). */
  services: string[];
  jurisdictions: JurisdictionId[];
  /** Explicit contextual signals supplied by the scan or site configuration. */
  dataCategories?: DataCategory[];
}

const SEVERITY_ORDER: Record<ObligationNode["severity"], number> = { critical: 0, warning: 1, info: 2 };

/** True when the obligation applies in at least one of the active jurisdictions. */
function appliesInJurisdiction(node: ObligationNode, active: Set<JurisdictionId>): boolean {
  if (node.jurisdictions.includes("global")) return true;
  if (
    (node.framework === "coppa" || node.framework === "can_spam") &&
    Array.from(active).some((jurisdiction) => jurisdiction === "us_general" || jurisdiction.startsWith("us_"))
  ) {
    return true;
  }
  return node.jurisdictions.some((j) => active.has(j));
}

/** Terminal reference for the path string: the DPA URL if any, else the first evidence pattern. */
function pathTerminal(node: ObligationNode, services: ServiceCatalogEntry[]): string {
  const withDpa = services.find((s) => s.dpaUrl);
  if (node.id === "gdpr.art28.dpa" && withDpa?.dpaUrl) return withDpa.dpaUrl;
  return node.evidence[0] ?? node.provenance.url;
}

/**
 * Traverses the context graph for the given detection + jurisdictions and
 * returns the applicable obligations with traceable paths. Obligations are
 * de-duplicated (a DPA required by three processors appears once, crediting all
 * three) and sorted critical-first, then by id for stability.
 */
export function deriveObligations(input: TraversalInput): ObligationResult[] {
  const active = new Set<JurisdictionId>(input.jurisdictions);
  // obligationId -> { node, triggering catalog entries }
  const hits = new Map<string, { node: ObligationNode; services: ServiceCatalogEntry[] }>();

  for (const serviceId of input.services) {
    const entry = getService(serviceId);
    if (!entry) continue;
    for (const obligationId of entry.triggersObligations) {
      const node = getObligation(obligationId);
      if (!node) continue;
      if (!appliesInJurisdiction(node, active)) continue;
      const existing = hits.get(obligationId);
      if (existing) existing.services.push(entry);
      else hits.set(obligationId, { node, services: [entry] });
    }
  }

  const contextualCategories = new Set(input.dataCategories ?? []);
  const addContextualObligation = (id: string) => {
    const node = getObligation(id);
    if (!node || !appliesInJurisdiction(node, active)) return;
    const services = input.services
      .map((id) => getService(id))
      .filter((entry): entry is ServiceCatalogEntry => entry !== undefined);
    hits.set(id, { node, services });
  };

  // COPPA is conditional: a public scan cannot determine whether a site is
  // child-directed, so it is derived only when the caller explicitly supplies
  // the children data category.
  if (contextualCategories.has("children")) addContextualObligation("coppa.child_directed_privacy");

  // CAN-SPAM is likewise contextual rather than a generic tracker obligation:
  // the caller must identify an email-marketing data flow.
  if (contextualCategories.has("email")) addContextualObligation("can_spam.commercial_email");

  // Cross-border transfer safeguards (Art. 46 / SCCs) are derived, not hard-coded
  // per service: they apply only when EU/UK data actually leaves the EEA — i.e.
  // when at least one detected vendor is outside the EU. This keeps the catalog
  // region-agnostic and makes the geography the single source of truth.
  const transferNode = getObligation("gdpr.art46.transfers");
  if (transferNode && appliesInJurisdiction(transferNode, active)) {
    const nonEuVendors = input.services
      .map((id) => getService(id))
      .filter((e): e is ServiceCatalogEntry => e !== undefined && e.vendorRegion !== "eu");
    if (nonEuVendors.length > 0) {
      // Merge (don't overwrite) so we never drop credits if a future catalog
      // entry also lists this obligation directly.
      const existing = hits.get(transferNode.id);
      const merged = existing ? [...existing.services, ...nonEuVendors] : nonEuVendors;
      const unique = Array.from(new Map(merged.map((s) => [s.id, s])).values());
      hits.set(transferNode.id, { node: transferNode, services: unique });
    }
  }

  const results: ObligationResult[] = [];
  for (const { node, services } of hits.values()) {
    const names = Array.from(new Set(services.map((s) => s.name)));
    const triggerNames = names.length > 0 ? names : ["Declared data context"];
    results.push({
      obligation: node,
      triggeredBy: triggerNames,
      path: `${triggerNames.join(", ")} → ${frameworkLabel(node.framework)} ${node.reference} → ${node.title} → ${pathTerminal(node, services)}`,
      provenance: node.provenance,
    });
  }

  results.sort((a, b) => {
    const s = SEVERITY_ORDER[a.obligation.severity] - SEVERITY_ORDER[b.obligation.severity];
    return s !== 0 ? s : a.obligation.id.localeCompare(b.obligation.id);
  });
  return results;
}

const FRAMEWORK_LABELS: Record<ObligationNode["framework"], string> = {
  gdpr: "GDPR",
  ccpa: "CCPA",
  cpra: "CPRA",
  lgpd: "LGPD",
  hipaa: "HIPAA",
  pci_dss: "PCI-DSS",
  soc2: "SOC 2",
  iso27001: "ISO 27001",
  eu_ai_act: "EU AI Act",
  pipeda: "PIPEDA",
  vcdpa: "VCDPA",
  cpa: "Colorado CPA",
  ctdpa: "CTDPA",
  tdpsa: "Texas TDPSA",
  ucpa: "Utah UCPA",
  coppa: "COPPA",
  can_spam: "CAN-SPAM",
};

function frameworkLabel(f: ObligationNode["framework"]): string {
  return FRAMEWORK_LABELS[f];
}
