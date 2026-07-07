"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { computePaywallTriggers } from "@/lib/funnel/triggers";
import { trackFunnel } from "@/lib/funnel/client";
import {
  generateCompliancePackage,
  exportToMarkdown,
  type UserType,
  type Framework,
  type TrackingPixel,
  type TargetRegion,
  type CompliancePackage,
  type ComplianceModule,
} from "@/components/ClauseEngine";
import { MODULE_OPTIONS } from "@/components/EnterpriseModules";
import { saveProjectAction } from "./actions";
import type { Tier } from "@/lib/entitlements";
import { TIER_CONFIG } from "@/lib/pricing";
import { REPORT_DISCLAIMER, DISCLAIMER_LONG } from "@/lib/legal";

interface DashboardWizardProps {
  isPremium: boolean;
  tier: Tier;
  isAuthenticated: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const USER_TYPE_OPTIONS: { value: UserType; label: string; description: string }[] = [
  { value: "developer", label: "Developer", description: "Web developer building for clients" },
  { value: "merchant", label: "Merchant", description: "Store owner managing your own site" },
];

const FRAMEWORK_OPTIONS: { value: Framework; label: string; icon: string }[] = [
  { value: "shopify", label: "Shopify", icon: "🛒" },
  { value: "nextjs", label: "Next.js", icon: "▲" },
  { value: "wordpress", label: "WordPress", icon: "📝" },
  { value: "wix", label: "Wix", icon: "🌐" },
  { value: "squarespace", label: "Squarespace", icon: "◼" },
  { value: "woocommerce", label: "WooCommerce", icon: "🛍️" },
  { value: "bigcommerce", label: "BigCommerce", icon: "🏬" },
  { value: "webflow", label: "Webflow", icon: "🎨" },
  { value: "godaddy", label: "GoDaddy", icon: "🌍" },
];

const PIXEL_OPTIONS: { value: TrackingPixel; label: string; color: string }[] = [
  { value: "meta", label: "Meta (Facebook)", color: "bg-blue-500" },
  { value: "google", label: "Google Analytics", color: "bg-yellow-500" },
  { value: "tiktok", label: "TikTok", color: "bg-pink-500" },
  { value: "linkedin", label: "LinkedIn", color: "bg-sky-600" },
  { value: "pinterest", label: "Pinterest", color: "bg-red-600" },
  { value: "snapchat", label: "Snapchat", color: "bg-amber-400" },
];

const REGION_OPTIONS: { value: TargetRegion; label: string; flag: string }[] = [
  { value: "us_general", label: "US General", flag: "🇺🇸" },
  { value: "california_ccpa", label: "California (CCPA)", flag: "🏴" },
  { value: "eu_gdpr", label: "EU (GDPR)", flag: "🇪🇺" },
  { value: "canada_pipeda", label: "Canada (PIPEDA)", flag: "🇨🇦" },
  { value: "brazil_lgpd", label: "Brazil (LGPD)", flag: "🇧🇷" },
  { value: "australia_privacy", label: "Australia", flag: "🇦🇺" },
];

// ─── Clipboard Copy Hook ────────────────────────────────────────────────────

function useCopyToClipboard(): [string | null, (text: string) => void] {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    });
  }, []);

  return [copiedText, copy];
}

// ─── Main Dashboard Component ───────────────────────────────────────────────

