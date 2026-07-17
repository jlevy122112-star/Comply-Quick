import { beforeEach, describe, expect, it, vi } from "vitest";
import { managedClientLimit } from "@/lib/pricing";

const state = {
  entitlement: { tier: "agency", isPremium: true },
  linkedOrganizationId: null as string | null,
  callerId: "owner-1",
  agencyRole: "admin",
  agencyLookups: 0,
  lastInsert: null as Record<string, unknown> | null,
  clientCount: 0,
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
  if (table === "organizations" && operation === "maybeSingle") {
    return { data: state.linkedOrganizationId ? organization : null, error: null };
  }
  if (table === "organizations" && operation === "single") {
    return { data: organization, error: null };
  }
  if (table === "agency_members" && operation === "maybeSingle") {
    return {
      data: state.agencyRole === "admin" ? { agency_id: agency.id, role: state.agencyRole } : null,
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
    state.linkedOrganizationId = state.lastInsert?.organization_id as string;
    return { data: { organization_id: state.linkedOrganizationId }, error: null };
  }
  if (table === "organizations" && operation === "then") return { data: null, error: null };
  if (table === "organization_members" && operation === "then") return { data: null, error: null };
  if (table === "workspaces" && operation === "then") return { data: null, error: null };
  if (table === "agency_clients" && operation === "then") return { data: null, error: null };
  return { data: null, error: null };
}

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {};
  let operation = "then";
  for (const method of ["select", "eq", "limit", "insert", "upsert", "update", "is", "order"]) {
    builder[method] = (...args: unknown[]) => {
      if (method === "insert" || method === "upsert" || method === "update") {
        state.lastInsert = (args[0] ?? null) as Record<string, unknown> | null;
      }
      if (method === "update" && table === "agency_clients") operation = "linked";
      return builder;
    };
  }
  builder.maybeSingle = async () => resultFor(table, operation === "then" ? "maybeSingle" : operation);
  builder.single = async () => resultFor(table, "single");
  builder.then = (resolve: (value: Record<string, unknown>) => unknown) =>
    Promise.resolve(resolve(resultFor(table, table === "agency_clients" ? "count" : "then")));
  builder.delete = () => builder;
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
}));
vi.mock("@/services", () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }) },
}));

describe("agency client organizations", () => {
  beforeEach(() => {
    state.entitlement = { tier: "agency", isPremium: true };
    state.linkedOrganizationId = null;
    state.callerId = "owner-1";
    state.agencyRole = "admin";
    state.agencyLookups = 0;
    state.lastInsert = null;
    state.clientCount = 0;
    vi.resetModules();
  });

  it("defines the Agency and Enterprise managed-client limits", () => {
    expect(managedClientLimit("agency")).toBe(50);
    expect(managedClientLimit("enterprise")).toBe(Infinity);
    expect(managedClientLimit("solo")).toBeNull();
  });

  it("rejects Agency client creation once 50 active clients exist", async () => {
    state.clientCount = 50;
    const { createClient_ } = await import("@/lib/agency/service");

    await expect(createClient_({ name: "Over limit" })).rejects.toThrow(/50 managed clients/);
  });

  it("provisions and then reuses the same linked organization", async () => {
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    const first = await provisionClientOrganization("client-1");
    const second = await provisionClientOrganization("client-1");

    expect(first.id).toBe("org-client-1");
    expect(second.id).toBe(first.id);
    expect(state.linkedOrganizationId).toBe(first.id);
  });

  it("rejects a non-admin agency member", async () => {
    state.callerId = "member-1";
    state.agencyRole = "member";
    const { provisionClientOrganization } = await import("@/lib/agency/service");

    await expect(provisionClientOrganization("client-1")).rejects.toThrow(/owners and admins/);
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
