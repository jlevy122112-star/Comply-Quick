import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const AES_KEY_BYTES = 32;
const AES_IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const WRAPPED_KEY_FORMAT = "wk1";

export const TENANT_ENCRYPTION_PROVIDER_ENV = "TENANT_ENCRYPTION_PROVIDER";
export const TENANT_ENCRYPTION_KEK_ENV = "TENANT_ENCRYPTION_KEK";
export const TENANT_ENCRYPTION_KEK_VERSION_ENV = "TENANT_ENCRYPTION_KEK_VERSION";

export interface KeyProvider {
  readonly id: string;
  readonly version: string;
  wrapDek(dek: Buffer): Promise<string>;
  unwrapDek(wrappedDek: string): Promise<Buffer>;
}

export interface KeyProviderInfo {
  id: "env" | "kms";
  version: string;
  configured: boolean;
}

function base64UrlEncode(value: Buffer): string {
  return value.toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function assertDek(dek: Buffer): void {
  if (!Buffer.isBuffer(dek) || dek.length !== AES_KEY_BYTES) {
    throw new Error("Tenant DEK must be exactly 32 bytes.");
  }
}

function parseWrappedDek(wrappedDek: string): {
  version: string;
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
} {
  const parts = wrappedDek.split(".");
  if (parts.length !== 6 || parts[0] !== WRAPPED_KEY_FORMAT) {
    throw new Error("Invalid wrapped DEK format.");
  }

  const [, provider, version, ivEncoded, tagEncoded, ciphertextEncoded] = parts;
  if (provider !== "env" || !version) throw new Error("Unsupported wrapped DEK provider.");

  const iv = base64UrlDecode(ivEncoded);
  const tag = base64UrlDecode(tagEncoded);
  const ciphertext = base64UrlDecode(ciphertextEncoded);
  if (iv.length !== AES_IV_BYTES || tag.length !== AUTH_TAG_BYTES || ciphertext.length === 0) {
    throw new Error("Invalid wrapped DEK payload.");
  }
  return { version, iv, tag, ciphertext };
}

/** Local development provider. The KEK is supplied as base64-encoded 32 bytes. */
export class EnvKeyProvider implements KeyProvider {
  readonly id = "env" as const;
  readonly version: string;
  private readonly kek: Buffer;

  constructor(options: { keyBase64?: string; version?: string } = {}) {
    const keyBase64 = options.keyBase64 ?? process.env[TENANT_ENCRYPTION_KEK_ENV];
    const version = options.version ?? process.env[TENANT_ENCRYPTION_KEK_VERSION_ENV] ?? "v1";
    if (!keyBase64) {
      throw new Error(`Missing ${TENANT_ENCRYPTION_KEK_ENV}; configure a base64 32-byte KEK.`);
    }

    const kek = Buffer.from(keyBase64, "base64");
    if (kek.length !== AES_KEY_BYTES) {
      throw new Error(`${TENANT_ENCRYPTION_KEK_ENV} must decode to exactly 32 bytes.`);
    }
    if (!/^[A-Za-z0-9._-]+$/.test(version)) {
      throw new Error("Tenant encryption KEK version contains unsupported characters.");
    }

    this.kek = kek;
    this.version = version;
  }

  async wrapDek(dek: Buffer): Promise<string> {
    assertDek(dek);
    const iv = randomBytes(AES_IV_BYTES);
    const aad = Buffer.from(`${WRAPPED_KEY_FORMAT}:env:${this.version}`, "utf8");
    const cipher = createCipheriv("aes-256-gcm", this.kek, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      WRAPPED_KEY_FORMAT,
      "env",
      this.version,
      base64UrlEncode(iv),
      base64UrlEncode(tag),
      base64UrlEncode(ciphertext),
    ].join(".");
  }

  async unwrapDek(wrappedDek: string): Promise<Buffer> {
    const parsed = parseWrappedDek(wrappedDek);
    if (parsed.version !== this.version) {
      throw new Error(`Wrapped DEK requires KEK version ${parsed.version}; configured version is ${this.version}.`);
    }
    const aad = Buffer.from(`${WRAPPED_KEY_FORMAT}:env:${this.version}`, "utf8");
    const decipher = createDecipheriv("aes-256-gcm", this.kek, parsed.iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(parsed.tag);
    const dek = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]);
    assertDek(dek);
    return dek;
  }
}

/** KMS seam for a later AWS KMS implementation; no network calls are made yet. */
export class KmsKeyProvider implements KeyProvider {
  readonly id = "kms" as const;
  readonly version: string;

  constructor(version = "v1") {
    this.version = version;
  }

  async wrapDek(dek: Buffer): Promise<string> {
    void dek;
    throw new Error("KMS key provider is not configured; AWS KMS integration is not available in this release.");
  }

  async unwrapDek(wrappedDek: string): Promise<Buffer> {
    void wrappedDek;
    throw new Error("KMS key provider is not configured; AWS KMS integration is not available in this release.");
  }
}

export function getKeyProviderInfo(): KeyProviderInfo {
  const id = process.env[TENANT_ENCRYPTION_PROVIDER_ENV]?.trim().toLowerCase() === "kms" ? "kms" : "env";
  const version = process.env[TENANT_ENCRYPTION_KEK_VERSION_ENV] ?? "v1";
  if (id === "kms") return { id, version, configured: false };

  try {
    new EnvKeyProvider();
    return { id, version, configured: true };
  } catch {
    return { id, version, configured: false };
  }
}

export function getKeyProvider(): KeyProvider {
  const id = process.env[TENANT_ENCRYPTION_PROVIDER_ENV]?.trim().toLowerCase();
  if (id === "kms") return new KmsKeyProvider(process.env[TENANT_ENCRYPTION_KEK_VERSION_ENV] ?? "v1");
  return new EnvKeyProvider();
}