export default function DashboardWizard({ isPremium, isAuthenticated }: DashboardWizardProps) {
  // Wizard state
  const [step, setStep] = useState<number>(1);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [framework, setFramework] = useState<Framework | null>(null);
  const [trackingPixels, setTrackingPixels] = useState<TrackingPixel[]>([]);
  const [targetRegions, setTargetRegions] = useState<TargetRegion[]>([]);
  const [complianceModules, setComplianceModules] = useState<ComplianceModule[]>([]);

  // Premium state is verified server-side (via a paid subscription tied to the
  // authenticated user), not a spoofable URL flag.
  const premiumActive = isPremium;

  // Generated result
  const [compliancePackage, setCompliancePackage] = useState<CompliancePackage | null>(null);

  // Clipboard
  const [copiedText, copyToClipboard] = useCopyToClipboard();

  // Stripe checkout handler. Requires authentication — unauthenticated users are
  // routed to sign in first, then returned to the wizard.
  const handleCheckout = useCallback(
    async (plan: "pro" | "agency" | "enterprise", billing: "monthly" | "annual" = "monthly") => {
      if (!isAuthenticated) {
        window.location.href = `/login?redirect=${encodeURIComponent("/dashboard")}`;
        return;
      }
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, billing }),
        });
        if (res.status === 401) {
          window.location.href = `/login?redirect=${encodeURIComponent("/dashboard")}`;
          return;
        }
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert(data.message ?? data.error ?? "Checkout is not available right now.");
        }
      } catch {
        alert("Checkout failed. Please try again.");
      }
    },
    [isAuthenticated]
  );

  // Generate compliance package when wizard completes
  const handleGenerate = useCallback(() => {
    if (!userType || !framework) return;
    const result = generateCompliancePackage({
      userType,
      framework,
      trackingPixels,
      targetRegions,
      complianceModules: complianceModules.length > 0 ? complianceModules : undefined,
    });
    setCompliancePackage(result);
    setStep(6);

    // Persist the project server-side for premium users (scoped to their account).
    if (premiumActive) {
      const md = exportToMarkdown(result);
      void saveProjectAction({
        name: `${FRAMEWORK_OPTIONS.find((f) => f.value === framework)?.label ?? framework} Project`,
        framework,
        trackingPixels,
        targetRegions,
        complianceModules,
        complianceScore: result.complianceScore,
        packageMarkdown: md,
      });
    }
  }, [userType, framework, trackingPixels, targetRegions, complianceModules, premiumActive]);

  // Toggle helpers
  const togglePixel = useCallback((pixel: TrackingPixel) => {
    setTrackingPixels((prev) => (prev.includes(pixel) ? prev.filter((p) => p !== pixel) : [...prev, pixel]));
  }, []);

  const toggleRegion = useCallback((region: TargetRegion) => {
    setTargetRegions((prev) => (prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]));
  }, []);

  const toggleModule = useCallback((mod: ComplianceModule) => {
    setComplianceModules((prev) => (prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]));
  }, []);

  // Markdown download
  const handleDownloadMarkdown = useCallback(() => {
    if (!compliancePackage) return;
    const md = exportToMarkdown(compliancePackage);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compliance-package.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [compliancePackage]);

  // Reset wizard
  const handleReset = useCallback(() => {
    setStep(1);
    setCompliancePackage(null);
    setUserType(null);
    setFramework(null);
    setTrackingPixels([]);
    setTargetRegions([]);
    setComplianceModules([]);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Link
              href="/"
              className="text-2xl sm:text-3xl font-bold text-white tracking-tight hover:text-gray-200 transition-colors"
            >
              Comply-Quick
            </Link>
          </div>
          <p className="mt-2 text-sm text-gray-400">Generate your compliance package in minutes</p>
          {premiumActive && (
            <Link
              href="/dashboard/home"
              className="inline-block mt-3 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              &larr; Back to Command Center
            </Link>
          )}
        </header>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-500"
                }`}
              >
                {s}
              </div>
              {s < 5 && (
                <div className={`w-6 sm:w-10 h-0.5 transition-colors ${step > s ? "bg-indigo-600" : "bg-gray-800"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: User Type */}
        {step === 1 && (
          <WizardCard title="Who are you?" subtitle="Select your role">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {USER_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setUserType(option.value);
                    setStep(2);
                  }}
                  className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                    userType === option.value
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <span className="block text-lg font-semibold text-white">{option.label}</span>
                  <span className="block mt-1 text-sm text-gray-400">{option.description}</span>
                </button>
              ))}
            </div>
          </WizardCard>
        )}

        {/* Step 2: Framework */}
        {step === 2 && (
          <WizardCard title="Choose your framework" subtitle="Which platform are you building on?">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {FRAMEWORK_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFramework(option.value);
                    setStep(3);
                  }}
                  className={`p-4 rounded-xl border text-center transition-all hover:scale-[1.02] ${
                    framework === option.value
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <span className="block text-2xl mb-2">{option.icon}</span>
                  <span className="block text-sm font-medium text-white">{option.label}</span>
                </button>
              ))}
            </div>
            <BackButton onClick={() => setStep(1)} />
          </WizardCard>
        )}

        {/* Step 3: Tracking Pixels */}
        {step === 3 && (
          <WizardCard title="Active tracking pixels" subtitle="Select all that apply (or skip)">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {PIXEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePixel(option.value)}
                  className={`p-4 rounded-xl border text-center transition-all hover:scale-[1.02] ${
                    trackingPixels.includes(option.value)
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${option.color} mx-auto mb-2`} />
                  <span className="block text-sm font-medium text-white">{option.label}</span>
                  {trackingPixels.includes(option.value) && (
                    <span className="block mt-1 text-xs text-indigo-400">Selected</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-6">
              <BackButton onClick={() => setStep(2)} />
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
              >
                Continue
              </button>
            </div>
          </WizardCard>
        )}

        {/* Step 4: Target Regions */}
        {step === 4 && (
          <WizardCard title="Target regions" subtitle="Which jurisdictions apply?">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {REGION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleRegion(option.value)}
                  className={`p-4 rounded-xl border text-center transition-all hover:scale-[1.02] ${
                    targetRegions.includes(option.value)
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <span className="block text-2xl mb-2">{option.flag}</span>
                  <span className="block text-sm font-medium text-white">{option.label}</span>
                  {targetRegions.includes(option.value) && (
                    <span className="block mt-1 text-xs text-indigo-400">Selected</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-6">
              <BackButton onClick={() => setStep(3)} />
              <button
                type="button"
                onClick={() => setStep(5)}
                disabled={targetRegions.length === 0}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </WizardCard>
        )}

        {/* Step 5: Enterprise Compliance Modules (optional) */}
        {step === 5 && (
          <WizardCard title="Enterprise compliance modules" subtitle="Optional — add industry-specific shields">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {MODULE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleModule(option.value)}
                  className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                    complianceModules.includes(option.value)
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{option.icon}</span>
                    <div>
                      <span className="block text-sm font-semibold text-white">{option.label}</span>
                      <span className="block text-xs text-gray-400">{option.description}</span>
                    </div>
                  </div>
                  {complianceModules.includes(option.value) && (
                    <span className="block mt-2 text-xs text-indigo-400">Selected</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-6">
              <BackButton onClick={() => setStep(4)} />
              <button
                type="button"
                onClick={handleGenerate}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
              >
                Generate Compliance Package
              </button>
            </div>
          </WizardCard>
        )}

        {/* Step 6: Results with Free Preview + Paywall */}
        {step === 6 && compliancePackage && (
          <div className="space-y-6">
            {/* ── FREE PREVIEW: Compliance Score ── */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
              <div className="text-center mb-6">
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                  <span className="text-xs font-medium text-emerald-400">Your results are ready</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Compliance Score</h2>
              </div>

              {/* Score Ring */}
              <div className="flex justify-center mb-8">
                <ScoreRing score={compliancePackage.complianceScore.overall} />
              </div>

              {/* Score Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ScoreCategory
                  label="Contract Protection"
                  score={compliancePackage.complianceScore.contractProtection}
                />
                <ScoreCategory label="Privacy Coverage" score={compliancePackage.complianceScore.privacyCoverage} />
                <ScoreCategory label="Pre-Launch Ready" score={compliancePackage.complianceScore.preLaunchReadiness} />
                <ScoreCategory label="Regulatory Breadth" score={compliancePackage.complianceScore.regulatoryBreadth} />
              </div>

              {/* Teaser Stats */}
              <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-gray-800">
                <div className="text-center">
                  <span className="block text-2xl font-bold text-white">
                    {compliancePackage.inwardContractShield.clauses.length}
                  </span>
                  <span className="text-xs text-gray-400">Shield Clauses</span>
                </div>
                <div className="text-center">
                  <span className="block text-2xl font-bold text-white">
                    {compliancePackage.developerPreLaunchChecklist.items.length}
                  </span>
                  <span className="text-xs text-gray-400">Checklist Items</span>
                </div>
                <div className="text-center">
                  <span className="block text-2xl font-bold text-white">
                    {compliancePackage.consumerPrivacyPolicyAddendum.regionalDisclosures.length}
                  </span>
                  <span className="text-xs text-gray-400">Jurisdictions</span>
                </div>
              </div>
            </div>

            {/* ── FREE PREVIEW: Inward Contract Shield (fully visible) ── */}
            <div className="relative">
              <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 z-10">
                <span className="text-xs font-medium text-emerald-400">Free Preview</span>
              </div>
              <ResultSection
                title="Inward Contract Shield"
                copiedText={premiumActive ? copiedText : null}
                onCopy={premiumActive ? copyToClipboard : () => {}}
                showCopy={premiumActive}
              >
                <p className="text-sm text-gray-300 mb-4">{compliancePackage.inwardContractShield.preamble}</p>
                {compliancePackage.inwardContractShield.clauses.map((clause) => (
                  <div key={clause.title} className="mb-4 last:mb-0">
                    <h4 className="text-sm font-semibold text-indigo-400 mb-1">{clause.title}</h4>
                    <p className="text-sm text-gray-400">{clause.body}</p>
                  </div>
                ))}
              </ResultSection>
            </div>

            {/* ── PAYWALL BOUNDARY ── */}
            {!premiumActive && (
              <PaywallGate
                clauseCount={compliancePackage.inwardContractShield.clauses.length}
                checklistCount={compliancePackage.developerPreLaunchChecklist.items.length}
                regionCount={compliancePackage.consumerPrivacyPolicyAddendum.regionalDisclosures.length}
                hasModules={!!compliancePackage.enterpriseModules && compliancePackage.enterpriseModules.length > 0}
                pixelCount={compliancePackage.consumerPrivacyPolicyAddendum.scriptDeclarations.length}
                modules={complianceModules}
                onCheckout={handleCheckout}
              />
            )}

            {/* ── PREMIUM-ONLY SECTIONS ── */}
            {premiumActive && (
              <>
                {/* Privacy Policy Addendum */}
                <ResultSection
                  title="Consumer Privacy Policy Addendum"
                  copiedText={copiedText}
                  onCopy={copyToClipboard}
                >
                  <p className="text-sm text-gray-300 mb-4 whitespace-pre-line">
                    {compliancePackage.consumerPrivacyPolicyAddendum.header}
                  </p>
                  {compliancePackage.consumerPrivacyPolicyAddendum.scriptDeclarations.map((declaration, i) => (
                    <div key={i} className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-sm text-gray-300">{declaration}</p>
                    </div>
                  ))}
                  {compliancePackage.consumerPrivacyPolicyAddendum.regionalDisclosures.map((disclosure, i) => (
                    <div key={i} className="mb-3 p-3 bg-gray-800/50 rounded-lg border-l-2 border-indigo-500">
                      <p className="text-sm text-gray-300">{disclosure}</p>
                    </div>
                  ))}
                </ResultSection>

                {/* Developer Pre-Launch Checklist */}
                <ResultSection title="Developer Pre-Launch Checklist" copiedText={copiedText} onCopy={copyToClipboard}>
                  <p className="text-sm text-gray-400 mb-4 italic">
                    {compliancePackage.developerPreLaunchChecklist.frameworkNotes}
                  </p>
                  <div className="space-y-2">
                    {compliancePackage.developerPreLaunchChecklist.items.map((item) => (
                      <div key={item.step} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-800/30">
                        <span
                          className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            item.critical ? "bg-red-500/20 text-red-400" : "bg-gray-700 text-gray-400"
                          }`}
                        >
                          {item.step}
                        </span>
                        <span className="text-sm text-gray-300">{item.action}</span>
                      </div>
                    ))}
                  </div>
                </ResultSection>

                {/* Enterprise Modules (if selected) */}
                {compliancePackage.enterpriseModules &&
                  compliancePackage.enterpriseModules.map((mod) => (
                    <ResultSection
                      key={mod.moduleName}
                      title={mod.moduleName}
                      copiedText={copiedText}
                      onCopy={copyToClipboard}
                    >
                      <p className="text-sm text-gray-300 mb-4">{mod.summary}</p>
                      {mod.clauses.map((clause) => (
                        <div key={clause.title} className="mb-4 last:mb-0">
                          <h4 className="text-sm font-semibold text-indigo-400 mb-1">{clause.title}</h4>
                          <p className="text-sm text-gray-400">{clause.body}</p>
                        </div>
                      ))}
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <h4 className="text-sm font-semibold text-white mb-3">Module Checklist</h4>
                        <div className="space-y-2">
                          {mod.checklistItems.map((item, i) => (
                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-800/30">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400">
                                {i + 1}
                              </span>
                              <span className="text-sm text-gray-300">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </ResultSection>
                  ))}

                {/* Export + Reset */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadMarkdown}
                    className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
                  >
                    Download as Markdown
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-5 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-500 hover:text-white transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Mandatory Disclaimer */}
        <footer className="mt-12 pt-6 border-t border-gray-800 space-y-2">
          <p className="text-xs font-medium text-gray-400 text-center leading-relaxed">{REPORT_DISCLAIMER}</p>
          <p className="text-xs text-gray-500 text-center leading-relaxed">{DISCLAIMER_LONG}</p>
          <p className="text-xs text-gray-600 text-center">
            <Link href="/legal/terms" className="underline hover:text-gray-400">
              Terms of Service
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Compliance Score Ring ───────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const gap = circumference - filled;

  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";

  const bgColor = score >= 80 ? "text-emerald-400/10" : score >= 60 ? "text-yellow-400/10" : "text-red-400/10";

  return (
    <div className="relative w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" className={`stroke-current ${bgColor}`} />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          className={`stroke-current ${color} transition-all duration-1000`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

function ScoreCategory({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="bg-gray-800/50 rounded-xl p-3 text-center">
      <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
        <div className={`${color} h-1.5 rounded-full transition-all duration-1000`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-lg font-bold text-white">{score}</span>
      <span className="block text-xs text-gray-400 mt-0.5">{label}</span>
    </div>
  );
}

// ─── Paywall Gate ───────────────────────────────────────────────────────────

function PaywallGate({
  clauseCount,
  checklistCount,
  regionCount,
  hasModules,
  pixelCount,
  modules,
  onCheckout,
}: {
  clauseCount: number;
  checklistCount: number;
  regionCount: number;
  hasModules: boolean;
  pixelCount: number;
  modules: ComplianceModule[];
  onCheckout: (plan: "pro" | "agency" | "enterprise", billing?: "monthly" | "annual") => void;
}) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const triggers = useMemo(
    () => computePaywallTriggers({ hasAda: modules.includes("ada_wcag"), hasHipaa: modules.includes("hipaa") }),
    [modules]
  );

  useEffect(() => {
    trackFunnel("paywall_viewed", { surface: "wizard", triggers: triggers.map((t) => t.id).join(",") });
  }, [triggers]);

  const handleCta = (plan: "pro" | "agency" | "enterprise") => {
    trackFunnel("upgrade_cta_clicked", { surface: "wizard", plan, billing });
    onCheckout(plan, billing);
  };
  const proPrice = billing === "annual" ? `$${TIER_CONFIG.pro.annual}/yr` : `$${TIER_CONFIG.pro.monthly}/mo`;
  const agencyPrice = billing === "annual" ? `$${TIER_CONFIG.agency.annual}/yr` : `$${TIER_CONFIG.agency.monthly}/mo`;
  const enterprisePrice =
    billing === "annual" ? `$${TIER_CONFIG.enterprise.annual}/yr` : `$${TIER_CONFIG.enterprise.monthly}/mo`;
  return (
    <div className="relative">
      {/* Blurred preview tease — shows what's locked */}
      <div className="space-y-6 select-none" aria-hidden="true">
        {/* Blurred Privacy Addendum preview */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 blur-sm opacity-60">
          <h3 className="text-base font-semibold text-white mb-4">Consumer Privacy Policy Addendum</h3>
          <div className="space-y-2">
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-5/6" />
            <div className="h-3 bg-gray-700 rounded w-4/6" />
            <div className="h-3 bg-gray-700 rounded w-full" />
            <div className="h-3 bg-gray-700 rounded w-3/4" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: Math.max(pixelCount, 1) }).map((_, i) => (
              <div key={i} className="p-3 bg-gray-800/50 rounded-lg">
                <div className="h-3 bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-700 rounded w-5/6 mt-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Blurred Checklist preview */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 blur-sm opacity-60">
          <h3 className="text-base font-semibold text-white mb-4">Developer Pre-Launch Checklist</h3>
          <div className="space-y-2">
            {Array.from({ length: Math.min(checklistCount, 6) }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="w-6 h-6 rounded-full bg-gray-700" />
                <div className="h-3 bg-gray-700 rounded flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Blurred Enterprise Modules preview */}
        {hasModules && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 blur-sm opacity-60">
            <h3 className="text-base font-semibold text-white mb-4">Enterprise Compliance Modules</h3>
            <div className="space-y-2">
              <div className="h-3 bg-gray-700 rounded w-full" />
              <div className="h-3 bg-gray-700 rounded w-4/5" />
              <div className="h-3 bg-gray-700 rounded w-3/4" />
            </div>
          </div>
        )}
      </div>

      {/* Conversion-Optimized Paywall Card — overlaid on blurred content */}
      <div className="absolute inset-0 flex items-start justify-center pt-8 z-10">
        <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-500/10">
          {/* Social proof bar */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="flex -space-x-2">
              {["bg-indigo-500", "bg-purple-500", "bg-pink-500", "bg-blue-500"].map((bg, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-full ${bg} border-2 border-gray-900 flex items-center justify-center`}
                >
                  <span className="text-xs text-white font-bold">{["J", "A", "M", "K"][i]}</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-400">1,400+ packages generated this month</span>
          </div>

          {/* Headline */}
          <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">Your package is ready.</h3>
          <p className="text-sm text-gray-400 text-center mb-2">
            Unlock {clauseCount} shield clauses, {checklistCount} checklist items, and {regionCount} jurisdiction
            {regionCount !== 1 ? "s" : ""} of coverage.
          </p>

          {/* Contextual paywall triggers (missing ADA / HIPAA coverage) */}
          {triggers.length > 0 && (
            <div className="mb-4 space-y-2">
              {triggers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5"
                >
                  <span className="text-amber-400 text-xs mt-0.5">&#9888;</span>
                  <div>
                    <p className="text-xs font-medium text-amber-300">{t.headline}</p>
                    <p className="text-xs text-gray-400">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pricing anchor */}
          <div className="text-center mb-5">
            <span className="text-xs text-gray-500">Average attorney compliance review: $2,000 &ndash; $5,000</span>
          </div>

          {/* What you get */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Included in your unlock</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                "Full privacy policy addendum",
                "Per-script legal disclosures",
                "Pre-launch compliance checklist",
                "Copy-to-clipboard export",
                "Markdown file download",
                regionCount > 1 ? `${regionCount} jurisdiction notices` : "Jurisdiction-specific notices",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs text-emerald-400">&#x2713;</span>
                  </span>
                  <span className="text-xs text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing cadence toggle (applies to subscription plans) */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="inline-flex rounded-full bg-gray-800 p-1">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  billing === "monthly" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling("annual")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  billing === "annual" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Annual
                <span className="ml-1 text-emerald-400">save ~17%</span>
              </button>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleCta("pro")}
              className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors relative overflow-hidden group"
            >
              <span className="relative z-10">
                Unlock with {TIER_CONFIG.pro.label} &mdash; {proPrice}
              </span>
              <span className="absolute inset-0 bg-white/5 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300" />
            </button>
            <button
              type="button"
              onClick={() => handleCta("agency")}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all"
            >
              Unlimited Agency Pass &mdash; {agencyPrice}
            </button>
            <button
              type="button"
              onClick={() => handleCta("enterprise")}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold hover:from-amber-500 hover:to-orange-500 transition-all"
            >
              Enterprise Tier &mdash; {enterprisePrice}
            </button>
          </div>

          {/* Trust signals */}
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>30-day money-back guarantee</span>
              <span>&middot;</span>
              <span>Instant access</span>
            </div>
            <span className="text-xs text-gray-600">Cancel anytime &middot; billed {billing}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function WizardCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
      <p className="text-sm text-gray-400 mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-4 text-sm text-gray-400 hover:text-white transition-colors">
      &larr; Back
    </button>
  );
}

function ResultSection({
  title,
  children,
  copiedText,
  onCopy,
  showCopy = true,
}: {
  title: string;
  children: React.ReactNode;
  copiedText: string | null;
  onCopy: (text: string) => void;
  showCopy?: boolean;
}) {
  const sectionId = `section-${title.replace(/\s+/g, "-")}`;

  const handleCopySection = () => {
    const el = document.getElementById(sectionId);
    if (el) {
      onCopy(el.innerText);
    }
  };

  const isCopied = copiedText !== null && document.getElementById(sectionId)?.innerText === copiedText;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {showCopy && (
          <button
            type="button"
            onClick={handleCopySection}
            className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            {isCopied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
      <div id={sectionId}>{children}</div>
    </div>
  );
}
