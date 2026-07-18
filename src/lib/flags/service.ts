import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMyOrgRole } from "@/lib/organizations-db";
import { FLAG_REGISTRY, type FeatureFlagKey } from "./registry";

export type FlagValueSource = "user" | "organization" | "env" | "default";

export interface ResolvedFlag {
  key: FeatureFlagKey;
  enabled: boolean;
  source: FlagValueSource;
}

export interface FeatureFlagAuditEntry {
  id: string;
  flagKey: FeatureFlagKey;
  previousEnabled: boolean | null;
  newEnabled: boolean;
  actorUserId: string;
  createdAt: string;
}

function readBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value || value.trim() === "") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  return defaultValue;
}

function isFlagKey(key: string): key is FeatureFlagKey {
  return key in FLAG_REGISTRY;
}

function fallback(key: FeatureFlagKey): ResolvedFlag {
  const definition = FLAG_REGISTRY[key];
  const envValue = process.env[definition.envVar];
  const enabled = readBooleanEnv(envValue, definition.defaultValue);
  return { key, enabled, source: envValue?.trim() ? "env" : "default" };
}

async function resolveFlagForOrganization(
  key: FeatureFlagKey,
  organizationId: string,
  userId: string | null
): Promise<ResolvedFlag> {
  const supabase = await createClient();
  const query = supabase
    .from("organization_feature_flags")
    .select("enabled, user_id")
    .eq("organization_id", organizationId)
    .eq("flag_key", key);
  const { data } = await query;
  const rows = (data ?? []) as Array<{ enabled: boolean; user_id: string | null }>;
  const userOverride = userId ? rows.find((row) => row.user_id === userId) : undefined;
  if (userOverride) return { key, enabled: userOverride.enabled, source: "user" };
  const organizationOverride = rows.find((row) => row.user_id === null);
  if (organizationOverride) return { key, enabled: organizationOverride.enabled, source: "organization" };
  return fallback(key);
}

export const resolveFlag = cache(async (key: FeatureFlagKey): Promise<boolean> => {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) return fallback(key).enabled;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (await resolveFlagForOrganization(key, organizationId, user?.id ?? null)).enabled;
});

export const listOrgFlags = cache(async (): Promise<ResolvedFlag[]> => {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) return (Object.keys(FLAG_REGISTRY) as FeatureFlagKey[]).map(fallback);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Promise.all(
    (Object.keys(FLAG_REGISTRY) as FeatureFlagKey[]).map((key) =>
      resolveFlagForOrganization(key, organizationId, user?.id ?? null)
    )
  );
});

export async function setOrgFlag(
  key: FeatureFlagKey,
  enabled: boolean,
  options: { userId?: string } = {}
): Promise<ResolvedFlag> {
  if (!isFlagKey(key)) throw new Error("Unknown feature flag.");
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) throw new Error("No active organization.");
  const role = await getMyOrgRole(organizationId);
  if (!role || !["owner", "admin"].includes(role))
    throw new Error("Only organization admins can manage feature flags.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const userId = options.userId ?? null;
  let existingQuery = supabase
    .from("organization_feature_flags")
    .select("id, enabled")
    .eq("organization_id", organizationId)
    .eq("flag_key", key);
  existingQuery = userId ? existingQuery.eq("user_id", userId) : existingQuery.is("user_id", null);
  const { data: existing } = await existingQuery.maybeSingle();
  const previousEnabled = (existing as { enabled: boolean } | null)?.enabled ?? null;
  let error;
  if (existing) {
    ({ error } = await supabase
      .from("organization_feature_flags")
      .update({ enabled, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id));
  } else {
    ({ error } = await supabase.from("organization_feature_flags").insert({
      organization_id: organizationId,
      flag_key: key,
      user_id: userId,
      enabled,
      updated_by: user.id,
    }));
  }
  if (error) throw new Error(error.message);
  const { error: auditError } = await supabase.from("feature_flag_audit").insert({
    organization_id: organizationId,
    flag_key: key,
    previous_enabled: previousEnabled,
    new_enabled: enabled,
    actor_user_id: user.id,
  });
  if (auditError) throw new Error(auditError.message);
  return { key, enabled, source: userId ? "user" : "organization" };
}

export async function listFlagAudit(limit = 20): Promise<FeatureFlagAuditEntry[]> {
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("feature_flag_audit")
    .select("id, flag_key, previous_enabled, new_enabled, actor_user_id, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => isFlagKey(row.flag_key as string))
    .map((row) => ({
      id: row.id as string,
      flagKey: row.flag_key as FeatureFlagKey,
      previousEnabled: row.previous_enabled as boolean | null,
      newEnabled: row.new_enabled as boolean,
      actorUserId: row.actor_user_id as string,
      createdAt: row.created_at as string,
    }));
}
