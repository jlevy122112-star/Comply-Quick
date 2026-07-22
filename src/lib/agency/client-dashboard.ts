// Per-client enterprise dashboard — aggregated view of a single managed client.
//
// Pulls together monitors, projects, open findings, unresolved compliance alerts,
// and the current compliance package (document_versions + tracked regulations)
// so an agency/enterprise operator can click a client and see status at a glance.

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClient, type AgencyClient } from "./service";

export interface ClientMonitor {
  id: string;
  label: string;
  url: string;
  active: boolean;
  lastScannedAt: string | null;
  lastScore: number | null;
}

export interface ClientProject {
  id: string;
  name: string;
  framework: string;
  complianceScore: number | null;
  status: string;
}

export interface ClientFinding {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  status: string;
  category: string;
  recommendation: string;
}

export interface ClientAlert {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  read: boolean;
  resolved: boolean;
  createdAt: string;
}

export interface ClientDocument {
  id: string;
  projectId: string;
  projectName: string;
  regulationId: string | null;
  regulationName: string | null;
  status: string;
  summary: string;
  updatedAt: string;
}

export interface ClientDashboard {
  client: AgencyClient;
  monitors: ClientMonitor[];
  projects: ClientProject[];
  findings: ClientFinding[];
  alerts: ClientAlert[];
  documents: ClientDocument[];
  stats: {
    monitors: number;
    projects: number;
    openFindings: number;
    openAlerts: number;
  };
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function extractOverallScore(score: unknown): number | null {
  if (score === null || score === undefined) return null;
  if (typeof score === "number") return score;
  if (typeof score === "object" && score !== null) {
    const overall = (score as Record<string, unknown>).overall;
    if (typeof overall === "number") return overall;
  }
  return null;
}

export const getClientDashboard = cache(async (clientId: string): Promise<ClientDashboard> => {
  const client = await getClient(clientId);
  if (!client) throw new Error("Client not found.");

  const admin = createAdminClient();

  // Resolve the owner of the agency so all client-tagged rows are scoped
  // to that user. This is the same pattern used by portfolio analytics.
  const { data: agency } = await admin.from("agencies").select("owner_id").eq("id", client.agencyId).single();
  const ownerId = (agency as { owner_id?: string } | null)?.owner_id;
  if (!ownerId) throw new Error("Could not resolve agency owner.");

  const { data: monitors } = await admin
    .from("scan_monitors")
    .select("id, label, url, active, last_scanned_at, last_score")
    .eq("user_id", ownerId)
    .eq("client_id", clientId);

  const { data: projects } = await admin
    .from("projects")
    .select("id, name, framework, compliance_score, status")
    .eq("user_id", ownerId)
    .eq("client_id", clientId);

  const projectIds = asArray(projects).map((row) => row.id as string);
  const monitorIds = asArray(monitors).map((row) => row.id as string);

  // Collect scan ids produced by the client's monitors so we can surface
  // findings tied to those scans.
  let scanIds: string[] = [];
  if (monitorIds.length > 0) {
    const { data: scans } = await admin
      .from("scans")
      .select("id")
      .eq("user_id", ownerId)
      .in("monitor_id", monitorIds);
    scanIds = asArray(scans).map((row) => row.id as string);
  }

  // Fetch unresolved findings tied to the client's projects or scans.
  let findings: ClientFinding[] = [];
  const findingFilters: string[] = [];
  if (projectIds.length > 0) findingFilters.push(`project_id.in.(${projectIds.join(",")})`);
  if (scanIds.length > 0) findingFilters.push(`scan_id.in.(${scanIds.join(",")})`);

  if (findingFilters.length > 0) {
    const { data: findingsRows } = await admin
      .from("findings")
      .select("id, title, severity, status, category, recommendation")
      .eq("user_id", ownerId)
      .neq("status", "resolved")
      .or(findingFilters.join(","));
    findings = asArray(findingsRows).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      severity: row.severity as ClientFinding["severity"],
      status: row.status as string,
      category: row.category as string,
      recommendation: row.recommendation as string,
    }));
  }

  // Fetch unresolved compliance alerts for the client's monitors.
  let alerts: ClientAlert[] = [];
  if (monitorIds.length > 0) {
    const { data: alertsRows } = await admin
      .from("compliance_alerts")
      .select("id, type, severity, title, body, read, resolved, created_at")
      .eq("user_id", ownerId)
      .eq("resolved", false)
      .in("monitor_id", monitorIds)
      .order("created_at", { ascending: false })
      .limit(50);
    alerts = asArray(alertsRows).map((row) => ({
      id: row.id as string,
      type: row.type as string,
      severity: row.severity as ClientAlert["severity"],
      title: row.title as string,
      body: row.body as string,
      read: row.read as boolean,
      resolved: row.resolved as boolean,
      createdAt: row.created_at as string,
    }));
  }

  // Build a regulation lookup so document versions carry readable names.
  const { data: regulations } = await admin.from("regulations").select("id, name");
  const regulationNames = new Map<string, string>();
  for (const row of asArray(regulations)) {
    if (typeof row.id === "string" && typeof row.name === "string") {
      regulationNames.set(row.id, row.name);
    }
  }

  const projectNameById = new Map<string, string>();
  for (const row of asArray(projects)) {
    projectNameById.set(row.id as string, row.name as string);
  }

  // Fetch the current compliance package versions for the client's projects.
  let documents: ClientDocument[] = [];
  if (projectIds.length > 0) {
    const { data: docs } = await admin
      .from("document_versions")
      .select("id, project_id, regulation_id, status, summary, updated_at")
      .eq("user_id", ownerId)
      .in("project_id", projectIds)
      .order("updated_at", { ascending: false })
      .limit(100);
    documents = asArray(docs).map((row) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      projectName: projectNameById.get(row.project_id as string) ?? "Unknown project",
      regulationId: (row.regulation_id as string | null) ?? null,
      regulationName: row.regulation_id ? (regulationNames.get(row.regulation_id as string) ?? null) : null,
      status: row.status as string,
      summary: row.summary as string,
      updatedAt: row.updated_at as string,
    }));
  }

  const mappedMonitors: ClientMonitor[] = asArray(monitors).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    url: row.url as string,
    active: row.active as boolean,
    lastScannedAt: (row.last_scanned_at as string | null) ?? null,
    lastScore: (row.last_score as number | null) ?? null,
  }));

  const mappedProjects: ClientProject[] = asArray(projects).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    framework: row.framework as string,
    complianceScore: extractOverallScore(row.compliance_score),
    status: row.status as string,
  }));

  return {
    client,
    monitors: mappedMonitors,
    projects: mappedProjects,
    findings,
    alerts,
    documents,
    stats: {
      monitors: mappedMonitors.length,
      projects: mappedProjects.length,
      openFindings: findings.length,
      openAlerts: alerts.length,
    },
  };
});

