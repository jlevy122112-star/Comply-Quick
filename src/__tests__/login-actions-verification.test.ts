import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUp, sendVerificationEmail, verificationEmailConfigured, redirectMock } = vi.hoisted(() => ({
  signUp: vi.fn(),
  sendVerificationEmail: vi.fn(),
  verificationEmailConfigured: vi.fn(),
  redirectMock: vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp } }),
}));

vi.mock("@/lib/auth/verification-email", () => ({
  sendVerificationEmail,
  verificationEmailConfigured,
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => "https://app.example.com" }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { signupAction } from "@/app/login/actions";

function signupForm() {
  const form = new FormData();
  form.set("fullName", "Test User");
  form.set("companyName", "Test Co");
  form.set("email", "test@example.com");
  form.set("password", "password123");
  form.set("confirmPassword", "password123");
  form.set("redirect", "/dashboard/home");
  return form;
}

describe("signup verification delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verificationEmailConfigured.mockReturnValue(true);
    sendVerificationEmail.mockResolvedValue({ configured: true, delivered: true });
    signUp.mockResolvedValue({ data: { session: null, user: { id: "user-1" } }, error: null });
  });

  it("uses the app-owned link and preserves the confirmation notice", async () => {
    await expect(signupAction(signupForm())).rejects.toThrow(
      "REDIRECT:/login?mode=signin&notice=confirm&email=test%40example.com"
    );

    expect(sendVerificationEmail).toHaveBeenCalledWith({
      type: "signup",
      email: "test@example.com",
      password: "password123",
      metadata: { full_name: "Test User", company_name: "Test Co" },
      redirectTo: "https://app.example.com/auth/callback?redirect=%2Fdashboard%2Fhome&channel=signup",
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("falls back to Supabase signup when Resend is not configured", async () => {
    verificationEmailConfigured.mockReturnValue(false);

    await expect(signupAction(signupForm())).rejects.toThrow(
      "REDIRECT:/login?mode=signin&notice=confirm&email=test%40example.com"
    );
    expect(signUp).toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("routes an already registered address to the sign-in error state", async () => {
    sendVerificationEmail.mockResolvedValue({
      configured: true,
      delivered: false,
      reason: "already_registered",
    });

    await expect(signupAction(signupForm())).rejects.toThrow(
      "REDIRECT:/login?mode=signin&error=An%20account%20with%20this%20email%20already%20exists.%20Please%20sign%20in."
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it("keeps delivery failures on the confirmation notice so resend stays reachable", async () => {
    sendVerificationEmail.mockResolvedValue({
      configured: true,
      delivered: false,
      reason: "http_500",
    });

    await expect(signupAction(signupForm())).rejects.toThrow(
      "REDIRECT:/login?mode=signin&notice=confirm&email=test%40example.com&warning=resend"
    );
    expect(signUp).not.toHaveBeenCalled();
  });
});
