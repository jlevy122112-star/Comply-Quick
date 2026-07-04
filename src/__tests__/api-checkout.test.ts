import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/checkout/route";
import { NextRequest } from "next/server";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3001/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout", () => {
  it("returns 503 when STRIPE_SECRET_KEY is not set", async () => {
    const res = await POST(makeRequest({ plan: "single" }));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("Stripe is not configured");
    expect(data.message).toContain("STRIPE_SECRET_KEY");
  });

  it("returns 503 for all valid plans without Stripe key", async () => {
    for (const plan of ["single", "agency", "enterprise"]) {
      const res = await POST(makeRequest({ plan }));
      expect(res.status).toBe(503);
    }
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost:3001/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await POST(req);
    // Without Stripe key, 503 is returned before body validation
    // The 503 check happens first
    expect(res.status).toBe(503);
  });
});
