import type {
  RemediationCapabilityDescriptor,
  RemediationExecutionContext,
  RemediationExecutor,
  PreviousStateSnapshot,
} from "../executor";
import type { RemediationChange } from "../types";
import { assertPublicScanHost } from "@/lib/security";

interface WebflowCustomCode {
  id?: string;
  location?: "head" | "body";
  code?: string;
  displayName?: string;
}

const capabilities: RemediationCapabilityDescriptor = {
  platform: "webflow",
  executableTargets: ["script_tag:consent"],
  manualTargets: ["page:privacy"],
  supportsAutoApply: true,
};

function baseUrl(context: RemediationExecutionContext): string {
  const raw = context.apiBaseUrl ?? "https://api.webflow.com";
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Webflow API URL must use http or https.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function siteId(context: RemediationExecutionContext): string {
  return context.connection.externalAccountId;
}

async function request<T>(
  context: RemediationExecutionContext,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const fetchImpl = context.fetchImpl ?? fetch;
  const rawBase = baseUrl(context);
  const token = context.apiToken ?? context.accessToken;
  if (token) await (context.assertHost ?? assertPublicScanHost)(new URL(rawBase).hostname);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(context.apiToken || context.accessToken
      ? { Authorization: `Bearer ${context.apiToken ?? context.accessToken}` }
      : {}),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetchImpl(`${rawBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Webflow API ${method} ${path} failed: ${response.status}`);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function snapshot(
  context: RemediationExecutionContext,
  change: RemediationChange,
  state: unknown
): PreviousStateSnapshot {
  return {
    ref: context.snapshotRef ?? `connector:${context.connection.id}:${change.id}`,
    state,
  };
}

export function createWebflowExecutor(): RemediationExecutor {
  return {
    capabilities,
    async applyApproved(change, context) {
      const path = `/v2/sites/${encodeURIComponent(siteId(context))}/custom_code`;
      const existing = await request<WebflowCustomCode[]>(context, "GET", path);
      const prior = existing.find((entry) => entry.displayName === "Comply-Quick Consent") ?? null;
      const previousState = snapshot(context, change, prior);
      const code = context.consentScript ?? "<script data-comply-quick-consent></script>";
      const location = context.customCodeLocation ?? "head";
      if (prior?.code === code && prior.location === location) {
        return {
          platform: "webflow",
          change,
          status: "applied",
          detail: "The Webflow consent code was already registered; no duplicate was written.",
          previousStateRef: previousState.ref,
          snapshot: previousState,
        };
      }
      const payload = { displayName: "Comply-Quick Consent", location, code };
      if (prior?.id) {
        await request(context, "PATCH", `${path}/${encodeURIComponent(prior.id)}`, payload);
      } else {
        await request(context, "POST", path, payload);
      }
      const verified = await request<WebflowCustomCode[]>(context, "GET", path);
      if (!verified.some((entry) => entry.displayName === "Comply-Quick Consent" && entry.code === code)) {
        throw new Error("Webflow custom-code API did not confirm the consent code.");
      }
      return {
        platform: "webflow",
        change,
        status: "applied",
        detail: "Consent code registered in Webflow site custom code.",
        previousStateRef: previousState.ref,
        snapshot: previousState,
      };
    },
    async rollback(result, context) {
      const path = `/v2/sites/${encodeURIComponent(siteId(context))}/custom_code`;
      const prior = result.snapshot?.state as WebflowCustomCode | null;
      if (prior?.id) {
        await request(context, "PATCH", `${path}/${encodeURIComponent(prior.id)}`, prior);
      } else {
        const current = await request<WebflowCustomCode[]>(context, "GET", path);
        const inserted = current.find((entry) => entry.displayName === "Comply-Quick Consent");
        if (inserted?.id) await request(context, "DELETE", `${path}/${encodeURIComponent(inserted.id)}`);
      }
      return {
        ...result,
        status: "reverted",
        detail: "Webflow custom code was rolled back to its captured prior state.",
      };
    },
  };
}
