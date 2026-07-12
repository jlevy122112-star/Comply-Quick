// Breach-notification workflow — personal-data breach register + deterministic
// regulatory notification deadlines.
//
// When a controller becomes aware of a personal-data breach, several regimes
// impose notification duties on fixed clocks (GDPR Art. 33's 72 hours to the
// supervisory authority being the strictest well-known example). This module
// persists each incident to the owner-scoped `breach_incidents` register and
// derives, deterministically, which notification obligations apply and when
// each is due — so the dashboard can surface a countdown and an auditable record
// of when the required notifications were actually made.
//
// The deadlines here are engineering aids, not legal advice: actual obligations
// depend on the facts of the breach, the data involved, and jurisdictional
// analysis. The rules encode widely-cited statutory outer bounds.

import { createClient } from "@/lib/supabase/server";
import { REGION_RULES, type TargetRegion } from "@/lib/tools/data";

export type BreachSeverity = "low" | "medium" | "high" | "critical";
export type BreachStatus = "open" | "contained" | "notifying" | "resolved" | "closed";

export const BREACH_SEVERITIES: readonly BreachSeverity[] = ["low", "medium", "high", "critical"];
export const BREACH_STATUSES: readonly BreachStatus[] = ["open", "contained", "notifying", "resolved", "closed"];

// Categories of personal data that may be involved in a breach. `health` and
// `financial` trigger sector-specific regimes (HIPAA, GLBA-adjacent rules).
export const BREACH_DATA_CATEGORIES: readonly string[] = [
  "contact",
  "identifiers",
  "financial",
  "health",
  "credentials",
  "government_id",
  "location",
  "biometric",
  "children",
  "other",
];

export interface BreachIncident {
  id: string;
  title: string;
  description: string | null;
  severity: BreachSeverity;
  status: BreachStatus;
  discoveredAt: string;
  occurredAt: string | null;
  containedAt: string | null;
  affectedIndividuals: number;
  dataCategories: string[];
  regions: string[];
  highRisk: boolean;
  /** Per-obligation notification timestamps, keyed by notification-rule id. */
  notifications: Record<string, string>;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BreachIncidentInput {
  title: string;
  description: string | null;
  severity: BreachSeverity;
  discoveredAt: string;
  occurredAt: string | null;
  affectedIndividuals: number;
  dataCategories: string[];
  regions: string[];
  highRisk: boolean;
  notes: string | null;
}

const TITLE_MAX = 200;
const TEXT_MAX = 5000;
const MAX_AFFECTED = 1_000_000_000;

function trimOrNull(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, max);
}

export type NormalizeBreachResult = { ok: true; value: BreachIncidentInput } | { ok: false; error: string };

/**
 * Validates and normalizes an untrusted breach payload. Bounds free text,
 * restricts enums, filters categories/regions to known values, and requires a
 * valid discovery timestamp (the clock every deadline is measured from).
 */
