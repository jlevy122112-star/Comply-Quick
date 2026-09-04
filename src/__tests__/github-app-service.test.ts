import { createHmac, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildGitHubAppInstallUrl, createGitHubAppJwt } from "@/lib/github/app-service";
import { signState, verifyState } from "@/lib/github/state";
import { parseGitHubPushPayload, verifyGitHubWebhookSignature } from "@/lib/github/webhooks";

describe("github app helpers", () => {
  it("builds an installation url with state and optional repository id", () => {
    const url = buildGitHubAppInstallUrl(
      { flow: "repo", state: "signed", repositoryId: 42 },
      { appId: "1", privateKey: "pk", slug: "comply-quick" }
    );
    expect(url).toContain("/apps/comply-quick/installations/new");
    expect(url).toContain("state=signed");
    expect(url).toContain("repository_id=42");
  });

  it("round-trips signed state payloads", () => {
    const state = signState("secret", {
      organizationId: "org-1",
      flow: "repo",
      repoFullName: "acme/api",
      repositoryId: 99,
    });
    expect(verifyState("secret", state)).toEqual({
      organizationId: "org-1",
      flow: "repo",
      repoFullName: "acme/api",
      repositoryId: 99,
    });
  });

  it("creates a three-part github app jwt", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = createGitHubAppJwt({
      appId: "123",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      slug: "comply-quick",
    });
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("verifies webhook signatures and parses push payloads", () => {
    const payload = JSON.stringify({
      installation: { id: 7 },
      repository: { id: 11, full_name: "acme/site" },
      ref: "refs/heads/main",
      after: "abcdef0",
      before: "1234567",
      sender: { login: "octo" },
    });
    const signature = `sha256=${createHmac("sha256", "secret").update(payload).digest("hex")}`;
    expect(verifyGitHubWebhookSignature(payload, signature, "secret")).toBe(true);
    expect(parseGitHubPushPayload(JSON.parse(payload))).toMatchObject({
      installationId: 7,
      repoFullName: "acme/site",
      headSha: "abcdef0",
    });
  });
});
