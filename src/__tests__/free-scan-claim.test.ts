import { describe, it, expect, vi, beforeEach } from "vitest";

const claimFreeScan = vi.fn();

vi.mock("@/lib/free-scan", () => ({
  normalizeClaimEmail: (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
  normalizeClaimSource: (value: unknown, fallback = "landing") =>
    typeof value === "string" && value.trim() ? value.trim() : fallback,
  isValidClaimEmail: (email: string) => email.includes("@"),
  claimFreeScan: (...args: unknown[]) => claimFreeScan(...args),
}));

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/free-scan/claim/route");
}

describe("POST /api/free-scan/claim", () => {
  beforeEach(() => {
    claimFreeScan.mockReset();
  });

  it("returns token for a newly issued claim", async () => {
    claimFreeScan.mockResolvedValue({
      status: "issued",
      claim: { token: "token_1", email: "user@example.com" },
    });
    const { POST } = await loadRoute();

    const res = await POST(
      new Request("http://localhost/api/free-scan/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com", source: "hero" }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.token).toBe("token_1");
  });

  it("returns 409 when the one-time claim is already used", async () => {
    claimFreeScan.mockResolvedValue({
      status: "already_used",
      claim: { token: "token_1", email: "user@example.com" },
    });
    const { POST } = await loadRoute();

    const res = await POST(
      new Request("http://localhost/api/free-scan/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      })
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("already_used");
  });

  it("returns existing token for unconsumed claim", async () => {
    claimFreeScan.mockResolvedValue({
      status: "existing",
      claim: { token: "token_existing", email: "user@example.com" },
    });
    const { POST } = await loadRoute();

    const res = await POST(
      new Request("http://localhost/api/free-scan/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("existing");
    expect(data.token).toBe("token_existing");
  });

  it("returns 400 for invalid email input", async () => {
    const { POST } = await loadRoute();

    const res = await POST(
      new Request("http://localhost/api/free-scan/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_email");
    expect(claimFreeScan).not.toHaveBeenCalled();
  });
});
