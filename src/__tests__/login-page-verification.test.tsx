import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { resendConfirmationAction, magicLinkAction, loginAction, signupAction } = vi.hoisted(() => ({
  resendConfirmationAction: vi.fn(),
  magicLinkAction: vi.fn(),
  loginAction: vi.fn(),
  signupAction: vi.fn(),
}));

vi.mock("@/app/login/actions", () => ({
  resendConfirmationAction,
  magicLinkAction,
  loginAction,
  signupAction,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOtp: vi.fn(), resend: vi.fn() } }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === "mode") return "signin";
      if (key === "notice") return "confirm";
      if (key === "email") return "member@example.com";
      if (key === "warning") return "resend";
      return null;
    },
  }),
}));

import LoginPageWrapper from "@/app/login/page";

describe("login confirmation notice", () => {
  it("shows the resend warning and acknowledges a successful resend", async () => {
    resendConfirmationAction.mockResolvedValue({ configured: true, delivered: true });

    render(<LoginPageWrapper />);

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't send the first confirmation email/i);
    await userEvent.click(screen.getByRole("button", { name: /resend confirmation email/i }));

    expect(resendConfirmationAction).toHaveBeenCalledWith("member@example.com", "/dashboard/home");
    expect(await screen.findByRole("status")).toHaveTextContent(/confirmation email sent/i);
  });
});
