import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const AES_KEY_BYTES = 32;
const AES_IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
export const ENVELOPE_FORMAT_VERSION = "ef1";

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function assertDek(dek: Buffer): void {
  if (!Buffer.isBuffer(dek) || dek.length !== AES_KEY_BYTES) {
    throw new Error("Tenant DEK must be exactly 32 bytes.");
  }
}

function aadForOrganization(orgId: string): Buffer {
  return Buffer.from(`${ENVELOPE_FORMAT_VERSION}:${orgId}`, "utf8");
}

/** Encrypts one field as ef1.<iv>.<auth-tag>.<ciphertext>. */
export function encryptWithDek(orgId: string, plaintext: string, dek: Buffer): string {
  assertDek(dek);
  const iv = randomBytes(AES_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  cipher.setAAD(aadForOrganization(orgId));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENVELOPE_FORMAT_VERSION, encode(iv), encode(tag), encode(ciphertext)].join(".");
}

/** Decrypts and authenticates a field payload, binding it to the organization id. */
export function decryptWithDek(orgId: string, payload: string, dek: Buffer): string {
  assertDek(dek);
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== ENVELOPE_FORMAT_VERSION) {
    throw new Error("Invalid encrypted field payload.");
  }

  const iv = decode(parts[1]);
  const tag = decode(parts[2]);
  const ciphertext = decode(parts[3]);
  if (iv.length !== AES_IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new Error("Invalid encrypted field payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAAD(aadForOrganization(orgId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
