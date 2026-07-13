// Consent-record service layer — server-side proof-of-consent audit trail.
//
// The generated cookie banner records a visitor's choice on their device, but
// GDPR Art. 7(1) requires the controller to be able to *demonstrate* consent.
// This module validates and persists each decision to the append-only
// `consent_records` ledger (written via the service role from the public
// endpoint) and lets the project owner read their site's ledger (RLS-scoped).

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ConsentAction = "accept_all" | "reject_non_essential" | "custom" | "withdraw" | "do_not_sell";

export type ConsentModel = "opt-in" | "opt-out" | "notice";

export const CONSENT_ACTIONS: readonly ConsentAction[] = [
  "accept_all",
  "reject_non_essential",
  "custom",
  "withdraw",
  "do_not_sell",
];

export const CONSENT_MODELS: readonly ConsentModel[] = ["opt-in", "opt-out", "notice"];

/**
 * Categories a banner may gate. Kept in sync with the canonical `ConsentCategory`
 * type in `@/lib/tools/data` so the validator only accepts categories the banner
 * can actually produce.
 */
export const CONSENT_CATEGORIES: readonly string[] = ["essential", "analytics", "advertising", "functional"];

export interface ConsentRecord {
  id: string;
  projectId: string;
  deploymentId: string | null;
  subjectRef: string;
  action: ConsentAction;
  categories: string[];
  consentModel: ConsentModel;
  policyVersion: string | null;
  region: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** A normalized, validated payload ready to persist. */
export interface NormalizedConsent {
  projectId: string;
  /** Public deployment id embedded on the merchant site, if this is managed. */
  deploymentId: string | null;
  subjectRef: string;
  action: ConsentAction;
  categories: string[];
  consentModel: ConsentModel;
  policyVersion: string | null;
  region: string | null;
  userAgent: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUBJECT_REF_MAX = 128;
const POLICY_VERSION_MAX = 64;
const REGION_MAX = 32;
const USER_AGENT_MAX = 512;
const MAX_CATEGORIES = 32;

function trimOrNull(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, max);
}

export type NormalizeResult = { ok: true; value: NormalizedConsent } | { ok: false; error: string };

/**
 * Validates and normalizes an untrusted consent payload from the public
 * endpoint. Rejects anything malformed rather than persisting junk into the
 * audit trail; bounds all free-text fields to keep the ledger tidy.
 */
export function normalizeConsent(raw: unknown): NormalizeResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "A consent payload object is required." };
  }
  const body = raw as Record<string, unknown>;

  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!UUID_RE.test(projectId)) {
    return { ok: false, error: "A valid projectId is required." };
  }

  const subjectRef = typeof body.subjectRef === "string" ? body.subjectRef.trim() : "";
  if (!subjectRef || subjectRef.length > SUBJECT_REF_MAX) {
    return { ok: false, error: "A subjectRef between 1 and 128 characters is required." };
  }
  if (
    body.deploymentId !== undefined &&
    (typeof body.deploymentId !== "string" || !UUID_RE.test(body.deploymentId.trim()))
  ) {
    return { ok: false, error: "deploymentId must be a valid UUID when supplied." };
  }
  const deploymentId = typeof body.deploymentId === "string" ? body.deploymentId.trim() : null;

  const action = body.action;
  if (typeof action !== "string" || !CONSENT_ACTIONS.includes(action as ConsentAction)) {
    return { ok: false, error: "A valid action is required." };
  }

  let categories: string[] = [];
  if (body.categories !== undefined) {
    if (!Array.isArray(body.categories)) {
      return { ok: false, error: "categories must be an array." };
    }
    categories = Array.from(
      new Set(
        body.categories
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim().toLowerCase())
          .filter((c) => CONSENT_CATEGORIES.includes(c))
      )
    ).slice(0, MAX_CATEGORIES);
  }

  let consentModel: ConsentModel = "opt-in";
  if (body.consentModel !== undefined) {
    if (typeof body.consentModel !== "string" || !CONSENT_MODELS.includes(body.consentModel as ConsentModel)) {
      return { ok: false, error: "consentModel must be one of opt-in, opt-out, notice." };
    }
    consentModel = body.consentModel as ConsentModel;
  }

  return {
    ok: true,
    value: {
      projectId,
      deploymentId,
      subjectRef: subjectRef.slice(0, SUBJECT_REF_MAX),
      action: action as ConsentAction,
      categories,
      consentModel,
      policyVersion: trimOrNull(body.policyVersion as string | null | undefined, POLICY_VERSION_MAX),
      region: trimOrNull(body.region as string | null | undefined, REGION_MAX),
      userAgent: trimOrNull(body.userAgent as string | null | undefined, USER_AGENT_MAX),
    },
  };
}

