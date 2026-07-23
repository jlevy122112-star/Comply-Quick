import { beforeEach, describe, expect, it, vi } from "vitest";
import { managedClientLimit } from "@/lib/pricing";

const state = {
  entitlement: { tier: "agency", isPremium: true },
  entitlementUsers: [] as string[],
  linkedOrganizationId: null as string | null,
  callerId: "owner-1",
  agencyRole: "admin",
  agencyLookups: 0,
  lastInsert: null as Record<string, unknown> | null,
  clientCount: 0,
  personalOrgId: "org-personal",
  historicalProjectIds: ["project-1"],
  taggedTables: [] as string[],
  retagUpdates: [] as Array<{ table: string; organizationId: string; filters: unknown[] }>,
  loseLinkRace: false,
  racedOrganizationId: "org-raced",
  deletedOrganizationId: null as string | null,
  failFindingRetagOnce: false,
  failPersonalLookupOnce: false,
  projectLookupFilters: [] as unknown[],
  clientStatsMode: false,
};

const agency = {
  id: "agency-1",
  owner_id: "owner-1",
  name: "Example Agency",
  slug: "example-agency",
  primary_color: "#4f46e5",
  support_email: null,
  logo_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

function resultFor(table: string, operation: string): Record<string, unknown> {
  if (state.clientStatsMode) {
    if (table === "scan_monitors") {
      return {
        data: [
          { client_id: "client-1", last_score: 80 },
          { client_id: "client-1", last_score: 60 },
        ],
        error: null,
      };
    }
    if (table === "projects") return { data: [{ client_id: "client-1" }], error: null };
    if (table === "agency_clients") return { data: [{ id: "client-1" }], error: null };
  }
  if (table === "organizations" && operation === "personal") {
    if (state.failPersonalLookupOnce) {
      state.failPersonalLookupOnce = false;
      return { data: null, error: { message: "simulated personal organization lookup failure" } };
    }
    return { data: { id: state.personalOrgId }, error: null };
  }
  if (table === "organizations" && operation === "maybeSingle") {
    return { data: state.linkedOrganizationId ? organization : null, error: null };
  }
  if (table === "organizations" && operation === "single") {
    return { data: organization, error: null };
  }
  if (table === "agency_members" && operation === "maybeSingle") {
    return {
      data: state.agencyRole ? { agency_id: agency.id, role: state.agencyRole } : null,
      error: null,
    };
  }
  if (table === "agencies" && operation === "maybeSingle") {
    state.agencyLookups += 1;
    return {
      data: state.callerId === agency.owner_id || state.agencyLookups > 1 ? agency : null,
      error: null,
    };
  }
  if (table === "agency_clients" && operation === "raced") {
    return { data: { organization_id: state.racedOrganizationId }, error: null };
  }
  if (table === "agency_clients" && operation === "maybeSingle") {
    return {
      data: {
        id: "client-1",
        agency_id: agency.id,
        name: "Acme Client",
        contact_email: null,
        website_url: null,
        notes: "",
        status: "active",
        organization_id: state.linkedOrganizationId,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    };
  }
  if (table === "agency_clients" && operation === "count") return { count: state.clientCount, error: null };
  if (table === "agency_clients" && operation === "linked") {
    if (state.loseLinkRace) return { data: null, error: null };
    state.linkedOrganizationId = state.lastInsert?.organization_id as string;
    return { data: { organization_id: state.linkedOrganizationId }, error: null };
  }
  if (table === "organizations" && operation === "then") return { data: null, error: null };
  if (table === "projects" && operation === "then") {
    return { data: state.historicalProjectIds.map((id) => ({ id })), error: null };
  }
  if (operation === "retag" && table === "findings" && state.failFindingRetagOnce) {
    state.failFindingRetagOnce = false;
    return { data: null, error: { message: "simulated findings update failure" } };
  }
  if (operation === "retag" && ["projects", "findings", "evidence_records"].includes(table)) {
    state.taggedTables.push(table);
  }
  if (table === "organization_members" && operation === "then") return { data: null, error: null };
  if (table === "workspaces" && operation === "then") return { data: null, error: null };
  if (table === "agency_clients" && operation === "then") return { data: null, error: null };
  return { data: null, error: null };
}

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  let operation = "then";
  let deleting = false;
  let activeRetag: { table: string; organizationId: string; filters: unknown[] } | null = null;
  for (const method of ["select", "eq", "limit", "insert", "upsert", "update", "is", "in", "order", "not"]) {
    builder[method] = (...args: unknown[]) => {
      if (method === "insert" || method === "upsert" || method === "update") {
        state.lastInsert = (args[0] ?? null) as Record<string, unknown> | null;
      }
      if (method === "select" && table === "agency_clients" && args[0] === "organization_id") operation = "raced";
      if (method === "eq" && deleting && table === "organizations") {
        state.deletedOrganizationId = args[1] as string;
      }
      if (method === "eq" && args[0] === "is_personal") operation = "personal";
      if (method === "update" && table === "agency_clients") operation = "linked";
      if (method === "update" && ["projects", "findings", "evidence_records"].includes(table)) {
        operation = "retag";
        activeRetag = {
          table,
          organizationId: (args[0] as { organization_id: string }).organization_id,
          filters: [],
        };
        state.retagUpdates.push(activeRetag);
      } else if (activeRetag && ["eq", "is", "or", "in"].includes(method)) {
        activeRetag.filters.push([method, ...args]);
      }
      return builder;
    };
  }
  builder.maybeSingle = async () => resultFor(table, operation === "then" ? "maybeSingle" : operation);
  builder.single = async () => resultFor(table, "single");
  builder.then = (resolve: (value: Record<string, unknown>) => unknown) =>
    Promise.resolve(resolve(resultFor(table, table === "agency_clients" ? "count" : operation)));
  builder.delete = () => {
    deleting = true;
    return builder;
  };
  builder.or = (...args: unknown[]) => {
    if (activeRetag) activeRetag.filters.push(["or", ...args]);
    else if (table === "projects") state.projectLookupFilters.push(...args);
    return builder;
  };
  return builder;
}

const serverClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: state.callerId, email: "owner@example.com" } } })),
  },
  from: (table: string) => makeBuilder(table),
};
const adminClient = {
  auth: { admin: { listUsers: vi.fn() } },
  from: (table: string) => makeBuilder(table),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => serverClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));
