import type {
  RemediationCapabilityDescriptor,
  RemediationExecutionContext,
  RemediationExecutionResult,
  RemediationExecutor,
  PreviousStateSnapshot,
} from "../executor";
import type { RemediationChange } from "../types";
import { assertPublicScanHost, getScanDispatcher } from "@/lib/security";

interface WordPressPage {
  id: number;
  slug?: string;
  title?: { rendered?: string } | string;
  content?: { rendered?: string } | string;
}

interface ConsentEndpointState {
  installed?: boolean;
  script?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

const capabilities: RemediationCapabilityDescriptor = {
  platform: "wordpress",
  executableTargets: ["script_tag:consent", "page:privacy"],
  manualTargets: [],
  supportsAutoApply: true,
};

function baseUrl(context: RemediationExecutionContext): string {
  const raw = context.apiBaseUrl ?? context.connection.externalAccountId;
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("WordPress API URL must use http or https.");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function authHeaders(context: RemediationExecutionContext): Record<string, string> {
  const token = context.apiToken ?? context.accessToken;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(
  context: RemediationExecutionContext,
  method: string,
  path: string,
  body?: unknown,
  allowNotFound = false
): Promise<T> {
  const fetchImpl = context.fetchImpl ?? fetch;
  const rawBase = baseUrl(context);
  await (context.assertHost ?? assertPublicScanHost)(new URL(rawBase).hostname);
  const headers = authHeaders(context);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit & { dispatcher?: unknown } = {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  if (!context.fetchImpl) init.dispatcher = getScanDispatcher();
  const response = await fetchImpl(`${rawBase}${path}`, init);
  if (!response.ok) {
    if (allowNotFound && response.status === 404) return undefined as T;
    throw new Error(`WordPress API ${method} ${path} failed: ${response.status}`);
  }
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

function policyHtml(context: RemediationExecutionContext): string {
  return context.privacyPolicyHtml ?? "<p>Generated privacy policy content requires publication.</p>";
}

async function applyConsent(
  change: RemediationChange,
  context: RemediationExecutionContext
): Promise<RemediationExecutionResult> {
  const path = "/wp-json/comply-quick/v1/consent-script";
  const prior = (await request<ConsentEndpointState | null>(context, "GET", path, undefined, true)) ?? null;
  const previousState = snapshot(context, change, prior);
  const script = context.consentScript ?? "<script data-comply-quick-consent></script>";
  if (prior?.installed && prior.script === script) {
    return {
      platform: "wordpress",
      change,
      status: "applied",
      detail: "The Comply-Quick consent script was already installed; no duplicate was written.",
      previousStateRef: previousState.ref,
      snapshot: previousState,
    };
  }
  const method = prior ? "PUT" : "POST";
  await request(context, method, path, { script, installed: true });
  const verified = await request<ConsentEndpointState>(context, "GET", path);
  if (!verified?.installed || verified.script !== script) {
    throw new Error("WordPress consent endpoint did not confirm the requested script.");
  }
  return {
    platform: "wordpress",
    change,
    status: "applied",
    detail: "Consent script installed through the Comply-Quick WordPress endpoint.",
    previousStateRef: previousState.ref,
    snapshot: previousState,
  };
}

async function applyPrivacyPage(
  change: RemediationChange,
  context: RemediationExecutionContext
): Promise<RemediationExecutionResult> {
  const path = "/wp-json/wp/v2/pages?slug=privacy-policy";
  const pages = (await request<WordPressPage[]>(context, "GET", path, undefined, true)) ?? [];
  const prior = pages[0] ?? null;
  const body = { title: "Privacy Policy", slug: "privacy-policy", content: policyHtml(context), status: "publish" };
  let created: WordPressPage | undefined;
  if (prior) {
    await request(context, "POST", `/wp-json/wp/v2/pages/${prior.id}`, body);
  } else {
    created = await request<WordPressPage>(context, "POST", "/wp-json/wp/v2/pages", body);
  }
  const verifiedPages = await request<WordPressPage[]>(context, "GET", path);
  if (!verifiedPages[0]) throw new Error("WordPress REST API did not confirm the policy page.");
  const previousState = snapshot(context, change, {
    prior,
    ...(created?.id ? { createdId: created.id } : {}),
  });
  return {
    platform: "wordpress",
    change,
    status: "applied",
    detail: prior
      ? "Privacy policy page updated through the WordPress REST API."
      : "Privacy policy page created through the WordPress REST API.",
    previousStateRef: previousState.ref,
    snapshot: previousState,
  };
}

export function createWordPressExecutor(): RemediationExecutor {
  return {
    capabilities,
    async applyApproved(change, context) {
      if (change.target === "script_tag:consent") return applyConsent(change, context);
      return applyPrivacyPage(change, context);
    },
    async rollback(result, context) {
      const prior = result.snapshot?.state as WordPressPage | ConsentEndpointState | null;
      if (result.change.target === "script_tag:consent") {
        const path = "/wp-json/comply-quick/v1/consent-script";
        if (prior) {
          await request(context, "PUT", path, prior);
        } else {
          await request(context, "DELETE", path);
        }
      } else {
        const state = prior as { prior?: WordPressPage | null; createdId?: number } | null;
        if (state?.prior?.id) {
          await request(context, "POST", `/wp-json/wp/v2/pages/${state.prior.id}`, {
            title: typeof state.prior.title === "string" ? state.prior.title : (state.prior.title?.rendered ?? ""),
            content:
              typeof state.prior.content === "string" ? state.prior.content : (state.prior.content?.rendered ?? ""),
            status: "publish",
          });
        } else if (state?.createdId) {
          await request(context, "DELETE", `/wp-json/wp/v2/pages/${state.createdId}`);
        }
      }
      return {
        ...result,
        status: "reverted",
        detail: "WordPress remediation rolled back to its captured prior state.",
      };
    },
  };
}