export function normalizeBreach(raw: unknown): NormalizeBreachResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "A breach payload object is required." };
  }
  const body = raw as Record<string, unknown>;

  const title = trimOrNull(body.title, TITLE_MAX);
  if (!title) return { ok: false, error: "A title is required." };

  const severity = body.severity;
  if (typeof severity !== "string" || !BREACH_SEVERITIES.includes(severity as BreachSeverity)) {
    return { ok: false, error: "A valid severity is required." };
  }

  const discoveredAtRaw = typeof body.discoveredAt === "string" ? body.discoveredAt : "";
  const discoveredDate = new Date(discoveredAtRaw);
  if (!discoveredAtRaw || Number.isNaN(discoveredDate.getTime())) {
    return { ok: false, error: "A valid discoveredAt timestamp is required." };
  }

  let occurredAt: string | null = null;
  if (body.occurredAt !== undefined && body.occurredAt !== null && body.occurredAt !== "") {
    if (typeof body.occurredAt !== "string" || Number.isNaN(new Date(body.occurredAt).getTime())) {
      return { ok: false, error: "occurredAt must be a valid timestamp." };
    }
    occurredAt = new Date(body.occurredAt).toISOString();
  }

  let affectedIndividuals = 0;
  if (body.affectedIndividuals !== undefined && body.affectedIndividuals !== null) {
    const n = Number(body.affectedIndividuals);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "affectedIndividuals must be a non-negative number." };
    }
    affectedIndividuals = Math.min(Math.floor(n), MAX_AFFECTED);
  }

  const dataCategories = Array.isArray(body.dataCategories)
    ? Array.from(
        new Set(
          body.dataCategories
            .filter((c): c is string => typeof c === "string")
            .map((c) => c.trim().toLowerCase())
            .filter((c) => BREACH_DATA_CATEGORIES.includes(c))
        )
      )
    : [];

  const knownRegions = Object.keys(REGION_RULES) as TargetRegion[];
  const regions = Array.isArray(body.regions)
    ? Array.from(
        new Set(
          body.regions
            .filter((r): r is string => typeof r === "string")
            .map((r) => r.trim())
            .filter((r) => (knownRegions as string[]).includes(r))
        )
      )
    : [];

  return {
    ok: true,
    value: {
      title,
      description: trimOrNull(body.description, TEXT_MAX),
      severity: severity as BreachSeverity,
      discoveredAt: discoveredDate.toISOString(),
      occurredAt,
      affectedIndividuals,
      dataCategories,
      regions,
      highRisk: body.highRisk === true,
      notes: trimOrNull(body.notes, TEXT_MAX),
    },
  };
}

// ── Deterministic notification obligations ──────────────────────────────────

export type NotifyAudience = "authority" | "individuals";
export type ObligationState = "met" | "upcoming" | "due_soon" | "overdue";

export interface NotificationRule {
  id: string;
  framework: string;
  authority: string;
  audience: NotifyAudience;
  /** Hours from discovery within which notification must be made, or null for
   *  "without undue delay" duties that have no fixed statutory clock. */
  dueHours: number | null;
  basis: string;
  /** Whether this rule applies to the given incident. */
  applies: (incident: NotifiableIncident) => boolean;
}

/** The subset of incident fields the rules need — lets rules be unit-tested
 *  without a full DB row. */
export interface NotifiableIncident {
  discoveredAt: string;
  regions: string[];
  dataCategories: string[];
  highRisk: boolean;
  /** Per-obligation notification timestamps, keyed by notification-rule id. */
  notifications: Record<string, string>;
}

const HOUR_MS = 3_600_000;

const hasRegion = (i: NotifiableIncident, r: TargetRegion) => i.regions.includes(r);

