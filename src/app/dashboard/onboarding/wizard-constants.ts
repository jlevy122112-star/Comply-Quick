import type { Framework } from "@/components/ClauseEngine";
import { REGULATION_SOURCES } from "@/lib/regulations/sources/registry";
import type { OnboardingAnswers } from "@/lib/agents/onboarding";

export const PLATFORMS: { value: Framework; label: string; icon: string }[] = [
  { value: "nextjs", label: "Next.js", icon: "▲" },
  { value: "shopify", label: "Shopify", icon: "🛒" },
  { value: "wordpress", label: "WordPress", icon: "📝" },
  { value: "wix", label: "Wix", icon: "🌐" },
  { value: "squarespace", label: "Squarespace", icon: "◼" },
  { value: "woocommerce", label: "WooCommerce", icon: "🛍️" },
  { value: "bigcommerce", label: "BigCommerce", icon: "🏬" },
  { value: "webflow", label: "Webflow", icon: "🎨" },
  { value: "godaddy", label: "GoDaddy", icon: "🌍" },
];

export const TOGGLES: { key: keyof OnboardingAnswers; label: string; hint: string }[] = [
  { key: "sellsOnline", label: "We Sell Online / Take Payments", hint: "Adds payment & consumer protections" },
  { key: "handlesHealthData", label: "We Handle Health Data", hint: "Triggers HIPAA/health coverage" },
  { key: "servesEu", label: "We Serve EU / UK Users", hint: "Adds GDPR obligations" },
  { key: "isAgency", label: "We're an Agency Managing Client Sites", hint: "Enables multi-project posture" },
];

export const REGION_LABELS: Record<string, string> = {
  us_general: "United States",
  california_ccpa: "California (CCPA/CPRA)",
  eu_gdpr: "European Union (GDPR)",
  canada_pipeda: "Canada (PIPEDA)",
  brazil_lgpd: "Brazil (LGPD)",
  australia_privacy: "Australia",
};

export function frameworkLabel(id: string): string {
  return REGULATION_SOURCES[id as keyof typeof REGULATION_SOURCES]?.label ?? id.toUpperCase();
}
