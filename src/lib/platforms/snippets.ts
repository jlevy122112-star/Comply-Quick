import { generateConsentBanner, type CookieConsentInput } from "@/lib/tools/cookieConsent";
import { getPlatform, type Platform } from "./registry";

export interface PlatformSnippetInput extends CookieConsentInput {
  /** Optional hosted policy URL to include alongside the banner. */
  policyUrl?: string;
}

export interface PlatformSnippetResult {
  platform: Platform;
  /** Copy-paste snippet appropriate for the platform. */
  snippet: string;
  /** Language of the snippet (useful for code blocks). */
  language: "html" | "liquid" | "javascript" | "php";
}

/** Wraps the generic Comply-Quick banner with platform-native framing. */
export function generatePlatformSnippet(platformId: string, input: PlatformSnippetInput): PlatformSnippetResult | null {
  const platform = getPlatform(platformId);
  if (!platform) return null;

  const { policyUrl, ...bannerInput } = input;
  const banner = generateConsentBanner(bannerInput);
  let snippet = banner.snippet;
  let language: PlatformSnippetResult["language"] = "html";

  switch (platform.installType) {
    case "theme-edit":
      if (platformId === "shopify") {
        language = "liquid";
        snippet = [
          `{% comment %}Comply-Quick cookie consent - place before </body>{% endcomment %}`,
          snippet,
          policyUrl ? `{% comment %}Policy URL: ${policyUrl}{% endcomment %}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      } else {
        snippet = [
          `<!-- Comply-Quick cookie consent - place before </body> -->`,
          snippet,
          policyUrl ? `<!-- Policy URL: ${policyUrl} -->` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
      break;

    case "plugin":
      if (platformId === "wordpress") {
        language = "php";
        snippet = [`<?php // Add to footer.php or use a code-snippets plugin ?>`, snippet].join("\n");
      } else if (platformId === "joomla") {
        language = "php";
        snippet = [`<?php // Add to a Custom HTML module or template index.php before </body> ?>`, snippet].join("\n");
      }
      break;

    case "code-injection":
    case "manual":
    default:
      snippet = [
        `<!-- Comply-Quick cookie consent - site-wide header/footer code -->`,
        snippet,
        policyUrl ? `<!-- See privacy policy: ${policyUrl} -->` : "",
      ]
        .filter(Boolean)
        .join("\n");
      break;
  }

  return { platform, snippet, language };
}
