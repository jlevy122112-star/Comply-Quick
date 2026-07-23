import type { Organization, ThemePalette } from "@/lib/organizations";

export interface BrandTokens {
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  surface: string;
  surfaceForeground: string;
  ring: string;
}

const HEX_LIGHTEN: Record<string, string> = {
  indigo: "#6366f1",
  emerald: "#34d399",
  rose: "#fb7185",
  amber: "#fbbf24",
  ocean: "#38bdf8",
  forest: "#a3e635",
  slate: "#94a3b8",
};

const HEX_BASE: Record<ThemePalette, string> = {
  indigo: "#4f46e5",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#d97706",
  ocean: "#0284c7",
  forest: "#4d7c0f",
  slate: "#475569",
};

const HEX_HOVER: Record<ThemePalette, string> = {
  indigo: "#4338ca",
  emerald: "#047857",
  rose: "#be123c",
  amber: "#b45309",
  ocean: "#0369a1",
  forest: "#3f6212",
  slate: "#334155",
};

const HEX_ACCENT: Record<ThemePalette, string> = {
  indigo: "#10b981",
  emerald: "#0ea5e9",
  rose: "#8b5cf6",
  amber: "#14b8a6",
  ocean: "#f59e0b",
  forest: "#22c55e",
  slate: "#64748b",
};

function hex(palette: ThemePalette): string {
  return HEX_BASE[palette];
}

function hoverHex(palette: ThemePalette): string {
  return HEX_HOVER[palette];
}

function lighten(palette: ThemePalette): string {
  return HEX_LIGHTEN[palette];
}

function accentHex(palette: ThemePalette): string {
  return HEX_ACCENT[palette];
}

/** Resolves a full token set for a given palette. */
export function getBrandTokens(palette: ThemePalette, customPrimary?: string | null): BrandTokens {
  const primary = customPrimary && /^#[0-9a-fA-F]{6}$/.test(customPrimary) ? customPrimary : hex(palette);
  const primaryHover = customPrimary ? customPrimary : hoverHex(palette);
  return {
    primary,
    primaryHover,
    primaryForeground: "#ffffff",
    accent: accentHex(palette),
    accentForeground: "#ffffff",
    surface: "#0a0a0a",
    surfaceForeground: "#ededed",
    ring: lighten(palette),
  };
}

/** Converts tokens to a flat record of CSS variable names and values. */
export function tokensToCssVariables(tokens: BrandTokens): Record<string, string> {
  return {
    "--brand-primary": tokens.primary,
    "--brand-primary-hover": tokens.primaryHover,
    "--brand-primary-foreground": tokens.primaryForeground,
    "--brand-accent": tokens.accent,
    "--brand-accent-foreground": tokens.accentForeground,
    "--brand-surface": tokens.surface,
    "--brand-surface-foreground": tokens.surfaceForeground,
    "--brand-ring": tokens.ring,
  };
}

export function getBrandCssVariables(palette: ThemePalette, customPrimary?: string | null): Record<string, string> {
  return tokensToCssVariables(getBrandTokens(palette, customPrimary));
}

/** Tailwind class bundles for the built-in palettes (safe for JIT scanning). */
export interface PaletteClasses {
  button: string;
  buttonHover: string;
  buttonText: string;
  ring: string;
  badgeBg: string;
  badgeText: string;
  lightBorder: string;
}

export const PALETTE_CLASSES: Record<ThemePalette, PaletteClasses> = {
  indigo: {
    button: "bg-indigo-600",
    buttonHover: "hover:bg-indigo-500",
    buttonText: "text-white",
    ring: "ring-indigo-500",
    badgeBg: "bg-indigo-900/40",
    badgeText: "text-indigo-300",
    lightBorder: "border-indigo-400/30",
  },
  emerald: {
    button: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-500",
    buttonText: "text-white",
    ring: "ring-emerald-500",
    badgeBg: "bg-emerald-900/40",
    badgeText: "text-emerald-300",
    lightBorder: "border-emerald-400/30",
  },
  rose: {
    button: "bg-rose-600",
    buttonHover: "hover:bg-rose-500",
    buttonText: "text-white",
    ring: "ring-rose-500",
    badgeBg: "bg-rose-900/40",
    badgeText: "text-rose-300",
    lightBorder: "border-rose-400/30",
  },
  amber: {
    button: "bg-amber-600",
    buttonHover: "hover:bg-amber-500",
    buttonText: "text-white",
    ring: "ring-amber-500",
    badgeBg: "bg-amber-900/40",
    badgeText: "text-amber-300",
    lightBorder: "border-amber-400/30",
  },
  ocean: {
    button: "bg-sky-600",
    buttonHover: "hover:bg-sky-500",
    buttonText: "text-white",
    ring: "ring-sky-500",
    badgeBg: "bg-sky-900/40",
    badgeText: "text-sky-300",
    lightBorder: "border-sky-400/30",
  },
  forest: {
    button: "bg-lime-700",
    buttonHover: "hover:bg-lime-600",
    buttonText: "text-white",
    ring: "ring-lime-600",
    badgeBg: "bg-lime-900/40",
    badgeText: "text-lime-300",
    lightBorder: "border-lime-400/30",
  },
  slate: {
    button: "bg-slate-600",
    buttonHover: "hover:bg-slate-500",
    buttonText: "text-white",
    ring: "ring-slate-500",
    badgeBg: "bg-slate-800/60",
    badgeText: "text-slate-300",
    lightBorder: "border-slate-400/30",
  },
};

export function getPaletteClasses(palette: ThemePalette): PaletteClasses {
  return PALETTE_CLASSES[palette];
}

/** Brand summary useful for headers, previews, and email footers. */
export interface TenantBrand {
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  palette: ThemePalette;
  supportEmail: string | null;
}

export function tenantBrandFromOrganization(org: Organization): TenantBrand {
  return {
    name: org.name,
    logoUrl: org.logoUrl,
    faviconUrl: org.faviconUrl,
    primaryColor: org.primaryColor,
    palette: org.themePalette,
    supportEmail: org.supportEmail,
  };
}

/** Inline style object for an organization's primary brand color. */
export function primaryStyle(org: Pick<Organization, "primaryColor">): React.CSSProperties {
  return { color: org.primaryColor };
}

/** Inline style object for an organization's primary background. */
export function primaryBackgroundStyle(org: Pick<Organization, "primaryColor">): React.CSSProperties {
  return { backgroundColor: org.primaryColor };
}
