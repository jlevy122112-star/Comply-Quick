import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateLink, sendTransactionalEmail } = vi.hoisted(() => ({
  generateLink: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink } } }),
}));

vi.mock("@/lib/email/send", () => ({
  sendTransactionalEmail,
}));

import { sendVerificationEmail } from "@/lib/auth/verification-email";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("NOTIFICATIONS_FROM_EMAIL", "no-reply@example.com");
    generateLink.mockResolvedValue({
      data: { properties: { action_link: "https://example.com/auth/callback?code=secret" } },
      error: null,
    });
    sendTransactionalEmail.mockResolvedValue({ delivered: true });
  });

  it("mints a signup link and sends it through the transactional email provider", async () => {
    const result = await sendVerificationEmail({
      type: "signup",
      email: "new@example.com",
      password: "password123",
      metadata: { full_name: "New User" },
      redirectTo: "https://example.com/auth/callback?redirect=%2Fdashboard",
    });

    expect(result).toEqual({ configured: true, delivered: true, reason: undefined });
    expect(generateLink).toHaveBeenCalledWith({
      type: "signup",
      email: "new@example.com",
      password: "password123",
      options: {
        data: { full_name: "New User" },
        redirectTo: "https://example.com/auth/callback?redirect=%2Fdashboard",
      },
    });
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
        subject: "Confirm your Comply-Quick email",
        html: expect.stringContaining("https://example.com/auth/callback?code=secret"),
        text: expect.stringContaining("https://example.com/auth/callback?code=secret"),
      })
    );
  });

  it("uses a magic-link generateLink request", async () => {
    await sendVerificationEmail({
      type: "magiclink",
      email: "member@example.com",
      redirectTo: "https://example.com/auth/callback?redirect=%2Fdashboard",
    });

    expect(generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "member@example.com",
      options: { redirectTo: "https://example.com/auth/callback?redirect=%2Fdashboard" },
    });
  });

  it("returns a safe unconfigured result without calling admin auth or email delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("NOTIFICATIONS_FROM_EMAIL", "");

    await expect(
      sendVerificationEmail({
        type: "magiclink",
        email: "member@example.com",
        redirectTo: "https://example.com/auth/callback",
      })
    ).resolves.toEqual({ configured: false, delivered: false, reason: "not_configured" });
    expect(generateLink).not.toHaveBeenCalled();
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("classifies an already registered signup without throwing", async () => {
    generateLink.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });

    await expect(
      sendVerificationEmail({
        type: "signup",
        email: "existing@example.com",
        password: "password123",
        redirectTo: "https://example.com/auth/callback",
      })
    ).resolves.toEqual({ configured: true, delivered: false, reason: "already_registered" });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
});