vi.mock("@/lib/entitlements", () => ({
  getEntitlement: async () => state.entitlement,
  getEntitlementForUser: async (userId: string) => {
    state.entitlementUsers.push(userId);
    return state.entitlement;
  },
}));
vi.mock("@/services", () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) },
}));

describe("agency client organizations", () => {
  beforeEach(() => {
    state.entitlement = { tier: "agency", isPremium: true };
    state.entitlementUsers = [];
    state.linkedOrganizationId = null;
    state.callerId = "owner-1";
    state.agencyRole = "admin";
    state.agencyLookups = 0;
    state.lastInsert = null;
    state.clientCount = 0;
    state.personalOrgId = "org-personal";
    state.historicalProjectIds = ["project-1"];
    state.taggedTables = [];
    state.retagUpdates = [];
    state.loseLinkRace = false;
    state.deletedOrganizationId = null;
    state.failFindingRetagOnce = false;
    state.failPersonalLookupOnce = false;
    state.projectLookupFilters = [];
    state.clientStatsMode = false;
    vi.resetModules();
  });

  it("defines the Agency and Enterprise managed-client limits", () => {
    expect(managedClientLimit("agency")).toBe(50);
    expect(managedClientLimit("enterprise")).toBe(Infinity);
    expect(managedClientLimit("solo")).toBe(20);
  });

  it("rejects Agency client creation once 50 active clients exist", async () => {
    state.clientCount = 50;
    const { createClient_ } = await import("@/lib/agency/service");

    await expect(createClient_({ name: "Over limit" })).rejects.toThrow(/50 managed clients/);
  });

  it("uses the agency owner's entitlement for a non-owner member", async () => {
    state.callerId = "member-1";
    state.clientCount = 50;
    const { createClient_ } = await import("@/lib/agency/service");

    await expect(createClient_({ name: "Over limit" })).rejects.toThrow(/50 managed clients/);
    expect(state.entitlementUsers).toContain("owner-1");
  });

  it("provisions and then reuses the same linked organization", async () => {
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    const first = await provisionClientOrganization("client-1");
    const second = await provisionClientOrganization("client-1");

    expect(first.id).toBe("org-client-1");
    expect(second.id).toBe(first.id);
    expect(state.linkedOrganizationId).toBe(first.id);
    expect(state.taggedTables).toEqual([
      "projects",
      "findings",
      "evidence_records",
      "projects",
      "findings",
      "evidence_records",
    ]);
    expect(state.retagUpdates).toHaveLength(6);
    expect(state.retagUpdates.every((update) => update.organizationId === first.id)).toBe(true);
    expect(
      state.retagUpdates.every((update) => update.filters.some((filter) => Array.isArray(filter) && filter[0] === "or"))
    ).toBe(true);
    expect(
      state.retagUpdates.every((update) =>
        update.filters.some(
          (filter) =>
            Array.isArray(filter) &&
            filter[0] === "or" &&
            filter[1] === "organization_id.eq.org-personal,organization_id.is.null"
        )
      )
    ).toBe(true);
  });

  it("does not retag data when this request loses the client-link race", async () => {
    state.loseLinkRace = true;
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    await provisionClientOrganization("client-1");

    expect(state.taggedTables).toEqual([]);
    expect(state.retagUpdates).toEqual([]);
    expect(state.deletedOrganizationId).toBe("org-client-1");
  });

  it("retries historical migration when an earlier retag partially fails", async () => {
    state.failFindingRetagOnce = true;
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    await expect(provisionClientOrganization("client-1")).rejects.toThrow(/migrate the client's historical data/);
    expect(state.linkedOrganizationId).toBe("org-client-1");
    expect(state.taggedTables).toEqual(["projects"]);

    await provisionClientOrganization("client-1");

    expect(state.taggedTables).toEqual(["projects", "projects", "findings", "evidence_records"]);
    expect(state.retagUpdates.map((update) => update.table)).toEqual([
      "projects",
      "findings",
      "projects",
      "findings",
      "evidence_records",
    ]);
    expect(
      state.projectLookupFilters.includes(
        "organization_id.eq.org-personal,organization_id.is.null,organization_id.eq.org-client-1"
      )
    ).toBe(true);
  });

  it("keeps organization reuse available when migration retry fails", async () => {
    state.linkedOrganizationId = "org-client-1";
    state.failFindingRetagOnce = true;
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    await expect(provisionClientOrganization("client-1")).resolves.toMatchObject({ id: "org-client-1" });
    expect(state.taggedTables).toEqual(["projects"]);
  });

  it("keeps organization reuse available when personal-org lookup fails", async () => {
    state.linkedOrganizationId = "org-client-1";
    state.failPersonalLookupOnce = true;
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    await expect(provisionClientOrganization("client-1")).resolves.toMatchObject({ id: "org-client-1" });
    expect(state.taggedTables).toEqual([]);
  });

  it("rejects a non-admin agency member", async () => {
    state.callerId = "member-1";
    state.agencyRole = "member";
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    await expect(provisionClientOrganization("client-1")).rejects.toThrow(/owners and admins/);
  });

  it("uses the agency owner for non-owner per-client rollups", async () => {
    state.callerId = "member-1";
    state.agencyRole = "member";
    state.clientStatsMode = true;
    const { getClientStats } = await import("@/lib/agency/service");

    await expect(getClientStats()).resolves.toEqual({
      "client-1": { monitors: 2, projects: 1, lowestScore: 60 },
    });
  });
});

const organization = {
  id: "org-client-1",
  owner_id: "owner-1",
  name: "Acme Client",
  slug: "acme-client-client",
  plan: "team",
  created_at: "2026-01-01T00:00:00.000Z",
};
