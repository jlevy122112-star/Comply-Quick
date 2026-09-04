import { beforeEach, describe, expect, it, vi } from "vitest";

const webhookUpsert = vi.fn();
const nativeUpdate = vi.fn();
const nativeLookup = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    schema: (schema: string) => {
      if (schema !== "connector") throw new Error(`Unexpected schema ${schema}`);
      return {
        from: (table: string) => {
          if (table !== "platform_webhook_events") throw new Error(`Unexpected table ${table}`);
          return {
            upsert: (payload: Record<string, unknown>) => {
              webhookUpsert(payload);
              return {
                select: async () => ({ data: [{ id: "evt-1" }], error: null }),
              };
            },
          };
        },
      };
    },
    from: (table: string) => {
      if (table === "native_integrations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => nativeLookup(),
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            nativeUpdate(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/webhooks/platform/route");
}

function req(payload: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request("http://localhost/api/webhooks/platform", {
    method: "POST",
    headers: { "content-type": "application/json", ...(headers ?? {}) },
    body: JSON.stringify(payload),
  });
}

describe("POST /api/webhooks/platform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nativeLookup.mockResolvedValue({ data: { id: "native-1" } });
    process.env.CRON_SECRET = "secret";
  });

  it("logs a native event and transitions status", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      req(
        {
          schema: "public",
          table: "native_integrations",
          type: "UPDATE",
          record: { id: "native-1", organization_id: "org-1", platform: "wordpress", status: "active" },
        },
        { "x-webhook-secret": "secret" }
      )
    );
    expect(response.status).toBe(200);
    expect(webhookUpsert).toHaveBeenCalledWith(expect.objectContaining({ event_type: "UPDATE", event_key: expect.any(String) }));
    expect(nativeUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
  });

  it("returns duplicate=true when idempotency key already exists", async () => {
    webhookUpsert.mockImplementationOnce(() => undefined);
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => ({
        schema: () => ({
          from: () => ({
            upsert: () => ({
              select: async () => ({ data: [], error: null }),
            }),
          }),
        }),
        from: () => ({
          update: () => ({ eq: async () => ({ error: null }) }),
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: { id: "native-1" } }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    }));
    const { POST } = await loadRoute();
    const response = await POST(
      req(
        {
          schema: "connector",
          table: "connector_connections",
          type: "UPDATE",
          record: {
            agency_org_id: "org-1",
            platform: "wordpress",
            external_account_id: "example.com",
            status: "degraded",
          },
        },
        { "x-webhook-secret": "secret", "x-supabase-event-id": "evt-key" }
      )
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.duplicate).toBe(true);
  });
});
