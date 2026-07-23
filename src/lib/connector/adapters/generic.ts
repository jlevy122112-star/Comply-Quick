import type {
  RemediationCapabilityDescriptor,
  RemediationExecutionContext,
  RemediationExecutionResult,
  RemediationExecutor,
} from "../executor";
import type { RemediationChange } from "../types";

function snippetFor(change: RemediationChange, context: RemediationExecutionContext): string {
  if (change.target.startsWith("page:")) {
    return context.privacyPolicyHtml ?? "<!-- Install the generated privacy policy HTML here. -->";
  }
  return (
    context.consentScript ?? '<script src="https://cdn.comply-quick.com/consent.js" data-comply-quick-consent></script>'
  );
}

export function createGenericSnippetExecutor(
  platform: RemediationCapabilityDescriptor["platform"]
): RemediationExecutor {
  const capabilities: RemediationCapabilityDescriptor = {
    platform,
    executableTargets: [],
    manualTargets: ["script_tag:consent", "page:privacy"],
    supportsAutoApply: false,
  };
  return {
    capabilities,
    async applyApproved(change, context): Promise<RemediationExecutionResult> {
      const snippet = snippetFor(change, context);
      return {
        platform: context.connection.platform,
        change,
        status: "proposed",
        detail: "Generic snippet remediations are always manual and cannot be auto-applied.",
        manualInstructions: `Install this remediation manually on the site:\n\n${snippet}`,
      };
    },
    async rollback(result): Promise<RemediationExecutionResult> {
      return {
        ...result,
        status: "reverted",
        detail: "Generic snippet remediation was never written by Comply-Quick; remove the installed snippet manually.",
      };
    },
  };
}
