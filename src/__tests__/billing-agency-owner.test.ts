import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  entitlementUsers: [] as string[],
  callerTier: "free" as "free" | "solo",
  ownerTier: "agency" as "agency" | "enterprise",
  queries: [] as Array<{ table: string; column: string; value: string }>,
  overageRows: [] as Record<string, unknown>[],
}));

function makeQuery(table: string) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (column: string, value: string) => {
    state.queries.push({ table, column, value });
    return builder;
  };
  builder.gte = () => builder;
  builder.then = (resolve: (value: { count?: number; error: null }) => unknown) =>
    Promise.resolve(resolve({ count: table === "agency_members" ? 3 : 7, error: null }));
  builder.upsert = (row: Record<string, unknown>) => {
    state.overageRows.push(row);
    return Promise.resolve({ error: null });
  };
  return builder;
}

vi.mock("@/lib/entitlements", () => ({
  getEntitlement: async () => ({
    tier: state.callerTier,
    isPremium: state.callerTier !== "free",
  }),
  getEntitlementForUser: async (userId: string) => {
    state.entitlementUsers.push(userId);
    return {
      tier: state.ownerTier,
      isPremium: true,
    };
  },
}));

vi.mock("@/lib/agency/service", () => ({
  getOrCreateAgency: async () => ({ id: "agency-1", ownerId: "owner-1" }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "member-1" } } }),
    },
    from: (table: string) => makeQuery(table),
  }),
}));

describe("agency billing entitlement scoping", () => {
  beforeEach(() => {
    state.entitlementUsers = [];
    state.callerTier = "free";
    state.ownerTier = "agency";
    state.queries = [];
    state.overageRows = [];
  });

  it("uses the agency owner's tier for a non-owner member's seat usage", async () => {
    const { getSeatUsage } = await import("@/lib/billing/usage");

    await expect(getSeatUsage()).resolves.toMatchObject({
      used: 3,
      limit: 5,
      remaining: 2,
    });
    expect(state.entitlementUsers).toContain("owner-1");
  });

  it("uses the agency owner's tier in the billing summary", async () => {
    const { getBillingSummary } = await import("@/lib/billing/usage");

    await expect(getBillingSummary()).resolves.toMatchObject({
      tier: "agency",
      seats: { used: 3, limit: 5 },
    });
    expect(state.entitlementUsers).toContain("owner-1");
  });

  it("keeps scan usage and overage accounting caller-scoped", async () => {
    state.callerTier = "solo";
    const { getScanUsage, recordScanUsage } = await import("@/lib/billing/usage");

    await expect(getScanUsage(new Date("2026-07-15T00:00:00Z"))).resolves.toMatchObject({
      used: 7,
      limit: 20,
    });
    expect(state.queries).toContainEqual({ table: "scans", column: "user_id", value: "member-1" });

    await recordScanUsage(new Date("2026-07-15T00:00:00Z"));
    expect(state.overageRows.at(-1)).toMatchObject({ user_id: "member-1", period: "2026-07" });
  });
});
