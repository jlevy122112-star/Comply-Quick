import type {
  RemediationCapabilityDescriptor,
  RemediationExecutionContext,
  RemediationExecutor,
  PreviousStateSnapshot,
} from "../executor";
import type { RemediationChange } from "../types";
import { ShopifyAdminClient, type ScriptTag, type ShopifyPage } from "../shopify/client";

const capabilities: RemediationCapabilityDescriptor = {
  platform: "shopify",
  executableTargets: ["script_tag:consent", "page:privacy"],
  manualTargets: [],
  supportsAutoApply: true,
};

function client(context: RemediationExecutionContext): ShopifyAdminClient {
  const token = context.accessToken;
  if (!token) throw new Error("A Shopify access token is required for remediation writes.");
  return new ShopifyAdminClient({
    shop: context.connection.externalAccountId,
    accessToken: token,
    fetchImpl: context.fetchImpl,
  });
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

export function createShopifyExecutor(): RemediationExecutor {
  return {
    capabilities,
    async applyApproved(change, context) {
      const api = client(context);
      if (change.target === "script_tag:consent") {
        const scriptUrl = context.consentScriptUrl ?? "https://cdn.comply-quick.com/consent.js";
        const prior = (await api.listScriptTags()).find((tag) => tag.src === scriptUrl);
        const previousState = snapshot(context, change, { prior: prior ?? null });
        if (prior) {
          return {
            platform: "shopify",
            change,
            status: "applied",
            detail: "The Shopify consent script was already installed; no duplicate was created.",
            previousStateRef: previousState.ref,
            snapshot: previousState,
          };
        }
        const tag = await api.createScriptTag({
          src: scriptUrl,
        });
        previousState.state = { prior: null, createdId: tag.id };
        const verifiedTags = await api.listScriptTags();
        if (!verifiedTags.some((entry) => entry.src === scriptUrl)) {
          throw new Error("Shopify API did not confirm the consent script tag.");
        }
        return {
          platform: "shopify",
          change,
          status: "applied",
          detail: "Consent script tag created in Shopify.",
          previousStateRef: previousState.ref,
          snapshot: previousState,
          ...(tag.id ? { manualInstructions: `Created Shopify script tag ${tag.id}.` } : {}),
        };
      }

      const pages = await api.listPages();
      const prior = pages.find((page) => page.handle === "privacy-policy") ?? null;
      const previousState = snapshot(context, change, prior);
      const page: ShopifyPage = {
        ...(prior?.id ? { id: prior.id } : {}),
        title: "Privacy Policy",
        handle: "privacy-policy",
        bodyHtml: context.privacyPolicyHtml ?? "<p>Generated privacy policy content requires publication.</p>",
      };
      if (prior?.id) {
        await api.updatePage(prior.id, page);
      } else {
        await api.createPage(page);
      }
      const verifiedPages = await api.listPages();
      if (!verifiedPages.some((entry) => entry.handle === "privacy-policy")) {
        throw new Error("Shopify API did not confirm the privacy policy page.");
      }
      return {
        platform: "shopify",
        change,
        status: "applied",
        detail: prior ? "Privacy policy page updated in Shopify." : "Privacy policy page created in Shopify.",
        previousStateRef: previousState.ref,
        snapshot: previousState,
      };
    },
    async rollback(result, context) {
      const api = client(context);
      if (result.change.target === "script_tag:consent") {
        const state = result.snapshot?.state as { prior?: ScriptTag | null; createdId?: number } | null;
        const prior = state?.prior ?? null;
        if (prior?.id) {
          // Shopify script tags are immutable through this API; preserving an
          // existing tag means no rollback write is needed.
        } else if (state?.createdId) {
          await api.deleteScriptTag(state.createdId);
        }
      } else {
        const prior = result.snapshot?.state as ShopifyPage | null;
        const current = (await api.listPages()).find((page) => page.handle === "privacy-policy");
        if (prior?.id) {
          await api.updatePage(prior.id, prior);
        } else if (current?.id) {
          await api.deletePage(current.id);
        }
      }
      return {
        ...result,
        status: "reverted",
        detail: "Shopify remediation was rolled back to its captured prior state.",
      };
    },
  };
}
