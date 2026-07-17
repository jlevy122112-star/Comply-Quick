import { describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const eqCalls: Array<[string, string]> = [];

function makeQuery() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (column: string, value: string) => {
    eqCalls.push([column, value]);
    return builder;
  };
  builder.gte = () => builder;
  builder.or = () => {
    throw new Error("quota must not use organization-scoped OR filtering");
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

vi.mock("@/lib/entitlements", () => ({
  getEntitlement: async () => ({ isPremium: false }),
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
  it("counts only the caller's scans when organization-shared scans exist", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "caller-id" } } });
    eqCalls.length = 0;

    const { getScanQuota } = await load();
    await expect(getScanQuota()).resolves.toMatchObject({ used: 1 });

    expect(eqCalls).toContainEqual(["user_id", "caller-id"]);
  });
});