/** Cross-client unresolved alerts for the agency owner's workspace. */
export interface AgencyAlert extends ClientAlert {
  clientId: string | null;
  clientName: string | null;
  monitorId: string | null;
}

export const getAgencyAlerts = cache(async (): Promise<AgencyAlert[]> => {
  const { getOrCreateAgency } = await import("./service");
  const agency = await getOrCreateAgency();
  const admin = createAdminClient();

  const { data: alerts } = await admin
    .from("compliance_alerts")
    .select("id, type, severity, title, body, read, resolved, created_at, monitor_id")
    .eq("user_id", agency.ownerId)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(100);

  const monitorIds = asArray(alerts)
    .map((row) => row.monitor_id as string | null)
    .filter(Boolean) as string[];

  const monitorMap = new Map<string, { clientId: string | null; url: string; label: string }>();
  if (monitorIds.length > 0) {
    const { data: monitors } = await admin
      .from("scan_monitors")
      .select("id, client_id, url, label")
      .eq("user_id", agency.ownerId)
      .in("id", monitorIds);
    for (const row of asArray(monitors)) {
      monitorMap.set(row.id as string, {
        clientId: (row.client_id as string | null) ?? null,
        url: row.url as string,
        label: (row.label as string) || (row.url as string),
      });
    }
  }

  const clientIds = [...new Set([...monitorMap.values()].map((m) => m.clientId).filter(Boolean))] as string[];
  const clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await admin.from("agency_clients").select("id, name").in("id", clientIds);
    for (const row of asArray(clients)) {
      clientNames.set(row.id as string, row.name as string);
    }
  }

  return asArray(alerts).map((row) => {
    const monitor = row.monitor_id ? monitorMap.get(row.monitor_id as string) : null;
    const clientId = monitor?.clientId ?? null;
    return {
      id: row.id as string,
      type: row.type as string,
      severity: row.severity as AgencyAlert["severity"],
      title: row.title as string,
      body: row.body as string,
      read: row.read as boolean,
      resolved: row.resolved as boolean,
      createdAt: row.created_at as string,
      monitorId: (row.monitor_id as string | null) ?? null,
      clientId,
      clientName: clientId ? (clientNames.get(clientId) ?? null) : null,
    };
  });
});
