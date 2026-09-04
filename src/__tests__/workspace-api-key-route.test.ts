import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockGetMyOrgRole = vi.fn();
const mockGetActiveOrganizationId = vi.fn();
const updateSpy = vi.fn();
const insertSpy = vi.fn();

function clientApiKeysQuery() {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.neq = () => builder;
  builder.order = () => ({ data: [], error: null });
  builder.is = async () => ({ error: null });
  builder.update = (payload: Record<string, unknown>) => {
    updateSpy(payload);
    return builder;
  };
  builder.insert = (payload: Record<string, unknown>) => {
    insertSpy(payload);
    return {
      select: () => ({
        single: async () => ({
          data: {
            id: "key_1",
            name: "Primary",
            key_prefix: "cq_live_abc",
            last_used_at: null,
            revoked_at: null,
            created_at: "2026-09-04T00:00:00.000Z",
          },
          error: null,
        }),
      }),
    };
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "workspaces") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "ws_1", organization_id: "org_1" } }),
            }),
          }),
        };
      }
      if (table === "client_api_keys") return clientApiKeysQuery();
      return clientApiKeysQuery();
    },
  }),
}));

vi.mock("@/lib/organizations-db", () => ({
  getMyOrgRole: (...args: unknown[]) => mockGetMyOrgRole(...args),
  getActiveOrganizationId: (...args: unknown[]) => mockGetActiveOrganizationId(...args),
}));

function req(body: unknown) {
  return new NextRequest("http://localhost/api/workspaces/ws_1/api-key", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function getReq() {
  return new NextRequest("http://localhost/api/workspaces/ws_1/api-key", { method: "GET" });
}
function deleteReq(keyId = "key_1") {
  return new NextRequest(`http://localhost/api/workspaces/ws_1/api-key?keyId=${keyId}`, { method: "DELETE" });
}

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/workspaces/[id]/api-key/route");
}

describe("POST /api/workspaces/:id/api-key", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetMyOrgRole.mockReset();
    updateSpy.mockReset();
    insertSpy.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1" } } });
    mockGetMyOrgRole.mockResolvedValue("admin");
    mockGetActiveOrganizationId.mockResolvedValue("org_1");
  });

  it("creates a workspace-scoped key", async () => {
    const { POST } = await loadRoute();
    const res = await POST(req({ name: "Primary" }), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(typeof data.key).toBe("string");
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: "ws_1", organization_id: "org_1", name: "Primary" })
    );
  });

  it("revokes active keys before rotate create", async () => {
    const { POST } = await loadRoute();
    const res = await POST(req({ rotate: true }), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(201);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledTimes(1);
  });

  it("returns forbidden for non-admin workspace members", async () => {
    mockGetMyOrgRole.mockResolvedValue("member");
    const { POST } = await loadRoute();
    const res = await POST(req({ name: "Primary" }), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(403);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("lists workspace keys for authenticated members", async () => {
    const { GET } = await loadRoute();
    const res = await GET(getReq(), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.keys)).toBe(true);
  });

  it("revokes a workspace key for admins", async () => {
    const { DELETE } = await loadRoute();
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
  });

  it("returns 401 for anonymous requests", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await loadRoute();
    const res = await GET(getReq(), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when revoking as a non-admin workspace member", async () => {
    mockGetMyOrgRole.mockResolvedValue("member");
    const { DELETE } = await loadRoute();
    const res = await DELETE(deleteReq(), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(403);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects a workspace outside the active tenant context", async () => {
    mockGetActiveOrganizationId.mockResolvedValue("org_2");
    const { GET } = await loadRoute();
    const res = await GET(getReq(), { params: Promise.resolve({ id: "ws_1" }) });
    expect(res.status).toBe(403);
  });
});
