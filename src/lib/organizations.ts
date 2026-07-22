// Lightweight organization types and constants shared between server and client.
// Keep this module free of server-only imports (next/headers, etc.) so it can be
// safely imported by client components and hooks.

export type ThemePalette = "indigo" | "emerald" | "rose" | "amber" | "ocean" | "forest" | "slate";

export const THEME_PALETTES: ThemePalette[] = [
  "indigo",
  "emerald",
  "rose",
  "amber",
  "ocean",
  "forest",
  "slate",
];

export type OrganizationKind = "organization" | "department" | "region";

export interface Organization {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  plan: "free" | "team" | "enterprise";
  parentOrganizationId: string | null;
  isPersonal: boolean;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  themePalette: ThemePalette;
  supportEmail: string | null;
  smtpFromEmail: string | null;
  smtpReplyToEmail: string | null;
  createdAt: string;
  updatedAt: string;
  kind: OrganizationKind | null;
}
