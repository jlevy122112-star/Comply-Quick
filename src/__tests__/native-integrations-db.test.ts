import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getMyOrgRole = vi.fn();
const getActiveOrganizationId = vi.fn();
const nativeUpsert = vi.fn();
const nativeUpdate = vi.fn();
const eventUpsert = vi.fn();

vi.mock("@/lib/organizations-db", () => ({
  getMyOrgRole,
  getActiveOrganizationId,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table !== "native_integrations") throw new Error(`Unexpected table ${table}`);
      return {
        upsert: (payload: Record<string, unknown>, options: Record<string, unknown>) => {
          nativeUpsert(payload, options);
          return {
            select: () => ({
              single: async () => ({
                data: {
                  id: "native-1",
                  organization_id: "org-1",
                  workspace_id: "ws-1",
                  client_seat_id: "client-1",
                  platform: "wordpress",
                  status: "pending",
                  mode: "propose_only",
                  external_account_id: "example.com",
                  install_metadata: {},
                  connected_at: "2026-01-01T00:00:00.000Z",
                  disconnected_at: null,
                  revoked_reason: null,
                  last_verified_at: null,
                  last_sync_at: null,
                  last_error: null,
                  created_at: "2026-01-01T00:00:00.000Z",
                  updated_at: "2026-01-01T00:00:00.000Z",
                },
                error: null,
              }),
            }),
          };
        },
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "native-1",
                organization_id: "org-1",
                platform: "wordpress",
                external_account_id: "example.com",
              },
              error: null,
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          nativeUpdate(payload);
          return {
            eq: async () => ({ error: null }),
          };
        },
      };
    },
    schema: (schema: string) => {
      if (schema !== "connector") throw new Error(`Unexpected schema ${schema}`);
      return {
        from: (table: string) => {
          if (table !== "platform_webhook_events") throw new Error(`Unexpected table ${table}`);
          return {
            upsert: (payload: Record<string, unknown>, options: Record<string, unknown>) => {
              eventUpsert(payload, options);
              return {
                select: async () => ({ data: [{ id: "evt-1" }], error: null }),
              };
            },
          };
        },
      };
    },
  }),
}));

describe("native integrations data layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveOrganizationId.mockResolvedValue("org-1");
    getMyOrgRole.mockResolvedValue("admin");
  });

  it("blocks non-admin connect attempts", async () => {
    getMyOrgRole.mockResolvedValue("member");
    const { connectNativeIntegration } = await import("@/lib/native-integrations-db");
    const result = await connectNativeIntegration({
      workspaceId: "ws-1",
      platform: "wordpress",
      externalAccountId: "example.com",
    });
    expect(result).toEqual({ ok: false, error: "Only owners and admins can manage native integrations." });
    expect(nativeUpsert).not.toHaveBeenCalled();
  });

  it("connects a native integration with workspace and client scope", async () => {
    const { connectNativeIntegration } = await import("@/lib/native-integrations-db");
    const result = await connectNativeIntegration({
      workspaceId: "ws-1",
      clientSeatId: "client-1",
      platform: "wordpress",
      externalAccountId: "example.com",
    });
    expect(result.ok).toBe(true);
    expect(nativeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        workspace_id: "ws-1",
        client_seat_id: "client-1",
        platform: "wordpress",
        external_account_id: "example.com",
        status: "pending",
      }),
      expect.objectContaining({ onConflict: "organization_id,workspace_id,platform,external_account_id" })
    );
  });

  it("soft-revokes and logs a unified webhook event", async () => {
    const { softRevokeNativeIntegration } = await import("@/lib/native-integrations-db");
    const result = await softRevokeNativeIntegration("native-1", "Manual disconnect");
    expect(result).toEqual({ ok: true });
    expect(nativeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "revoked",
        revoked_reason: "Manual disconnect",
      })
    );
    expect(eventUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agency_org_id: "org-1",
        source: "supabase_db",
        event_type: "native.disconnect",
        native_integration_id: "native-1",
      }),
      expect.objectContaining({ onConflict: "event_key" })
    );
  });
});
