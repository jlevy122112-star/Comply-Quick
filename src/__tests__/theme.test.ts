import { describe, it, expect } from "vitest";
import { getBrandTokens, getPaletteClasses, tenantBrandFromOrganization } from "@/lib/theme";
import type { Organization, ThemePalette } from "@/lib/organizations";

describe("theme tokens", () => {
  it("resolves default brand tokens for every palette", () => {
    const palettes: ThemePalette[] = ["indigo", "emerald", "rose", "amber", "ocean", "forest", "slate"];
    for (const palette of palettes) {
      const tokens = getBrandTokens(palette);
      expect(tokens.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(tokens.primaryHover).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(tokens.primaryForeground).toBe("#ffffff");
      expect(tokens.ring).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("honors a custom primary color override", () => {
    const tokens = getBrandTokens("indigo", "#ff00ff");
    expect(tokens.primary).toBe("#ff00ff");
  });

  it("falls back to the palette color for invalid custom hex", () => {
    const tokens = getBrandTokens("emerald", "not-a-color");
    expect(tokens.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(tokens.primary).not.toBe("not-a-color");
  });

  it("exposes Tailwind-safe class bundles per palette", () => {
    const classes = getPaletteClasses("ocean");
    expect(classes.button).toContain("bg-sky-600");
    expect(classes.buttonHover).toContain("hover:bg-sky-500");
    expect(classes.badgeText).toContain("text-sky-300");
  });

  it("builds a tenant brand summary from an organization", () => {
    const org: Organization = {
      id: "org_1",
      ownerId: "u1",
      name: "Acme Agency",
      slug: "acme",
      plan: "enterprise",
      parentOrganizationId: null,
      isPersonal: false,
      logoUrl: "https://example.com/logo.png",
      faviconUrl: null,
      primaryColor: "#e11d48",
      themePalette: "rose",
      supportEmail: "support@acme.com",
      smtpFromEmail: "noreply@acme.com",
      smtpReplyToEmail: "support@acme.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const brand = tenantBrandFromOrganization(org);
    expect(brand.name).toBe("Acme Agency");
    expect(brand.logoUrl).toBe("https://example.com/logo.png");
    expect(brand.primaryColor).toBe("#e11d48");
    expect(brand.palette).toBe("rose");
    expect(brand.supportEmail).toBe("support@acme.com");
  });
});
