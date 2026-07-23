import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const eqCalls: Array<[string, string]> = [];
const orCalls: string[] = [];
let isPremium = false;

function makeQuery() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (column: string, value: string) => {
    eqCalls.push([column, value]);
    return builder;
  };
  builder.gte = () => builder;
  builder.or = (filter: string) => {
    orCalls.push(filter);
    return builder;
  };
  builder.then = (resolve: (value: { count: number }) => unknown) => Promise.resolve(resolve({ count: 1 }));
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => makeQuery(),
  }),
}));

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId: async () => "org-1",
  organizationReadFilter: (userId: string, organizationId: string | null) =>
    organizationId
      ? `organization_id.eq.${organizationId},and(user_id.eq.${userId},organization_id.is.null)`
      : `user_id.eq.${userId}`,
}));

vi.mock("@/lib/entitlements", () => ({
  getOrgEntitlement: async () => ({ isPremium, tier: isPremium ? "agency" : "free" }),
}));

vi.mock("@/lib/pricing", () => ({
  TIER_CONFIG: {
    free: { scanLimit: 1 },
    solo: { scanLimit: 20 },
    agency: { scanLimit: Infinity },
    enterprise: { scanLimit: Infinity },
  },
  scanLimit: (tier: "free" | "solo" | "agency" | "enterprise") =>
    ({ free: 1, solo: 20, agency: Infinity, enterprise: Infinity })[tier],
  isUnlimited: (value: number | null) => value === Infinity,
}));

vi.mock("@/lib/billing/usage", () => ({
  currentPeriod: () => "2026-07",
  periodStartIso: () => "2026-07-01T00:00:00.000Z",
}));

async function load() {
  vi.resetModules();
  return await import("@/lib/scanner/service");
}

describe("getScanQuota", () => {
  afterEach(() => {
    isPremium = false;
    orCalls.length = 0;
  });

  it("returns unlimited quota for a paid organization member", async () => {
    isPremium = true;
    getUser.mockResolvedValue({ data: { user: { id: "caller-id" } } });
    const { getScanQuota } = await load();

    await expect(getScanQuota()).resolves.toMatchObject({ isPremium: true, limit: null, remaining: null });
  });

  it("counts only the caller's scans when organization-shared scans exist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "caller-id" } } });
    eqCalls.length = 0;

    const { getScanQuota } = await load();
    await expect(getScanQuota()).resolves.toMatchObject({ used: 1 });

    expect(orCalls).toContain("organization_id.eq.org-1,and(user_id.eq.caller-id,organization_id.is.null)");
  });
});
