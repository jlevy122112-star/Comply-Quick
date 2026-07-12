import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Retention policy (pure) ──────────────────────────────────────────────────
import { isExpired, retentionFor, RETENTION_POLICY } from "@/lib/privacy/retention";

describe("retention policy", () => {
  it("never expires lifetime (days=null) categories", () => {
    const old = new Date("2000-01-01").toISOString();
    expect(isExpired(old, "account")).toBe(false);
  });

  it("expires records older than their retention window", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const old = new Date("2023-01-01T00:00:00Z").toISOString(); // ~3y, > 730d
    const recent = new Date("2025-12-01T00:00:00Z").toISOString();
    expect(isExpired(old, "scan_results", now)).toBe(true);
    expect(isExpired(recent, "scan_results", now)).toBe(false);
  });

  it("treats unparseable timestamps as not-expired (fail-safe)", () => {
    expect(isExpired("not-a-date", "scan_results")).toBe(false);
  });

  it("exposes a rule for every category referenced", () => {
    for (const rule of RETENTION_POLICY) {
      expect(retentionFor(rule.category)).toBe(rule);
    }
  });
});

// ── DSAR service ─────────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
const deleteUser = vi.fn();
const insertSingle = vi.fn();
const updateEq = vi.fn();
const serverOrder = vi.fn();

// Table-aware admin mock: `from(table)` records the table name and each select
// resolves to a table-specific response, so tests can assert the correct table
// was queried (not just that some query ran) and can fail a single table.
const fromTables: string[] = [];
const tableRows: Record<string, unknown[]> = {};
const errorTables = new Set<string>();
const selectEqCalls: Array<{ table: string; column: string; value: unknown }> = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({ order: serverOrder }),
    }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      fromTables.push(table);
      return {
        select: () => ({
          eq: async (column: string, value: unknown) => {
            selectEqCalls.push({ table, column, value });
            if (errorTables.has(table)) return { data: null, error: { message: "no column" } };
            return { data: tableRows[table] ?? [{ id: `${table}_row` }], error: null };
          },
        }),
        insert: () => ({ select: () => ({ single: insertSingle }) }),
        update: () => ({ eq: updateEq }),
      };
    },
    auth: { admin: { deleteUser } },
  }),
}));

async function loadDsar() {
  vi.resetModules();
  return await import("@/lib/privacy/dsar");
}

describe("DSAR service", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    deleteUser.mockReset();
    insertSingle.mockReset();
    updateEq.mockReset();
    serverOrder.mockReset();
    fromTables.length = 0;
    selectEqCalls.length = 0;
    errorTables.clear();
    for (const k of Object.keys(tableRows)) delete tableRows[k];
    insertSingle.mockResolvedValue({ data: { id: "req_1" }, error: null });
    updateEq.mockResolvedValue({ error: null });
  });

  it("assembles an export keyed by table, filtered to the user", async () => {
    tableRows.projects = [{ id: "proj_1" }];
    const { assembleUserExport } = await loadDsar();
    const result = await assembleUserExport("user_1", "a@b.com");
    expect(result.userId).toBe("user_1");
    expect(result.email).toBe("a@b.com");
    expect(fromTables).toContain("projects");
    // The projects table was queried, filtered to the user, and its own rows returned.
    expect(result.data.projects).toEqual([{ id: "proj_1" }]);
    expect(selectEqCalls.every((c) => c.column === "user_id" && c.value === "user_1")).toBe(true);
  });

  it("degrades a failing table to an empty array without failing the export", async () => {
    errorTables.add("projects");
    const { assembleUserExport } = await loadDsar();
    const result = await assembleUserExport("user_1");
    // projects errored → empty; another table still populated.
    expect(result.data.projects).toEqual([]);
    expect(result.data.scans).toEqual([{ id: "scans_row" }]);
  });

  it("rejects export when not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { requestDataExport } = await loadDsar();
    const result = await requestDataExport();
    expect(result.ok).toBe(false);
  });

  it("refuses deletion when the confirmation email does not match", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1", email: "owner@x.com" } } });
    const { requestAccountDeletion } = await loadDsar();
    const result = await requestAccountDeletion("wrong@x.com");
    expect(result.ok).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the auth user when the confirmation email matches", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1", email: "Owner@X.com" } } });
    deleteUser.mockResolvedValue({ error: null });
    const { requestAccountDeletion } = await loadDsar();
    const result = await requestAccountDeletion("owner@x.com");
    expect(result.ok).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("user_1");
  });

  it("reports failure and marks the request failed when deletion errors", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1", email: "owner@x.com" } } });
    deleteUser.mockResolvedValue({ error: { message: "boom" } });
    const { requestAccountDeletion } = await loadDsar();
    const result = await requestAccountDeletion("owner@x.com");
    expect(result.ok).toBe(false);
    expect(updateEq).toHaveBeenCalled();
  });
});
