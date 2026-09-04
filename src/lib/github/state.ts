import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { GitHubInstallFlow } from "./app-service";

const VERSION = "v2";

export interface GitHubStatePayload {
  organizationId: string;
  flow: GitHubInstallFlow;
  repoFullName?: string | null;
  repositoryId?: number | null;
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function signState(secret: string, payload: GitHubStatePayload): string {
  const encoded = encodeBase64Url(
    JSON.stringify({
      v: VERSION,
      organizationId: payload.organizationId,
      flow: payload.flow,
      repoFullName: payload.repoFullName ?? null,
      repositoryId: payload.repositoryId ?? null,
      nonce: randomBytes(8).toString("hex"),
    })
  );
  const sig = createHmac("sha256", secret).update(encoded).digest("hex").slice(0, 16);
  return `${VERSION}.${encoded}.${sig}`;
}

export function verifyState(secret: string, state: string): GitHubStatePayload | null {
  const [version, encoded, sig] = state.split(".");
  if (version !== VERSION || !encoded || !sig) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest("hex").slice(0, 16);
  try {
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(decodeBase64Url(encoded)) as {
      organizationId?: string;
      flow?: GitHubInstallFlow;
      repoFullName?: string | null;
      repositoryId?: number | null;
    };
    if (!parsed.organizationId || (parsed.flow !== "repo" && parsed.flow !== "org")) return null;
    return {
      organizationId: parsed.organizationId,
      flow: parsed.flow,
      repoFullName: parsed.repoFullName ?? null,
      repositoryId: typeof parsed.repositoryId === "number" ? parsed.repositoryId : null,
    };
  } catch {
    return null;
  }
}
