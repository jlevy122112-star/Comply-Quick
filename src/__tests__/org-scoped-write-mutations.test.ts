import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getActiveOrganizationId = vi.fn();
let currentRow: { status?: string; organization_id: string | null } = {
  status: "open",
  organization_id: "org-1",
};
let updateFilters: Array<[string, string | null]> = [];

function makeBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn((column: string, value: string) => {
      updateFilters.push([column, value]);
      return builder;
    }),
    is: vi.fn((column: string, value: null) => {
      updateFilters.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(async () => ({ data: currentRow, error: null })),
    insert: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: updateFilters.some(
          ([column, value]) => column === "organization_id" && value !== null && value !== currentRow.organization_id
        )
          ? []
          : [{ id: "updated-row" }],
        error: null,
      }).then(resolve),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const builder = makeBuilder();
    return {
      auth: { getUser },
      from: () => builder,
    };
  },
}));

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId,
  organizationReadFilter: vi.fn(),
}));

describe("organization-scoped write mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentRow = { status: "open", organization_id: "org-1" };
    updateFilters = [];
    getUser.mockResolvedValue({ data: { user: { id: "member-1" } } });
    getActiveOrganizationId.mockResolvedValue("org-1");
  });

  it("lets a member update a teammate-created canonical finding", async () => {
    const { updateFindingStatus, assignFinding } = await import("@/lib/findings-db");

    await expect(updateFindingStatus("finding-1", "resolved")).resolves.toBe(true);
    await expect(assignFinding("finding-1", "member-1")).resolves.toBe(true);
    expect(updateFilters).toContainEqual(["organization_id", "org-1"]);
    expect(updateFilters).not.toContainEqual(["user_id", "member-1"]);
  });

  it("mutates a canonical finding using its own organization when active organization differs", async () => {
    getActiveOrganizationId.mockResolvedValue("org-2");
    const { updateFindingStatus } = await import("@/lib/findings-db");

    await expect(updateFindingStatus("finding-1", "resolved")).resolves.toBe(true);
    expect(updateFilters).toContainEqual(["organization_id", "org-1"]);
  });

  it("keeps legacy finding and evidence writes user-scoped", async () => {
    currentRow = { status: "open", organization_id: null };
    getActiveOrganizationId.mockResolvedValue("personal-org");
    const { updateFindingStatus } = await import("@/lib/findings-db");
    const { setEvidenceStatus } = await import("@/lib/evidence-db");

    await expect(updateFindingStatus("finding-legacy", "resolved")).resolves.toBe(true);
    await expect(setEvidenceStatus("evidence-legacy", "collected")).resolves.toBe(true);
    expect(updateFilters).toContainEqual(["user_id", "member-1"]);
    expect(updateFilters).toContainEqual(["organization_id", null]);
  });
});
