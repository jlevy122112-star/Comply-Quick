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
  ],
  findings: [
    { id: "finding-a1", organization_id: "org-a1", project_id: "project-a1", status: "open" },
    { id: "finding-b2", organization_id: null, project_id: "project-b2", status: "reopened" },
    { id: "finding-b1", organization_id: "org-b1", project_id: "project-b1", status: "open" },
  ],
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
  return [];
}

vi.mock("@/lib/agency/service", () => ({
  canUseAgencyPortal: async () => true,
  getOrCreateAgency: async () => ({ id: "agency-a", ownerId: "owner-a" }),
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
  beforeEach(() => vi.resetModules());

  it("summarizes scores, findings, and risk across client rows", async () => {
    const { getAgencyPortfolioAnalytics } = await import("@/lib/agency/analytics");

    const result = await getAgencyPortfolioAnalytics();

    expect(result.summary).toEqual({
      clientCount: 2,
      averageScore: 70,
      lowestScore: 60,
      totalOpenFindings: 2,
      clientsAtRisk: 1,
    });
    expect(result.clients.map((client) => client.name)).toEqual(["Alpha", "Beta"]);
    expect(result.clients[0]).toMatchObject({
      score: 80,
      projects: 1,
      openFindings: 1,
      provisioned: true,
      risk: "good",
    });
    expect(result.clients[1]).toMatchObject({
      score: 60,
      projects: 1,
      openFindings: 1,
      provisioned: false,
      risk: "warning",
    });
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
