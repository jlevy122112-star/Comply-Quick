import { createClient } from "@/lib/supabase/server";
import { fetchPageHtml } from "@/lib/scanner/crawler";
import { recordAuditLog } from "@/lib/audit-log";
import { PIXEL_VENDORS, REGION_RULES, type TargetRegion, type TrackingPixel } from "@/lib/tools/data";

export type DeploymentStatus = "ready" | "verified" | "paused";
export type EnforcementMode = "automatic" | "event_only";

export interface ConsentDeployment {
  id: string;
  publicId: string;
  projectId: string;
  siteUrl: string;
  siteOrigin: string;
  privacyPolicyUrl: string;
  policyVersion: string;
  regions: TargetRegion[];
  pixels: TrackingPixel[];
  enforcementMode: EnforcementMode;
  status: DeploymentStatus;
  lastVerifiedAt: string | null;
  verificationDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsentDeploymentInput {
  projectId: string;
  siteUrl: string;
  privacyPolicyUrl: string;
  policyVersion: string;
  regions: TargetRegion[];
  pixels: TrackingPixel[];
  enforcementMode?: EnforcementMode;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POLICY_VERSION_MAX = 64;

function validUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function mapRow(row: Record<string, unknown>): ConsentDeployment {
  return {
    id: row.id as string,
    publicId: row.public_id as string,
    projectId: row.project_id as string,
    siteUrl: row.site_url as string,
    siteOrigin: row.site_origin as string,
    privacyPolicyUrl: row.privacy_policy_url as string,
    policyVersion: row.policy_version as string,
    regions: (row.regions as TargetRegion[]) ?? [],
    pixels: (row.pixels as TrackingPixel[]) ?? [],
    enforcementMode: row.enforcement_mode as EnforcementMode,
    status: row.status as DeploymentStatus,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
    verificationDetail: (row.verification_detail as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function normalizeConsentDeployment(raw: unknown): Result<CreateConsentDeploymentInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "A deployment payload is required." };
  const value = raw as Record<string, unknown>;
  const projectId = typeof value.projectId === "string" ? value.projectId.trim() : "";
  if (!UUID_RE.test(projectId)) return { ok: false, error: "A valid project is required." };

  const siteUrl = typeof value.siteUrl === "string" ? value.siteUrl.trim() : "";
  if (!validUrl(siteUrl)) return { ok: false, error: "Enter a valid http(s) website URL without credentials." };
  const privacyPolicyUrl = typeof value.privacyPolicyUrl === "string" ? value.privacyPolicyUrl.trim() : "";
  if (!privacyPolicyUrl || (!validUrl(privacyPolicyUrl) && !privacyPolicyUrl.startsWith("/"))) {
    return { ok: false, error: "Enter an absolute http(s) or site-relative privacy policy URL." };
  }

  const policyVersion = typeof value.policyVersion === "string" ? value.policyVersion.trim() : "";
  if (!policyVersion || policyVersion.length > POLICY_VERSION_MAX) {
    return { ok: false, error: `Policy version must be between 1 and ${POLICY_VERSION_MAX} characters.` };
  }
  const regions = Array.isArray(value.regions) ? Array.from(new Set(value.regions)) : [];
  if (
    !regions.length ||
    !regions.every((region): region is TargetRegion => typeof region === "string" && region in REGION_RULES)
  ) {
    return { ok: false, error: "Select at least one valid jurisdiction." };
  }
  const pixels = Array.isArray(value.pixels) ? Array.from(new Set(value.pixels)) : [];
  if (!pixels.every((pixel): pixel is TrackingPixel => typeof pixel === "string" && pixel in PIXEL_VENDORS)) {
    return { ok: false, error: "One or more tracking vendors are invalid." };
  }
  const enforcementMode = value.enforcementMode === "event_only" ? "event_only" : "automatic";
  return { ok: true, value: { projectId, siteUrl, privacyPolicyUrl, policyVersion, regions, pixels, enforcementMode } };
}

export async function createConsentDeployment(input: CreateConsentDeploymentInput): Promise<Result<ConsentDeployment>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to create a managed deployment." };

  const site = validUrl(input.siteUrl);
  if (!site) return { ok: false, error: "Enter a valid website URL." };
  const { data, error } = await supabase
    .from("consent_deployments")
    .insert({
      project_id: input.projectId,
      site_url: site.toString(),
      site_origin: site.origin,
      privacy_policy_url: input.privacyPolicyUrl,
      policy_version: input.policyVersion,
      regions: input.regions,
      pixels: input.pixels,
      enforcement_mode: input.enforcementMode ?? "automatic",
    })
    .select("*")
    .single();
  if (error || !data)
    return { ok: false, error: "Could not save this deployment. Confirm that you own the selected project." };

  const deployment = mapRow(data as Record<string, unknown>);
  await recordAuditLog({
    action: "consent.deployment_created",
    entityType: "consent_deployment",
    entityId: deployment.id,
    projectId: deployment.projectId,
    summary: `Created managed consent deployment for ${deployment.siteOrigin}.`,
    metadata: { enforcementMode: deployment.enforcementMode, policyVersion: deployment.policyVersion },
  });
  return { ok: true, value: deployment };
}

export async function listConsentDeployments(projectId?: string): Promise<ConsentDeployment[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase.from("consent_deployments").select("*").order("updated_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => mapRow(row as Record<string, unknown>));
}

export async function verifyConsentDeployment(id: string): Promise<Result<ConsentDeployment>> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid deployment." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to verify a deployment." };
  const { data, error } = await supabase.from("consent_deployments").select("*").eq("id", id).maybeSingle();
  if (error || !data) return { ok: false, error: "Deployment not found." };
  const deployment = mapRow(data as Record<string, unknown>);

  let found = false;
  let detail: string;
  try {
    const page = await fetchPageHtml(deployment.siteUrl);
    found =
      page.status >= 200 && page.status < 400 && page.html.includes(`data-cq-deployment="${deployment.publicId}"`);
    detail = found
      ? "Comply-Quick deployment marker detected on the live page."
      : "Marker not found. Publish the generated snippet, then verify again.";
  } catch {
    detail = "Could not reach the site safely. Confirm that the URL is public and try again.";
  }
  const verifiedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("consent_deployments")
    .update({
      status: found ? "verified" : "ready",
      last_verified_at: verifiedAt,
      verification_detail: detail,
      updated_at: verifiedAt,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (updateError || !updated) return { ok: false, error: "Could not save the verification result." };
  const result = mapRow(updated as Record<string, unknown>);
  await recordAuditLog({
    action: found ? "consent.deployment_verified" : "consent.deployment_verification_failed",
    entityType: "consent_deployment",
    entityId: result.id,
    projectId: result.projectId,
    summary: found
      ? `Verified consent deployment on ${result.siteOrigin}.`
      : `Consent deployment marker was not found on ${result.siteOrigin}.`,
  });
  return { ok: true, value: result };
}
