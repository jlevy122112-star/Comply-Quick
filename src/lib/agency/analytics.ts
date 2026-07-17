import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAggregateScore, type DbProject } from "@/lib/projects-db";
import { canUseAgencyPortal, getOrCreateAgency, type AgencyClient } from "./service";
import { ForbiddenError } from "@/services/errors";

export type PortfolioRisk = "good" | "warning" | "critical" | "none";

export interface AgencyClientAnalytics {
  clientId: string;
  organizationId: string | null;
  name: string;
  status: AgencyClient["status"];
  provisioned: boolean;
  score: number | null;
  projects: number;
  openFindings: number;
  risk: PortfolioRisk;
  atRisk: boolean;
}

export interface AgencyPortfolioSummary {
  clientCount: number;
  averageScore: number;
  lowestScore: number;
  totalOpenFindings: number;
  clientsAtRisk: number;
}

export interface AgencyPortfolioAnalytics {
  clients: AgencyClientAnalytics[];
  summary: AgencyPortfolioSummary;
}

const AT_RISK_THRESHOLD = 70;
const CRITICAL_THRESHOLD = 50;

export function portfolioRisk(score: number | null): PortfolioRisk {
  if (score === null) return "none";
  if (score < CRITICAL_THRESHOLD) return "critical";
  if (score < AT_RISK_THRESHOLD) return "warning";
  return "good";
}

export function summarizePortfolio(clients: AgencyClientAnalytics[]): AgencyPortfolioSummary {
  const activeClients = clients.filter((client) => client.status !== "archived");
  const healthClients = activeClients.filter((client) => client.score !== null);
  if (healthClients.length === 0) {
    return {
      clientCount: clients.length,
      averageScore: 0,
      lowestScore: 0,
      totalOpenFindings: activeClients.reduce((sum, client) => sum + client.openFindings, 0),
      clientsAtRisk: 0,
    };
  }

  const totalScore = healthClients.reduce((sum, client) => sum + (client.score as number), 0);
  return {
    clientCount: clients.length,
    averageScore: Math.round(totalScore / healthClients.length),
    lowestScore: Math.min(...healthClients.map((client) => client.score as number)),
    totalOpenFindings: activeClients.reduce((sum, client) => sum + client.openFindings, 0),
    clientsAtRisk: healthClients.filter((client) => client.atRisk).length,
  };
}

function projectScore(rows: Array<{ compliance_score: unknown }>): number | null {
  const projects = rows.map((row) => ({ complianceScore: row.compliance_score }) as DbProject);
  return getAggregateScore(projects)?.overall ?? null;
}

async function countOpenFindings(
  admin: ReturnType<typeof createAdminClient>,
  filter: { organizationId?: string; projectIds?: string[] }
): Promise<number> {
  let query = admin.from("findings").select("id", { count: "exact", head: true }).neq("status", "resolved");
  if (filter.organizationId) query = query.eq("organization_id", filter.organizationId);
  if (filter.projectIds && filter.projectIds.length > 0) query = query.in("project_id", filter.projectIds);
  if (filter.projectIds && filter.projectIds.length === 0) return 0;
  const { count } = await query;
  return count ?? 0;
}

async function aggregateClient(
  admin: ReturnType<typeof createAdminClient>,
  agencyOwnerId: string,
  client: AgencyClient
): Promise<AgencyClientAnalytics> {
  let projectRows: Array<{ id: string; compliance_score: unknown }> = [];
  let openFindings = 0;

  if (client.organizationId) {
    const { data } = await admin
      .from("projects")
      .select("id, compliance_score")
      .eq("organization_id", client.organizationId);
    projectRows = (data ?? []) as typeof projectRows;
    openFindings = await countOpenFindings(admin, { organizationId: client.organizationId });
  } else {
    const { data } = await admin
      .from("projects")
      .select("id, compliance_score")
      .eq("user_id", agencyOwnerId)
      .eq("client_id", client.id);
    projectRows = (data ?? []) as typeof projectRows;
    openFindings = await countOpenFindings(admin, {
      projectIds: projectRows.map((project) => project.id),
    });
  }

  const score = projectScore(projectRows);
  return {
    clientId: client.id,
    organizationId: client.organizationId,
    name: client.name,
    status: client.status,
    provisioned: Boolean(client.organizationId),
    score,
    projects: projectRows.length,
    openFindings,
    risk: portfolioRisk(score),
    atRisk: score !== null && score < AT_RISK_THRESHOLD,
  };
}

export async function getAgencyPortfolioAnalytics(): Promise<AgencyPortfolioAnalytics> {
  if (!(await canUseAgencyPortal())) {
    throw new ForbiddenError("The client portfolio analytics view is available on the Agency and Enterprise plans.");
  }

  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("agency_clients")
    .select("id, agency_id, name, contact_email, website_url, notes, status, organization_id, created_at")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });
  if (error) return { clients: [], summary: summarizePortfolio([]) };

  const admin = createAdminClient();
  const agencyClients = (clients ?? []).map((row) => ({
    id: row.id as string,
    agencyId: row.agency_id as string,
    name: row.name as string,
    contactEmail: (row.contact_email as string | null) ?? null,
    websiteUrl: (row.website_url as string | null) ?? null,
    notes: (row.notes as string) ?? "",
    status: (row.status as AgencyClient["status"]) ?? "active",
    organizationId: (row.organization_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
  const analytics = await Promise.all(agencyClients.map((client) => aggregateClient(admin, agency.ownerId, client)));
  return { clients: analytics, summary: summarizePortfolio(analytics) };
}
