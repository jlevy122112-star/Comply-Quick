import { createHmac, timingSafeEqual } from "node:crypto";

export interface GitHubPushWebhookPayload {
  installation?: { id?: number };
  repository?: {
    id?: number;
    full_name?: string;
    private?: boolean;
    default_branch?: string;
  };
  organization?: { login?: string };
  sender?: { login?: string };
  pusher?: { name?: string };
  ref?: string;
  after?: string;
  before?: string;
  head_commit?: { timestamp?: string };
  deleted?: boolean;
}

function toBuffer(payload: string | Buffer): Buffer {
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
}

export function verifyGitHubWebhookSignature(payload: string | Buffer, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", secret).update(toBuffer(payload)).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function parseGitHubPushPayload(payload: GitHubPushWebhookPayload) {
  const installationId = payload.installation?.id;
  const repoFullName = payload.repository?.full_name;
  if (!installationId || !repoFullName || payload.deleted) return null;
  return {
    installationId,
    repoId: payload.repository?.id ?? null,
    repoFullName,
    refName: payload.ref ?? null,
    headSha: payload.after ?? null,
    beforeSha: payload.before ?? null,
    pushedAt: payload.head_commit?.timestamp ?? null,
    senderLogin: payload.sender?.login ?? payload.pusher?.name ?? null,
    organizationLogin: payload.organization?.login ?? null,
  };
}
