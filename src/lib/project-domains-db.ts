// Project domains — server data layer (framework §C12).
//
// The set of domains a project owns / scopes its scanning to. Reads are visible
// to any project member (RLS is_project_member); writes are owner-only. Domain
// values are normalized (lowercased host, no scheme/path) before persisting.

import { createClient } from "@/lib/supabase/server";

export interface ProjectDomain {
  id: string;
  projectId: string;
  domain: string;
  verified: boolean;
  createdAt: string;
}

interface ProjectDomainRow {
  id: string;
  project_id: string;
  domain: string;
  verified: boolean;
  created_at: string;
}

function rowToDomain(row: ProjectDomainRow): ProjectDomain {
  return {
    id: row.id,
    projectId: row.project_id,
    domain: row.domain,
    verified: row.verified,
    createdAt: row.created_at,
  };
}

/** Reduces free-form input ("https://Www.Example.com:8080/x?y=1") to a bare host ("www.example.com"). */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/[/?#].*$/, ""); // drop path, query, and fragment
  value = value.replace(/:\d+$/, ""); // drop an explicit port
  return value;
}

export async function listProjectDomains(projectId: string): Promise<ProjectDomain[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_domains")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as ProjectDomainRow[]).map(rowToDomain);
}

export async function addProjectDomain(
  projectId: string,
  rawDomain: string
): Promise<{ ok: true; domain: ProjectDomain } | { ok: false; error: string }> {
  const domain = normalizeDomain(rawDomain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return { ok: false, error: "Enter a valid domain (e.g. example.com)." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("project_domains")
    .insert({ project_id: projectId, domain })
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.code === "23505" ? "That domain is already added." : "Could not add domain." };
  }
  return { ok: true, domain: rowToDomain(data as ProjectDomainRow) };
}

export async function removeProjectDomain(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("project_domains").delete().eq("id", id);
  return !error;
}
