import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "admin",
  userId: "user-1",
  flags: [
    { id: "org-row", organization_id: "org-1", flag_key: "profit_optimizations", user_id: null, enabled: false },
    {
      id: "user-row",
      organization_id: "org-1",
      flag_key: "profit_optimizations",
      user_id: "user-1",
      enabled: true,
    },
  ] as Array<Record<string, unknown>>,
  audit: [] as Array<Record<string, unknown>>,
}));

function builder(table: string) {
  const filters: Array<[string, string, unknown]> = [];
  let payload: Record<string, unknown> | null = null;
  const chain: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit"]) {
    chain[method] = (...args: unknown[]) => {
      if (method === "eq") filters.push(["eq", args[0] as string, args[1]]);
      if (method === "is") filters.push(["is", args[0] as string, args[1]]);
      return chain;
    };
  }
  chain.update = (value: unknown) => {
    payload = value as Record<string, unknown>;
    return chain;
  };
  chain.insert = (value: unknown) => {
    payload = value as Record<string, unknown>;
    return chain;
  };
  chain.maybeSingle = async () => {
    const rows = table === "organization_feature_flags" ? state.flags : [];
    const row = rows.find((candidate) =>
      filters.every(([operator, column, value]) =>
        operator === "eq" ? candidate[column] === value : candidate[column] === null
      )
    );
    return { data: row ?? null, error: null };
  };
  chain.then = ((resolve: (value: unknown) => unknown) => {
    const rows = table === "organization_feature_flags" ? state.flags : state.audit;
    const filtered = rows.filter((candidate) =>
      filters.every(([operator, column, value]) =>
        operator === "eq" ? candidate[column] === value : candidate[column] === null
      )
    );
    if (payload && table === "feature_flag_audit") state.audit.push(payload);
    return Promise.resolve(resolve({ data: filtered, error: null }));
  }) as (...args: unknown[]) => unknown;
  return chain;
}

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId: async () => "org-1",
  getMyOrgRole: async () => state.role,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.userId } } }) },
    from: (table: string) => builder(table),
  }),
}));

describe("tenant feature flags", () => {
  beforeEach(() => {
    state.role = "admin";
    state.flags = [
      { id: "org-row", organization_id: "org-1", flag_key: "profit_optimizations", user_id: null, enabled: false },
      { id: "user-row", organization_id: "org-1", flag_key: "profit_optimizations", user_id: "user-1", enabled: true },
    ];
    state.audit = [];
    process.env.NEXT_PUBLIC_ENABLE_SPEED_OPTIMIZATIONS = "false";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_ENABLE_SPEED_OPTIMIZATIONS;
  });

  it("resolves user overrides before organization, env, and registry defaults", async () => {
    const { resolveFlag } = await import("@/lib/flags");
    await expect(resolveFlag("profit_optimizations")).resolves.toBe(true);

    state.flags = state.flags.filter((row) => row.user_id === null);
    const { listOrgFlags } = await import("@/lib/flags");
    await expect(listOrgFlags()).resolves.toEqual(
      expect.arrayContaining([
        { key: "profit_optimizations", enabled: false, source: "organization" },
        { key: "speed_optimizations", enabled: false, source: "env" },
        { key: "churn_save_offer", enabled: true, source: "default" },
      ])
    );
  });

  it("requires an organization admin and records an audit entry when setting a flag", async () => {
    state.role = "member";
    const { setOrgFlag } = await import("@/lib/flags");
    await expect(setOrgFlag("profit_optimizations", true)).rejects.toThrow(/admins/);

    state.role = "admin";
    await setOrgFlag("profit_optimizations", true);
    expect(state.audit).toEqual([
      expect.objectContaining({
        organization_id: "org-1",
        flag_key: "profit_optimizations",
        previous_enabled: false,
        new_enabled: true,
        actor_user_id: "user-1",
      }),
    ]);
  });
});
