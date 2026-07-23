import type { Connection, Platform, RemediationChange } from "./types";
import { createGenericSnippetExecutor } from "./adapters/generic";
import { createShopifyExecutor } from "./adapters/shopify";
import { createWebflowExecutor } from "./adapters/webflow";
import { createWordPressExecutor } from "./adapters/wordpress";

export interface RemediationExecutionContext {
  connection: Pick<Connection, "id" | "platform" | "externalAccountId">;
  fetchImpl?: typeof fetch;
  accessToken?: string;
  apiToken?: string;
  apiBaseUrl?: string;
  consentScript?: string;
  consentScriptUrl?: string;
  customCodeLocation?: "head" | "body";
  privacyPolicyHtml?: string;
  snapshotRef?: string;
}

export interface PreviousStateSnapshot {
  ref: string;
  state: unknown;
}

export interface RemediationExecutionResult {
  platform: Platform;
  change: RemediationChange;
  status: "applied" | "proposed" | "failed" | "reverted";
  detail: string;
  previousStateRef?: string;
  snapshot?: PreviousStateSnapshot;
  manualInstructions?: string;
}

export interface RemediationCapabilityDescriptor {
  platform: Platform;
  executableTargets: readonly string[];
  manualTargets: readonly string[];
  supportsAutoApply: boolean;
}

export interface RemediationExecutor {
  readonly capabilities: RemediationCapabilityDescriptor;
  applyApproved(change: RemediationChange, context: RemediationExecutionContext): Promise<RemediationExecutionResult>;
  rollback(
    result: RemediationExecutionResult,
    context: RemediationExecutionContext
  ): Promise<RemediationExecutionResult>;
}

function targetMatches(target: string, supported: readonly string[]): boolean {
  return supported.some((candidate) => target === candidate || target.startsWith(`${candidate}#`));
}

function isAutoApplySafe(change: RemediationChange): boolean {
  return change.risk === "low" && !change.target.startsWith("page:");
}

function snapshotRef(context: RemediationExecutionContext, change: RemediationChange): string {
  return context.snapshotRef ?? `connector:${context.connection.id}:${change.id}`;
}

function proposal(
  change: RemediationChange,
  context: RemediationExecutionContext,
  detail: string,
  manualInstructions?: string
): RemediationExecutionResult {
  return {
    platform: context.connection.platform,
    change,
    status: "proposed",
    detail,
    ...(manualInstructions ? { manualInstructions } : {}),
  };
}

function manualSnippet(change: RemediationChange, context: RemediationExecutionContext): string {
  if (change.target.startsWith("page:")) {
    return context.privacyPolicyHtml ?? "<!-- Install the generated privacy policy HTML here. -->";
  }
  return (
    context.consentScript ?? '<script src="https://cdn.comply-quick.com/consent.js" data-comply-quick-consent></script>'
  );
}

function executorFor(context: RemediationExecutionContext): RemediationExecutor {
  switch (context.connection.platform) {
    case "shopify":
      return createShopifyExecutor();
    case "wordpress":
      return createWordPressExecutor();
    case "webflow":
      return createWebflowExecutor();
    default:
      return createGenericSnippetExecutor(context.connection.platform);
  }
}

async function executeWithExecutor(
  change: RemediationChange,
  context: RemediationExecutionContext
): Promise<RemediationExecutionResult> {
  const executor = executorFor(context);
  const { capabilities } = executor;
  if (!capabilities.supportsAutoApply || !targetMatches(change.target, capabilities.executableTargets)) {
    return proposal(
      change,
      context,
      `${context.connection.platform} cannot automatically execute ${change.target}; manual installation is required.`,
      `Install the generated remediation for ${change.target} manually on the connected site:\n\n${manualSnippet(
        change,
        context
      )}`
    );
  }
  return executor.applyApproved(change, {
    ...context,
    snapshotRef: snapshotRef(context, change),
  });
}

/**
 * Executes a change that has already been approved by a user.
 * Unsupported targets are always downgraded to a proposal with instructions.
 */
export function applyApprovedRemediation(
  change: RemediationChange,
  context: RemediationExecutionContext
): Promise<RemediationExecutionResult> {
  return executeWithExecutor(change, context);
}

/**
 * Runs an agent plan while preserving the planner's safety disposition.
 * Proposed changes never reach an adapter until separately approved.
 */
export function executePlannedRemediation(
  planned: { change: RemediationChange; disposition: "auto_apply" | "propose" },
  context: RemediationExecutionContext
): Promise<RemediationExecutionResult> {
  if (planned.disposition === "propose") {
    return Promise.resolve(
      proposal(planned.change, context, "This remediation requires human approval before any platform write.")
    );
  }
  if (!isAutoApplySafe(planned.change)) {
    return Promise.resolve(
      proposal(
        planned.change,
        context,
        "The connector safety policy requires human approval for high-risk and document changes."
      )
    );
  }
  return executeWithExecutor(planned.change, context);
}

export function getRemediationCapabilities(platform: Platform): RemediationCapabilityDescriptor {
  return executorFor({
    connection: { id: "capability-check", platform, externalAccountId: "" },
  }).capabilities;
}

export function rollbackRemediation(
  result: RemediationExecutionResult,
  context: RemediationExecutionContext
): Promise<RemediationExecutionResult> {
  if (!result.snapshot) {
    return Promise.resolve({
      ...result,
      status: "failed",
      detail: "No prior-state snapshot is available for rollback.",
    });
  }
  return executorFor(context).rollback(result, context);
}
