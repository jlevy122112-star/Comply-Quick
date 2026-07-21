import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Shared auth mocks used by both the browser client and the server action stubs.
const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
      signInWithOAuth: authMocks.signInWithOAuth,
      signInWithOtp: authMocks.signInWithOtp,
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
      updateUser: authMocks.updateUser,
    },
  }),
}));

vi.mock("@/app/login/actions", () => ({
  loginAction: async (formData: FormData) => {
    const { error } = await authMocks.signInWithPassword({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });
    if (error) return { error: error.message };
  },
  signupAction: async (formData: FormData) => {
    const password = String(formData.get("password"));
    if (password.length < 8) return { error: "Password must be at least 8 characters." };
    if (password !== String(formData.get("confirmPassword"))) return { error: "Passwords don't match." };
    await authMocks.signUp({ email: String(formData.get("email")), password });
  },
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockPrefetch = vi.fn();
const mockGetSearchParams = vi.fn().mockReturnValue(null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: mockPrefetch,
  }),
  useSearchParams: () => ({
    get: mockGetSearchParams,
  }),
}));

// Mock the server actions for onboarding
const mockRecommendOnboardingAction = vi.fn();
const mockCreateProjectFromOnboardingAction = vi.fn();

vi.mock("../app/dashboard/onboarding/actions", () => ({
  recommendOnboardingAction: (args: unknown) => mockRecommendOnboardingAction(args),
  createProjectFromOnboardingAction: (args: unknown) => mockCreateProjectFromOnboardingAction(args),
}));

// Import components to test
import LoginPageWrapper from "@/app/login/page";
import { OnboardingWizard } from "@/app/dashboard/onboarding/OnboardingWizard";

