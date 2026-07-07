import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase session refresh so we can detect when a request is treated
// as a PRIMARY host (proxy falls through to updateSession) vs. rewritten to the
// white-label portal (a client custom domain).
const updateSessionMock = vi.fn();
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (...args: unknown[]) => updateSessionMock(...args),
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function requestForHost(host: string): NextRequest {
  return new NextRequest(`https://${host}/`, { headers: { host } });
}

describe("proxy primary-host routing", () => {
  beforeEach(() => {
    updateSessionMock.mockReset();
    updateSessionMock.mockReturnValue("SESSION");
  });

  it("treats the product domain (apex + www) as primary even when NEXT_PUBLIC_APP_HOST is unset", async () => {
    // Regression guard: an unset NEXT_PUBLIC_APP_HOST must NOT route the app's
    // own marketing site into the portal (which 404s the entire site).
    for (const host of ["comply-quick.com", "www.comply-quick.com"]) {
      updateSessionMock.mockClear();
      const res = await proxy(requestForHost(host));
      expect(updateSessionMock).toHaveBeenCalledTimes(1);
      expect(res).toBe("SESSION");
    }
  });

  it("treats localhost and Vercel preview hosts as primary", async () => {
    for (const host of ["localhost", "comply-quick-abc123.vercel.app"]) {
      updateSessionMock.mockClear();
      const res = await proxy(requestForHost(host));
      expect(updateSessionMock).toHaveBeenCalledTimes(1);
      expect(res).toBe("SESSION");
    }
  });

  it("rewrites an unknown client custom domain to the white-label portal", async () => {
    const res = await proxy(requestForHost("clientsite.example"));
    expect(updateSessionMock).not.toHaveBeenCalled();
    expect(res.headers.get("x-middleware-rewrite") ?? "").toContain("/portal/domain/clientsite.example");
  });
});
