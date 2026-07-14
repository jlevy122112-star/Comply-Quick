import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// Mock router / searchParams
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

// Mock the actions
const mockSaveProjectAction = vi.fn();
vi.mock("../app/dashboard/actions", () => ({
  saveProjectAction: (args: unknown) => mockSaveProjectAction(args),
}));

// Mock clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: mockWriteText,
  },
  writable: true,
});

import DashboardWizard from "@/app/dashboard/DashboardWizard";

describe("E2E Compliance Wizard Workflow (Free Preview)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should go through all 5 steps of the wizard and show the paywall screen", async () => {
    render(<DashboardWizard isPremium={false} isAuthenticated={true} tier="solo" />);

    // --- Step 1: User Type ---
    expect(screen.getByText("Who are you?")).toBeInTheDocument();
    const developerBtn = screen.getByRole("button", { name: /Developer/i });
    await userEvent.click(developerBtn);

    // --- Step 2: Choose framework ---
    expect(screen.getByText("Choose your framework")).toBeInTheDocument();
    const nextjsBtn = screen.getByRole("button", { name: /Next\.js/i });
    await userEvent.click(nextjsBtn);

    // --- Step 3: Tracking Pixels ---
    expect(screen.getByText("Active tracking pixels")).toBeInTheDocument();
    // Select Google Analytics and LinkedIn
    const googleBtn = screen.getByRole("button", { name: /Google Analytics/i });
    const linkedinBtn = screen.getByRole("button", { name: /LinkedIn/i });
    await userEvent.click(googleBtn);
    await userEvent.click(linkedinBtn);

    // Click Continue
    const continueBtn3 = screen.getByRole("button", { name: /Continue/i });
    await userEvent.click(continueBtn3);

    // --- Step 4: Target Regions ---
    expect(screen.getByText("Target regions")).toBeInTheDocument();
    // Select US General and EU (GDPR)
    const usBtn = screen.getByRole("button", { name: /US General/i });
    const euBtn = screen.getByRole("button", { name: /EU \(GDPR\)/i });
    await userEvent.click(usBtn);
    await userEvent.click(euBtn);

    // Click Continue
    const continueBtn4 = screen.getByRole("button", { name: /Continue/i });
    await userEvent.click(continueBtn4);

    // --- Step 5: Enterprise Compliance Modules ---
    expect(screen.getByText("Enterprise compliance modules")).toBeInTheDocument();
    // Select HIPAA
    const hipaaBtn = screen.getByRole("button", { name: /HIPAA/i });
    await userEvent.click(hipaaBtn);

    // Click Generate Compliance Package
    const generateBtn = screen.getByRole("button", { name: /Generate Compliance Package/i });
    await userEvent.click(generateBtn);

    // --- Step 6: Results with Paywall ---
    // Check compliance score title and ring overall score render
    expect(screen.getByRole("heading", { name: /Compliance Score/i })).toBeInTheDocument();

    // Free preview is visible (Inward Contract Shield)
    expect(screen.getByRole("heading", { name: /Inward Contract Shield/i })).toBeInTheDocument();

    // Paywall Gate is visible
    expect(screen.getByText("Your package is ready.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Solo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agency/i })).toBeInTheDocument();

    // Premium elements should NOT be fully unlocked (or not copyable / they are blurred behind paywall)
    expect(screen.queryByRole("button", { name: /Download as Markdown/i })).not.toBeInTheDocument();
  });
});

describe("E2E Compliance Wizard Workflow (Premium/Unlocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should complete wizard and show fully unlocked premium results", async () => {
    render(<DashboardWizard isPremium={true} isAuthenticated={true} tier="agency" />);

    // Step 1: User Type
    const developerBtn = screen.getByRole("button", { name: /Developer/i });
    await userEvent.click(developerBtn);

    // Step 2: Choose framework
    const nextjsBtn = screen.getByRole("button", { name: /Next\.js/i });
    await userEvent.click(nextjsBtn);

    // Step 3: Tracking Pixels
    const continueBtn3 = screen.getByRole("button", { name: /Continue/i });
    await userEvent.click(continueBtn3);

    // Step 4: Target Regions
    const usBtn = screen.getByRole("button", { name: /US General/i });
    await userEvent.click(usBtn);
    const continueBtn4 = screen.getByRole("button", { name: /Continue/i });
    await userEvent.click(continueBtn4);

    // Step 5: Enterprise Compliance Modules
    const generateBtn = screen.getByRole("button", { name: /Generate Compliance Package/i });
    await userEvent.click(generateBtn);

    // Step 6: Unlocked Results
    expect(screen.getByRole("heading", { name: /Compliance Score/i })).toBeInTheDocument();

    // Privacy policy and pre-launch checklists are unlocked
    expect(screen.getByRole("heading", { name: /Consumer Privacy Policy Addendum/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Developer Pre-Launch Checklist/i })).toBeInTheDocument();

    // Export buttons are visible
    expect(screen.getByRole("button", { name: /Download as Markdown/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Over/i })).toBeInTheDocument();

    // Paywall Gate is NOT visible
    expect(screen.queryByText("Your package is ready.")).not.toBeInTheDocument();

    // Check project save action was called server-side
    expect(mockSaveProjectAction).toHaveBeenCalled();
  });
});
