// Integrations — server data layer (framework §C12).
//
// User-owned outbound webhook URLs that receive Comply-Quick event
// notifications. All rows are owner-scoped by RLS.

import { createClient } from "@/lib/supabase/server";

export type IntegrationKind = "webhook";

export interface Integration {
  id: string;
  kind: IntegrationKind;
  name: string;
  targetUrl: string;
  active: boolean;
  createdAt: string;
}

interface IntegrationRow {
  id: string;
  kind: IntegrationKind;
  name: string;
  target_url: string;
  active: boolean;
  created_at: string;
}

function rowToIntegration(row: IntegrationRow): Integration {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    targetUrl: row.target_url,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function listIntegrations(): Promise<Integration[]> {
  const supabase = await createClient();
  // Filter to supported kinds so any legacy row (e.g. removed `slack`) that
  // predates the cleanup migration never leaks a value outside IntegrationKind.
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("kind", "webhook")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as IntegrationRow[]).map(rowToIntegration);
}

export async function addIntegration(input: {
  kind: IntegrationKind;
  name: string;
  targetUrl: string;
}): Promise<{ ok: true; integration: Integration } | { ok: false; error: string }> {
  const name = input.name.trim();
  const targetUrl = input.targetUrl.trim();
  if (name.length < 1) return { ok: false, error: "Give the integration a name." };
  if (!/^https:\/\/.+/.test(targetUrl)) return { ok: false, error: "Target URL must be an https:// endpoint." };
  if (input.kind !== "webhook") return { ok: false, error: "Unsupported integration type." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("integrations")
    .insert({ user_id: user.id, kind: input.kind, name, target_url: targetUrl })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "Could not save integration." };
  return { ok: true, integration: rowToIntegration(data as IntegrationRow) };
}

export async function setIntegrationActive(id: string, active: boolean): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("integrations")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteIntegration(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("integrations").delete().eq("id", id);
  return !error;
}
