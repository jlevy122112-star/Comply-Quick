export const TENANT_CONNECTION_OVERRIDES_ENV = "TENANT_DEDICATED_CONNECTIONS_JSON";

/**
 * Future physical-isolation seam. Values are read-only connection strings
 * supplied by deployment configuration and never persisted in the database.
 */
export function resolveTenantConnection(orgId: string): string | null {
  const raw = process.env[TENANT_CONNECTION_OVERRIDES_ENV];
  if (!raw) return null;

  try {
    const overrides = JSON.parse(raw) as unknown;
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return null;
    const value = (overrides as Record<string, unknown>)[orgId];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}
