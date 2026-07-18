import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptWithDek, encryptWithDek } from "@/lib/security/envelope";
import { EnvKeyProvider, KmsKeyProvider, getKeyProvider, type KeyProvider } from "@/lib/security/key-provider";
import { resolveTenantConnection } from "@/lib/security/tenant-connection";
import { clearTenantEncryptionCache, decryptField, encryptField } from "@/lib/security/tenant-keys";

const adminRows = new Map<string, Record<string, unknown>>();

vi.mock("@/lib/entitlements", () => ({
  getOrgEntitlement: vi.fn(async () => ({
    tier: "enterprise",
    status: "active",
    isPremium: true,
    isEnterprise: true,
    currentPeriodEnd: null,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, value: string) => ({
          eq: (_statusColumn: string, status: string) => ({
            maybeSingle: async () => ({
              data:
                [...adminRows.values()].find((row) => row.organization_id === value && row.status === status) ?? null,
              error: null,
            }),
          }),
        }),
      }),
      insert: (values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (adminRows.has(String(values.organization_id))) {
              return { data: null, error: { message: "duplicate key" } };
            }
            const row = { ...values, last_rotated_at: null };
            adminRows.set(String(values.organization_id), row);
            return { data: row, error: null };
          },
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: (_column: string, orgId: string) => ({
          eq: (_statusColumn: string, status: string) => ({
            select: () => ({
              single: async () => {
                const row = adminRows.get(orgId);
                if (!row || row.status !== status) return { data: null, error: { message: "not found" } };
                Object.assign(row, values);
                return { data: row, error: null };
              },
            }),
          }),
        }),
      }),
    }),
  })),
}));

describe("envelope encryption", () => {
  const orgId = "org-a";
  const otherOrgId = "org-b";
  const dek = randomBytes(32);

  beforeEach(() => {
    vi.stubEnv("TENANT_ENCRYPTION_KEK", randomBytes(32).toString("base64"));
    vi.stubEnv("TENANT_ENCRYPTION_KEK_VERSION", "v1");
    vi.stubEnv("TENANT_ENCRYPTION_PROVIDER", "env");
    vi.stubEnv("TENANT_DEDICATED_CONNECTIONS_JSON", "");
    adminRows.clear();
    clearTenantEncryptionCache();
  });

  it("round-trips plaintext through AES-256-GCM", () => {
    const payload = encryptWithDek(orgId, "sensitive policy text", dek);
    expect(payload.startsWith("ef1.")).toBe(true);
    expect(decryptWithDek(orgId, payload, dek)).toBe("sensitive policy text");
  });

  it("binds ciphertext to the tenant and rejects tampering", () => {
    const payload = encryptWithDek(orgId, "tenant secret", dek);
    expect(() => decryptWithDek(otherOrgId, payload, dek)).toThrow();
    const parts = payload.split(".");
    parts[2] = `${parts[2]}x`;
    expect(() => decryptWithDek(orgId, parts.join("."), dek)).toThrow();
  });

  it("wraps and unwraps DEKs without persisting plaintext key material", async () => {
    const provider = new EnvKeyProvider();
    const wrapped = await provider.wrapDek(dek);
    expect(wrapped).not.toContain(dek.toString("base64"));
    expect(await provider.unwrapDek(wrapped)).toEqual(dek);
  });

  it("rejects KEK versions containing the wrapped-DEK delimiter", () => {
    expect(() => new EnvKeyProvider({ version: "v1.2" })).toThrow(
      "Tenant encryption KEK version contains unsupported characters."
    );
  });

  it("supports provider swapping through the common interface", async () => {
    const providerA = new EnvKeyProvider({ keyBase64: randomBytes(32).toString("base64"), version: "a" });
    const providerB = new EnvKeyProvider({ keyBase64: randomBytes(32).toString("base64"), version: "b" });
    const wrapped = await providerA.wrapDek(dek);
    expect(await providerA.unwrapDek(wrapped)).toEqual(dek);
    await expect(providerB.unwrapDek(wrapped)).rejects.toThrow();

    const customProvider: KeyProvider = {
      id: "test",
      version: "v1",
      wrapDek: async (value) => `test:${value.toString("base64url")}`,
      unwrapDek: async (value) => Buffer.from(value.slice("test:".length), "base64url"),
    };
    const customWrapped = await customProvider.wrapDek(dek);
    expect(await customProvider.unwrapDek(customWrapped)).toEqual(dek);
  });

  it("exposes a descriptive KMS configuration error", async () => {
    await expect(new KmsKeyProvider().wrapDek(dek)).rejects.toThrow("KMS key provider is not configured");
  });

  it("returns a dedicated connection override only when configured", () => {
    expect(resolveTenantConnection(orgId)).toBeNull();
    vi.stubEnv("TENANT_DEDICATED_CONNECTIONS_JSON", JSON.stringify({ [orgId]: "postgres://dedicated" }));
    expect(resolveTenantConnection(orgId)).toBe("postgres://dedicated");
    expect(resolveTenantConnection(otherOrgId)).toBeNull();
  });

  it("selects the configured provider", () => {
    expect(getKeyProvider()).toBeInstanceOf(EnvKeyProvider);
    vi.stubEnv("TENANT_ENCRYPTION_PROVIDER", "kms");
    expect(getKeyProvider()).toBeInstanceOf(KmsKeyProvider);
  });

  it("persists only a wrapped DEK and isolates tenant ciphertext", async () => {
    const payload = await encryptField(orgId, "organization A secret");
    const persisted = adminRows.get(orgId);
    expect(persisted?.wrapped_dek).toBeTypeOf("string");
    expect(persisted).not.toHaveProperty("dek");
    expect(persisted?.wrapped_dek).not.toContain("organization A secret");
    expect(await decryptField(orgId, payload)).toBe("organization A secret");

    const otherPayload = await encryptField(otherOrgId, "organization B secret");
    expect(await decryptField(otherOrgId, otherPayload)).toBe("organization B secret");
    await expect(decryptField(otherOrgId, payload)).rejects.toThrow();
  });
});