export type RecordConsentResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Persists a validated consent decision to the append-only ledger. The project
 * must exist (guards the public endpoint against writes for unknown ids). Uses
 * the service-role client because the caller is an unauthenticated site visitor.
 *
 * Accepts only a `NormalizedConsent` (the output of `normalizeConsent`) so the
 * validated-input requirement is type-enforced — callers cannot pass raw,
 * unbounded values into the ledger.
 */
export async function recordConsent(
  input: NormalizedConsent,
  requestOrigin?: string | null
): Promise<RecordConsentResult> {
  const admin = createAdminClient();

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (projectError) return { ok: false, error: "Could not verify the project." };
  if (!project) return { ok: false, error: "Unknown project." };

  let deploymentId: string | null = null;
  if (input.deploymentId) {
    const { data: deployment, error: deploymentError } = await admin
      .from("consent_deployments")
      .select("id, site_origin, status")
      .eq("public_id", input.deploymentId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (deploymentError || !deployment || deployment.status === "paused") {
      return { ok: false, error: "Unknown or inactive consent deployment." };
    }
    // Browsers attach Origin to cross-origin fetches/beacons. When it is
    // available, bind public writes to the configured site; allowing a missing
    // Origin preserves sendBeacon compatibility in restrictive user agents.
    if (requestOrigin && requestOrigin !== deployment.site_origin) {
      return { ok: false, error: "Consent deployment origin does not match." };
    }
    deploymentId = deployment.id as string;
  }

  const { data, error } = await admin
    .from("consent_records")
    .insert({
      project_id: input.projectId,
      deployment_id: deploymentId,
      subject_ref: input.subjectRef,
      action: input.action,
      categories: input.categories,
      consent_model: input.consentModel,
      policy_version: input.policyVersion,
      region: input.region,
      user_agent: input.userAgent,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Could not record consent." };
  return { ok: true, id: data.id as string };
}

interface ConsentRow {
  id: string;
  project_id: string;
  deployment_id: string | null;
  subject_ref: string;
  action: string;
  categories: string[] | null;
  consent_model: string;
  policy_version: string | null;
  region: string | null;
  user_agent: string | null;
  created_at: string;
}

function rowToRecord(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    deploymentId: row.deployment_id,
    subjectRef: row.subject_ref,
    action: row.action as ConsentAction,
    categories: row.categories ?? [],
    consentModel: row.consent_model as ConsentModel,
    policyVersion: row.policy_version,
    region: row.region,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

/**
 * Lists the most recent consent records for a project the caller owns. Uses the
 * RLS-scoped server client, so a caller only ever sees their own project's rows.
 */
export async function listConsentRecords(projectId: string, limit = 200): Promise<ConsentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consent_records")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as ConsentRow[]).map(rowToRecord);
}

export interface ConsentSummary {
  total: number;
  byAction: Record<ConsentAction, number>;
}

function emptyByAction(): Record<ConsentAction, number> {
  return {
    accept_all: 0,
    reject_non_essential: 0,
    custom: 0,
    withdraw: 0,
    do_not_sell: 0,
  } satisfies Record<ConsentAction, number>;
}

/**
 * Returns an accurate per-action summary over the project's *entire* ledger
 * (not just a display page). Runs one exact head-count query per action plus a
 * total, so the dashboard badges reflect all history — e.g. an older withdrawal
 * is never hidden behind the recent-N window. RLS-scoped.
 */
export async function getConsentSummary(projectId: string): Promise<ConsentSummary> {
  const supabase = await createClient();
  const byAction = emptyByAction();

  const [{ count: total }, ...perAction] = await Promise.all([
    supabase.from("consent_records").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    ...CONSENT_ACTIONS.map((action) =>
      supabase
        .from("consent_records")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("action", action)
    ),
  ]);

  CONSENT_ACTIONS.forEach((action, i) => {
    byAction[action] = perAction[i].count ?? 0;
  });

  return { total: total ?? 0, byAction };
}

/** Aggregates a set of records into per-action counts for a dashboard summary. */
export function summarizeConsent(records: ConsentRecord[]): ConsentSummary {
  const byAction = emptyByAction();
  for (const r of records) {
    // Guard against an action added to the DB CHECK constraint before the
    // TypeScript union — count only known actions rather than producing NaN.
    if (r.action in byAction) byAction[r.action] += 1;
  }
  return { total: records.length, byAction };
}
