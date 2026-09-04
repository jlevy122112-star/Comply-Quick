import type { ThemePalette } from "@/lib/organizations";

export interface DeliverableBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  palette: ThemePalette;
  supportEmail: string | null;
  footerText: string;
}

interface WorkspaceBrandSource {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  themePalette: ThemePalette;
  footerText: string | null;
}

interface OrganizationBrandSource {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  themePalette: ThemePalette;
  supportEmail: string | null;
}

const DEFAULT_PRIMARY = "#4f46e5";

export function defaultDeliverableFooter(name: string): string {
  return `Prepared by ${name} with Comply-Quick.`;
}

export function safeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function resolveWorkspaceDeliverableBranding({
  workspace,
  organization,
}: {
  workspace?: WorkspaceBrandSource | null;
  organization?: OrganizationBrandSource | null;
}): DeliverableBranding {
  const name = workspace?.name || organization?.name || "Comply-Quick";
  return {
    name,
    logoUrl: workspace?.logoUrl ?? organization?.logoUrl ?? null,
    primaryColor: workspace?.primaryColor || organization?.primaryColor || DEFAULT_PRIMARY,
    palette: workspace?.themePalette ?? organization?.themePalette ?? "indigo",
    supportEmail: organization?.supportEmail ?? null,
    footerText: workspace?.footerText?.trim() || defaultDeliverableFooter(name),
  };
}