// Widely-cited statutory outer bounds. Kept deliberately conservative.
export const NOTIFICATION_RULES: readonly NotificationRule[] = [
  {
    id: "gdpr_art33_authority",
    framework: "GDPR Art. 33",
    authority: "Supervisory authority (DPA)",
    audience: "authority",
    dueHours: 72,
    basis: "Notify the competent supervisory authority within 72 hours of becoming aware.",
    applies: (i) => hasRegion(i, "eu_gdpr"),
  },
  {
    id: "gdpr_art34_individuals",
    framework: "GDPR Art. 34",
    authority: "Affected data subjects",
    audience: "individuals",
    dueHours: null,
    basis: "Notify affected individuals without undue delay when the breach is high risk to their rights.",
    applies: (i) => hasRegion(i, "eu_gdpr") && i.highRisk,
  },
  {
    id: "us_state_individuals",
    framework: "US state breach laws",
    authority: "Affected residents",
    audience: "individuals",
    dueHours: 720, // 30 days — the strictest common state cap.
    basis: "Notify affected residents without unreasonable delay; many states cap this at 30–60 days.",
    applies: (i) => hasRegion(i, "us_general") || hasRegion(i, "california_ccpa"),
  },
  {
    id: "hipaa_individuals",
    framework: "HIPAA Breach Notification Rule",
    authority: "Affected individuals & HHS",
    audience: "individuals",
    dueHours: 1440, // 60 days (45 CFR §164.404).
    basis: "Notify affected individuals (and HHS) without unreasonable delay and no later than 60 days.",
    // HIPAA is a US federal regime; only applies when there is a US nexus.
    applies: (i) =>
      i.dataCategories.includes("health") && (hasRegion(i, "us_general") || hasRegion(i, "california_ccpa")),
  },
  {
    id: "lgpd_authority",
    framework: "LGPD (Brazil)",
    authority: "ANPD",
    audience: "authority",
    dueHours: 48, // ANPD guidance: within a reasonable period, treated as ~2 business days.
    basis: "Notify the ANPD within a reasonable period of becoming aware.",
    applies: (i) => hasRegion(i, "brazil_lgpd"),
  },
  {
    id: "pipeda_authority",
    framework: "PIPEDA (Canada)",
    authority: "Office of the Privacy Commissioner",
    audience: "authority",
    dueHours: null,
    basis: "Report to the OPC as soon as feasible when there is a real risk of significant harm.",
    applies: (i) => hasRegion(i, "canada_pipeda"),
  },
  {
    id: "australia_ndb_authority",
    framework: "Australia NDB scheme",
    authority: "OAIC",
    audience: "authority",
    dueHours: 720, // Assess within 30 days; notify as soon as practicable.
    basis: "Assess within 30 days and notify the OAIC and individuals as soon as practicable.",
    applies: (i) => hasRegion(i, "australia_privacy"),
  },
];

export interface ComputedObligation {
  id: string;
  framework: string;
  authority: string;
  audience: NotifyAudience;
  basis: string;
  /** ISO deadline, or null for "without undue delay" duties. */
  dueAt: string | null;
  /** Whether this specific notification has been recorded as made. */
  satisfied: boolean;
  /** ISO timestamp this specific notification was recorded, or null. */
  notifiedAt: string | null;
  state: ObligationState;
}

/**
 * Derives the notification obligations that apply to an incident and their
 * status relative to `now`. Pure and deterministic given its inputs.
 */
export function computeObligations(incident: NotifiableIncident, now: Date = new Date()): ComputedObligation[] {
  const discovered = new Date(incident.discoveredAt).getTime();

  return NOTIFICATION_RULES.filter((rule) => rule.applies(incident)).map((rule) => {
    const notifiedAt = incident.notifications[rule.id] ?? null;
    const satisfied = notifiedAt !== null;

    const dueAt = rule.dueHours === null ? null : new Date(discovered + rule.dueHours * HOUR_MS).toISOString();

    let state: ObligationState;
    if (satisfied) {
      state = "met";
    } else if (dueAt === null) {
      // No fixed clock: always surface as due-soon so it isn't ignored.
      state = "due_soon";
    } else {
      const msLeft = new Date(dueAt).getTime() - now.getTime();
      if (msLeft < 0) state = "overdue";
      else if (msLeft <= 24 * HOUR_MS) state = "due_soon";
      else state = "upcoming";
    }

    return {
      id: rule.id,
      framework: rule.framework,
      authority: rule.authority,
      audience: rule.audience,
      basis: rule.basis,
      dueAt,
      satisfied,
      notifiedAt,
      state,
    };
  });
}

/** Summarizes an incident's obligations for a compact dashboard badge. */
export function summarizeObligations(obligations: ComputedObligation[]): {
  total: number;
  met: number;
  overdue: number;
  dueSoon: number;
} {
  return {
    total: obligations.length,
    met: obligations.filter((o) => o.state === "met").length,
    overdue: obligations.filter((o) => o.state === "overdue").length,
    dueSoon: obligations.filter((o) => o.state === "due_soon").length,
  };
}

// ── Persistence (RLS-scoped to the owner) ────────────────────────────────────