describe("E2E Login & Sign-up Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSearchParams.mockImplementation((key) => {
      if (key === "mode") return "signin";
      return null;
    });
  });

  it("should render sign-in form by default and switch to sign-up form on tab click", async () => {
    render(<LoginPageWrapper />);

    // Check we are in Sign in mode
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@agency.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your password")).toBeInTheDocument();

    // Switch to Sign Up
    const signUpTab = screen.getByRole("button", { name: /create account/i });
    await userEvent.click(signUpTab);

    // Verify fields updated for signup
    expect(screen.getByRole("heading", { name: /create your command center account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Jane Doe")).toBeInTheDocument(); // Full Name
    expect(screen.getByPlaceholderText("Acme Agency")).toBeInTheDocument(); // Company
    expect(screen.getByPlaceholderText("At least 8 characters")).toBeInTheDocument(); // Password
    expect(screen.getByPlaceholderText("Re-enter your password")).toBeInTheDocument(); // Confirm Password
  });

  it("should successfully trigger sign-in with email and password", async () => {
    authMocks.signInWithPassword.mockResolvedValue({ data: { user: {} }, error: null });

    render(<LoginPageWrapper />);

    const emailInput = screen.getByPlaceholderText("you@agency.com");
    const passwordInput = screen.getByPlaceholderText("Your password");
    const submitBtn = screen.getByRole("button", { name: /^sign in with email$/i });

    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "password123");
    await userEvent.click(submitBtn);

    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("should display error message on failed sign-in", async () => {
    authMocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Invalid credentials" } });

    render(<LoginPageWrapper />);

    const emailInput = screen.getByPlaceholderText("you@agency.com");
    const passwordInput = screen.getByPlaceholderText("Your password");
    const submitBtn = screen.getByRole("button", { name: /^sign in with email$/i });

    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "wrong-password");
    await userEvent.click(submitBtn);

    expect(authMocks.signInWithPassword).toHaveBeenCalled();
    const errorMsg = await screen.findByText("Invalid credentials");
    expect(errorMsg).toBeInTheDocument();
  });

  it("should validate passwords during sign-up", async () => {
    render(<LoginPageWrapper />);
    const signUpTab = screen.getByRole("button", { name: /create account/i });
    await userEvent.click(signUpTab);

    const emailInput = screen.getByPlaceholderText("you@agency.com");
    const passwordInput = screen.getByPlaceholderText("At least 8 characters");
    const confirmPasswordInput = screen.getByPlaceholderText("Re-enter your password");
    const submitBtn = screen.getByRole("button", { name: /^create account with email$/i });

    // Short password validation
    await userEvent.type(emailInput, "newuser@example.com");
    await userEvent.type(passwordInput, "short");
    await userEvent.type(confirmPasswordInput, "short");
    await userEvent.click(submitBtn);
    expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();

    // Mismatched password validation
    await userEvent.clear(passwordInput);
    await userEvent.clear(confirmPasswordInput);
    await userEvent.type(passwordInput, "password123");
    await userEvent.type(confirmPasswordInput, "password456");
    await userEvent.click(submitBtn);
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
  });

  it("should invoke magic link sign-in when requested", async () => {
    authMocks.signInWithOtp.mockResolvedValue({ error: null });

    render(<LoginPageWrapper />);

    const emailInput = screen.getByPlaceholderText("you@agency.com");
    await userEvent.type(emailInput, "magic@example.com");

    const magicLinkBtn = screen.getByRole("button", { name: /email me a magic link instead/i });
    await userEvent.click(magicLinkBtn);

    expect(authMocks.signInWithOtp).toHaveBeenCalledWith({
      email: "magic@example.com",
      options: expect.objectContaining({
        emailRedirectTo: expect.stringContaining("/auth/callback"),
      }),
    });

    expect(await screen.findByText("Check Your Email")).toBeInTheDocument();
  });
});

describe("E2E Onboarding Wizard Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should navigate through the onboarding steps: input details, get recommendation, and create project", async () => {
    // 1. Setup mock returns for step actions
    const mockRec = {
      industry: "saas",
      industryLabel: "SaaS Platform",
      rationale: "Requires standard data processing controls and SOC 2 tracking.",
      frameworks: ["nextjs"],
      regions: ["us_general", "eu_gdpr"],
      plan: {
        actions: [{ type: "configure_modules", detail: "Configure SOC 2 and GDPR controls", requiresApproval: true }],
      },
    };

    mockRecommendOnboardingAction.mockResolvedValue(mockRec);
    mockCreateProjectFromOnboardingAction.mockResolvedValue({ ok: true, projectId: "project-123" });

    render(<OnboardingWizard />);

    // Step 1: Business Profile
    expect(screen.getByRole("heading", { name: /tell us about your business/i })).toBeInTheDocument();

    const descTextarea = screen.getByRole("textbox", { name: /what does your product do\?/i });
    const getRecBtn = screen.getByRole("button", { name: /get recommendation/i });

    // Button should be disabled initially (description too short)
    expect(getRecBtn).toBeDisabled();

    // Type a valid description
    await userEvent.type(descTextarea, "We are building a cloud-based document sharing platform.");
    expect(getRecBtn).toBeEnabled();

    // Toggle one of the industry flags
    const toggleBtn = screen.getByText("We sell online / take payments");
    await userEvent.click(toggleBtn);

    // Request recommendation
    await userEvent.click(getRecBtn);

    await waitFor(() => {
      expect(mockRecommendOnboardingAction).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "We are building a cloud-based document sharing platform.",
          sellsOnline: true,
        })
      );
    });

    // Step 2: Recommendation Review
    expect(await screen.findByText("Recommended setup")).toBeInTheDocument();
    expect(screen.getByText("SaaS Platform")).toBeInTheDocument();
    expect(screen.getByText("Requires standard data processing controls and SOC 2 tracking.")).toBeInTheDocument();

    // Check recommendations rendered
    expect(screen.getByText("NEXTJS")).toBeInTheDocument();
    expect(screen.getByText("United States")).toBeInTheDocument();
    expect(screen.getByText("European Union (GDPR)")).toBeInTheDocument();
    expect(screen.getByText("Configure SOC 2 and GDPR controls")).toBeInTheDocument();

    // Modify project name
    const projectNameInput = screen.getByPlaceholderText("SaaS Platform project");
    await userEvent.type(projectNameInput, "My Document App");

    // Click Approve & Create Project
    const approveBtn = screen.getByRole("button", { name: /approve & create project/i });
    await userEvent.click(approveBtn);

    await waitFor(() => {
      expect(mockCreateProjectFromOnboardingAction).toHaveBeenCalledWith({
        answers: expect.objectContaining({
          description: "We are building a cloud-based document sharing platform.",
          sellsOnline: true,
        }),
        framework: "nextjs",
        projectName: "My Document App",
      });
    });

    // Assert redirect happened
    expect(mockPush).toHaveBeenCalledWith("/dashboard/projects/project-123");
  });
});
