import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const track = vi.fn();
const mockGetUser = vi.fn();
const warn = vi.fn();
const captureMessage = vi.fn();

vi.mock("@/services", () => ({
  analytics: { track },
  logger: { child: () => ({ warn }) },
  ValidationError: class ValidationError extends Error {},
  errorResponse: (err: unknown) =>
    Response.json({ error: err instanceof Error ? err.message : "error" }, { status: 422 }),
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analytics/track", () => {
  beforeEach(() => {
    track.mockReset();
    mockGetUser.mockReset();
    warn.mockReset();
    captureMessage.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1" } } });
  });

  it("accepts new client events", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const res = await POST(makeRequest({ event: "web_vital_reported", properties: { metric: "LCP", value: 1200 } }));
    expect(res.status).toBe(200);
    expect(track).toHaveBeenCalledWith({
      event: "web_vital_reported",
      userId: "user_1",
      properties: { metric: "LCP", value: 1200 },
    });
  });

  it("rejects unsupported events", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const res = await POST(makeRequest({ event: "checkout_completed" }));
    expect(res.status).toBe(422);
  });

  it("logs and emits sentry warning when budget fails", async () => {
    const { POST } = await import("@/app/api/analytics/track/route");
    const res = await POST(
      makeRequest({ event: "web_vital_budget_failed", properties: { metric: "INP", route: "/", value: 333 } })
    );
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });
});