interface BreachRow {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  discovered_at: string;
  occurred_at: string | null;
  contained_at: string | null;
  affected_individuals: number;
  data_categories: string[] | null;
  regions: string[] | null;
  high_risk: boolean;
  notifications: Record<string, string> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToIncident(row: BreachRow): BreachIncident {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity as BreachSeverity,
    status: row.status as BreachStatus,
    discoveredAt: row.discovered_at,
    occurredAt: row.occurred_at,
    containedAt: row.contained_at,
    affectedIndividuals: row.affected_individuals,
    dataCategories: row.data_categories ?? [],
    regions: row.regions ?? [],
    highRisk: row.high_risk,
    notifications: row.notifications ?? {},
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CreateBreachResult = { ok: true; id: string } | { ok: false; error: string };

/** Files a new breach incident for the current user. */
export async function createBreachIncident(input: BreachIncidentInput): Promise<CreateBreachResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("breach_incidents")
    .insert({
      user_id: user.id,
      title: input.title,
      description: input.description,
      severity: input.severity,
      discovered_at: input.discoveredAt,
      occurred_at: input.occurredAt,
      affected_individuals: input.affectedIndividuals,
      data_categories: input.dataCategories,
      regions: input.regions,
      high_risk: input.highRisk,
      notes: input.notes,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Could not record the breach incident." };
  return { ok: true, id: data.id as string };
}

/** Lists the caller's breach incidents (RLS-scoped, newest first). */
export async function listBreachIncidents(limit = 100): Promise<BreachIncident[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("breach_incidents")
    .select("*")
    .order("discovered_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as BreachRow[]).map(rowToIncident);
}

export interface BreachUpdate {
  status?: BreachStatus;
  containedAt?: string | null;
  /** Records (or clears, when `at` is null) the notification for one obligation. */
  notify?: { ruleId: string; at: string | null };
  notes?: string | null;
}

export type UpdateBreachResult = { ok: true } | { ok: false; error: string; notFound?: boolean };

/**
 * Applies a status/notification update to one of the caller's incidents. RLS
 * ensures a caller can only update their own rows. Only a fixed, validated set
 * of fields is mutable.
 */
export async function updateBreachIncident(id: string, update: BreachUpdate): Promise<UpdateBreachResult> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.status !== undefined) {
    if (!BREACH_STATUSES.includes(update.status)) return { ok: false, error: "Invalid status." };
    patch.status = update.status;
  }
  if (update.containedAt !== undefined) patch.contained_at = update.containedAt;
  if (update.notes !== undefined) patch.notes = update.notes === null ? null : String(update.notes).slice(0, TEXT_MAX);

  if (update.notify !== undefined) {
    const { ruleId, at } = update.notify;
    if (!NOTIFICATION_RULES.some((r) => r.id === ruleId)) return { ok: false, error: "Unknown obligation." };
    // Merge the single obligation key atomically in the database (JSONB `||`/`-`)
    // so concurrent updates to different obligations can't clobber each other.
    // RLS scopes the update to the caller's own row.
    const { data, error } = await supabase.rpc("apply_breach_notification", {
      p_incident_id: id,
      p_rule_id: ruleId,
      p_at: at,
    });
    if (error) return { ok: false, error: "Could not update the breach incident." };
    if (!data) return { ok: false, error: "Incident not found.", notFound: true };
  }

  // Apply the scalar-field updates (status/containment/notes). Skip when the
  // only change was a notification merge, which was already applied above.
  const hasScalarUpdate = Object.keys(patch).length > 1;
  if (hasScalarUpdate || update.notify === undefined) {
    const { data, error } = await supabase.from("breach_incidents").update(patch).eq("id", id).select("id");
    if (error) return { ok: false, error: "Could not update the breach incident." };
    // RLS scopes the update to the owner; zero rows means the id is unknown or
    // not the caller's, so surface a not-found rather than a false success.
    if (!data || data.length === 0) return { ok: false, error: "Incident not found.", notFound: true };
  }
  return { ok: true };
}
