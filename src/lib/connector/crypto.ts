// OAuth Compliance Connector — token encryption at rest.
//
// Access/refresh tokens are secrets and must never be stored in plaintext. This
// wraps AES-256-GCM (authenticated encryption) using a key sourced from the
// CONNECTOR_TOKEN_KEY environment variable (32 bytes, base64 or hex). The
// output is a self-describing string: v1:<iv>:<authTag>:<ciphertext> (all
// base64). Decryption verifies the auth tag, so tampering is detected.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

/** Resolves and validates the 32-byte encryption key from the environment. */
export function resolveTokenKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.CONNECTOR_TOKEN_KEY;
  if (!raw) throw new Error("CONNECTOR_TOKEN_KEY is not set");
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CONNECTOR_TOKEN_KEY must decode to 32 bytes");
  return key;
}

/** Encrypts a plaintext secret; returns `v1:iv:tag:ciphertext` (base64 parts). */
export function encryptToken(plaintext: string, key: Buffer = resolveTokenKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/** Decrypts a value produced by {@link encryptToken}; throws on tamper/format errors. */
export function decryptToken(encoded: string, key: Buffer = resolveTokenKey()): string {
  const parts = encoded.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("malformed encrypted token");
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
