import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  activeOrganizationId: null as string | null,
  callerId: "member-1",
  organizationOwnerId: "owner-1",
  callerSubscription: { tier: "solo", status: "active", current_period_end: null },
  ownerSubscription: { tier: "agency", status: "active", current_period_end: null },
}));

function subscriptionBuilder(userId: string) {
  const builder: Record<string, unknown> = {};
  let queriedUserId = userId;
  builder.select = () => builder;
  builder.eq = (column: string, value: string) => {
    if (column === "user_id") queriedUserId = value;
    return builder;
  };
  builder.maybeSingle = async () => ({
    data: queriedUserId === "owner-1" ? state.ownerSubscription : state.callerSubscription,
    error: null,
  });
  return builder;
}

const serverClient = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: state.callerId } } })),
  },
  from: (table: string) => {
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = async () =>
      table === "organizations"
        ? { data: { owner_id: state.organizationOwnerId }, error: null }
        : { data: state.callerSubscription, error: null };
    return builder;
  },
};

const adminClient = {
  from: (table: string) => subscriptionBuilder(table === "subscriptions" ? state.organizationOwnerId : ""),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => serverClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => adminClient,
}));
vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId: async () => state.activeOrganizationId,
}));

describe("organization entitlements", () => {
  beforeEach(() => {
    state.activeOrganizationId = null;
    state.callerId = "member-1";
    state.organizationOwnerId = "owner-1";
    state.callerSubscription = { tier: "solo", status: "active", current_period_end: null };
    state.ownerSubscription = { tier: "agency", status: "active", current_period_end: null };
  });

  it("returns the active organization's owner's tier for a non-owner member", async () => {
    state.activeOrganizationId = "org-shared";
    const { getOrgEntitlement } = await import("@/lib/entitlements");

    await expect(getOrgEntitlement()).resolves.toMatchObject({ tier: "agency", isPremium: true });
  });

  it("uses the explicit organization and equals the caller entitlement for a personal org", async () => {
    state.organizationOwnerId = state.callerId;
    const { getOrgEntitlement } = await import("@/lib/entitlements");

    await expect(getOrgEntitlement("org-personal")).resolves.toMatchObject({ tier: "solo", isPremium: true });
  });

  it("falls back to the caller entitlement without an active organization", async () => {
    const { getOrgEntitlement } = await import("@/lib/entitlements");

    await expect(getOrgEntitlement()).resolves.toMatchObject({ tier: "solo", isPremium: true });
  });
});
