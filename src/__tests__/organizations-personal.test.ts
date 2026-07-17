import { beforeEach, describe, expect, it, vi } from "vitest";

const filters: Array<[string, unknown]> = [];
const personalOrganization = {
  id: "org-personal",
  owner_id: "owner-1",
  name: "My Organization",
  slug: "owner-owner1",
  plan: "enterprise",
  is_personal: true,
  created_at: "2026-01-01T00:00:00.000Z",
};

const builder: Record<string, (...args: unknown[]) => unknown> = {};
builder.select = () => builder;
builder.eq = (column, value) => {
  filters.push([column as string, value]);
  return builder;
};
builder.maybeSingle = async () => ({ data: personalOrganization, error: null });
builder.insert = (row) => {
  expect(row).toEqual(expect.objectContaining({ is_personal: true }));
  return builder;
};
builder.single = async () => ({ data: personalOrganization, error: null });

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner-1", email: "owner@example.com" } } }) },
    from: () => builder,
  }),
}));

describe("personal organization resolution", () => {
  beforeEach(() => {
    filters.length = 0;
    vi.resetModules();
  });

  it("resolves the marked personal organization when the owner has client organizations too", async () => {
    const { getOrCreateOrganization } = await import("@/lib/organizations-db");

    await expect(getOrCreateOrganization()).resolves.toMatchObject({ id: "org-personal" });
    expect(filters).toContainEqual(["owner_id", "owner-1"]);
    expect(filters).toContainEqual(["is_personal", true]);
  });
});
