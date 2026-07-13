import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSingle = vi.fn();
const mockInsert = vi.fn(() => ({ select: () => ({ single: mockSingle }) }));
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mockFrom }) }));

function request(body: unknown) {
  return new NextRequest("http://localhost:3001/api/free-scan/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/free-scan/claim", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockSingle.mockReset();
  });

  it("issues one opaque token for a normalized email", async () => {
    mockSingle.mockResolvedValue({ data: { token: "2a9466aa-3511-45d0-a8ee-5d4b2e17a78d" }, error: null });
    const { POST } = await import("@/app/api/free-scan/claim/route");

    const response = await POST(request({ email: "  FIRST@EXAMPLE.COM " }));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, token: "2a9466aa-3511-45d0-a8ee-5d4b2e17a78d" });
    expect(mockInsert).toHaveBeenCalledWith({ email: "first@example.com", source: "exit_intent" });
  });

  it("rejects a lifetime duplicate claim", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    const { POST } = await import("@/app/api/free-scan/claim/route");

    const response = await POST(request({ email: "first@example.com" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_claimed" });
  });

  it("rejects malformed email addresses before persistence", async () => {
    const { POST } = await import("@/app/api/free-scan/claim/route");

    const response = await POST(request({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
