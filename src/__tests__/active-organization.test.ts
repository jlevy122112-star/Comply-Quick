import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cookieValue: null as string | null,
  organizations: [] as Record<string, unknown>[],
  personal: null as Record<string, unknown> | null,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookieValue ? { value: state.cookieValue } : undefined),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-a", email: "user-a@example.com" } } }),
    },
    from: (table: string) => {
      if (table !== "organizations") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          order: async () => ({ data: state.organizations, error: null }),
          eq: () => ({
            maybeSingle: async () => ({ data: state.personal, error: null }),
          }),
        }),
      };
    },
  }),
}));

import { resolveActiveOrganizationId } from "@/lib/organizations-db";

const personal = {
  id: "org-personal",
  owner_id: "user-a",
  name: "My Organization",
  slug: "my-organization",
  plan: "free",
  created_at: "2026-01-01T00:00:00.000Z",
};

const shared = {
  id: "org-shared",
  owner_id: "user-b",
  name: "Shared Organization",
  slug: "shared-organization",
  plan: "team",
  created_at: "2026-01-02T00:00:00.000Z",
};

describe("resolveActiveOrganizationId", () => {
  it("defaults to the caller's personal organization", async () => {
    state.cookieValue = null;
    state.organizations = [personal, shared];
    state.personal = personal;

    await expect(resolveActiveOrganizationId()).resolves.toBe("org-personal");
  });

  it("ignores a stored organization the caller is not a member of", async () => {
    state.cookieValue = "org-foreign";
    state.organizations = [personal, shared];
    state.personal = personal;

    await expect(resolveActiveOrganizationId()).resolves.toBe("org-personal");
  });

  it("returns a stored organization when it is a valid membership", async () => {
    state.cookieValue = "org-shared";
    state.organizations = [personal, shared];
    state.personal = personal;

    await expect(resolveActiveOrganizationId()).resolves.toBe("org-shared");
  });
});
