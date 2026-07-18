import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  clients: [
    {
      id: "client-a1",
      agency_id: "agency-a",
      name: "Alpha",
      contact_email: null,
      website_url: null,
      notes: "",
      status: "active",
      organization_id: "org-a1",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "client-a2",
      agency_id: "agency-a",
      name: "Beta",
      contact_email: null,
      website_url: null,
      notes: "",
      status: "active",
      organization_id: null,
      created_at: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "client-b1",
      agency_id: "agency-b",
      name: "Other Agency",
      contact_email: null,
      website_url: null,
      notes: "",
      status: "active",
      organization_id: "org-b1",
      created_at: "2026-01-03T00:00:00.000Z",
    },
    {
      id: "client-a3",
      agency_id: "agency-a",
      name: "Gamma",
      contact_email: null,
      website_url: null,
      notes: "",
      status: "active",
      organization_id: null,
      created_at: "2026-01-04T00:00:00.000Z",
    },
    {
      id: "client-a4",
      agency_id: "agency-a",
      name: "Archived",
      contact_email: null,
      website_url: null,
      notes: "",
      status: "archived",
      organization_id: "org-archived",
      created_at: "2026-01-05T00:00:00.000Z",
    },
  ],
  projects: [
    {
      id: "project-a1",
      organization_id: "org-a1",
      user_id: "owner-a",
      client_id: null,
      compliance_score: { overall: 80 },
    },
    {
      id: "project-b2",
      organization_id: null,
      user_id: "owner-a",
      client_id: "client-a2",
      compliance_score: { overall: 60 },
    },
    {
      id: "project-b1",
      organization_id: "org-b1",
      user_id: "owner-b",
      client_id: null,
      compliance_score: { overall: 10 },
    },
    {
      id: "project-archived",
      organization_id: "org-archived",
      user_id: "owner-a",
      client_id: null,
      compliance_score: { overall: 10 },
    },
  ],
  findings: [
    { id: "finding-a1", organization_id: "org-a1", project_id: "project-a1", status: "open" },
    { id: "finding-b2", organization_id: null, project_id: "project-b2", status: "reopened" },
    { id: "finding-b1", organization_id: "org-b1", project_id: "project-b1", status: "open" },
    { id: "finding-archived", organization_id: "org-archived", project_id: "project-archived", status: "open" },
  ],
  role: "owner" as "owner" | "account_manager",
  userId: "owner-a",
  assignments: [{ agency_id: "agency-a", client_id: "client-a2", user_id: "am-1" }],
}));

function query(table: string, rows: Record<string, unknown>[]) {
  const filters: Array<[string, string, unknown]> = [];
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  builder.select = () => builder;
  builder.eq = (column, value) => {
    filters.push(["eq", column as string, value]);
    return builder;
  };
  builder.neq = (column, value) => {
    filters.push(["neq", column as string, value]);
    return builder;
  };
  builder.in = (column, values) => {
    filters.push(["in", column as string, values]);
    return builder;
  };
  builder.order = () => builder;
  builder.then = ((resolve: (value: { data: Record<string, unknown>[]; count: number; error: null }) => unknown) => {
    const filtered = rows.filter((row) =>
      filters.every(([operator, column, value]) => {
        if (operator === "eq") return row[column as string] === value;
        if (operator === "neq") return row[column as string] !== value;
        return (value as unknown[]).includes(row[column as string]);
      })
    );
    return Promise.resolve(resolve({ data: filtered, count: filtered.length, error: null }));
  }) as (...args: unknown[]) => unknown;
  return builder;
}

function rowsFor(table: string): Record<string, unknown>[] {
  if (table === "agency_clients") return state.clients;
  if (table === "projects") return state.projects;
  if (table === "findings") return state.findings;
  if (table === "agency_client_account_managers") return state.assignments;
  return [];
}

vi.mock("@/lib/agency/service", () => ({
  canUseAgencyPortal: async () => true,
  getOrCreateAgency: async () => ({ id: "agency-a", ownerId: "owner-a" }),
  getAgencyAccess: async () => ({
    agency: { id: "agency-a", ownerId: "owner-a" },
    userId: state.userId,
    role: state.role,
    assignableRoles: [],
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => query(table, rowsFor(table)) }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => query(table, rowsFor(table)) }),
}));
vi.mock("@/lib/projects-db", () => ({
  getAggregateScore: (projects: Array<{ complianceScore: { overall: number } }>) =>
    projects.length
      ? {
          overall: Math.round(
            projects.reduce((sum, project) => sum + project.complianceScore.overall, 0) / projects.length
          ),
        }
      : null,
}));
vi.mock("@/services/errors", () => ({
  ForbiddenError: class ForbiddenError extends Error {},
}));

describe("agency portfolio analytics", () => {
  beforeEach(() => {
    state.role = "owner";
    state.userId = "owner-a";
    vi.resetModules();
  });

  it("summarizes scores, findings, and risk across client rows", async () => {
    const { getAgencyPortfolioAnalytics } = await import("@/lib/agency/analytics");

    const result = await getAgencyPortfolioAnalytics();

    expect(result.summary).toEqual({
      clientCount: 4,
      averageScore: 70,
      lowestScore: 60,
      totalOpenFindings: 2,
      clientsAtRisk: 1,
    });
    expect(result.clients.map((client) => client.name)).toEqual(["Alpha", "Beta", "Gamma", "Archived"]);
    expect(result.clients.find((client) => client.name === "Alpha")).toMatchObject({
      score: 80,
      projects: 1,
      openFindings: 1,
      provisioned: true,
      risk: "good",
    });
    expect(result.clients.find((client) => client.name === "Beta")).toMatchObject({
      score: 60,
      projects: 1,
      openFindings: 1,
      provisioned: false,
      risk: "warning",
    });
    expect(result.clients.find((client) => client.name === "Gamma")).toMatchObject({
      score: null,
      risk: "none",
      atRisk: false,
    });
    expect(result.clients.find((client) => client.name === "Archived")).toMatchObject({
      score: 10,
      risk: "critical",
    });
  });

  it("limits account manager analytics to assigned clients", async () => {
    state.role = "account_manager";
    state.userId = "am-1";
    const { getAgencyPortfolioAnalytics } = await import("@/lib/agency/analytics");

    const result = await getAgencyPortfolioAnalytics();

    expect(result.clients.map((client) => client.name)).toEqual(["Beta"]);
    expect(result.summary.clientCount).toBe(1);
    expect(result.summary.averageScore).toBe(60);
  });

  it("returns an empty summary for an agency with no clients", async () => {
    state.clients.splice(0);
    const { getAgencyPortfolioAnalytics } = await import("@/lib/agency/analytics");

    const result = await getAgencyPortfolioAnalytics();

    expect(result).toEqual({
      clients: [],
      summary: { clientCount: 0, averageScore: 0, lowestScore: 0, totalOpenFindings: 0, clientsAtRisk: 0 },
    });
  });
});
