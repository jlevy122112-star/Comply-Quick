"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  generateCompliancePackage,
  type UserType,
  type Framework,
  type TrackingPixel,
  type TargetRegion,
  type CompliancePackage,
} from "@/components/ClauseEngine";

// ─── Constants ──────────────────────────────────────────────────────────────

const USER_TYPE_OPTIONS: { value: UserType; label: string; description: string }[] = [
  { value: "developer", label: "Developer", description: "Web developer building for clients" },
  { value: "merchant", label: "Merchant", description: "Store owner managing your own site" },
];

const FRAMEWORK_OPTIONS: { value: Framework; label: string; icon: string }[] = [
  { value: "shopify", label: "Shopify", icon: "🛒" },
  { value: "nextjs", label: "Next.js", icon: "▲" },
  { value: "wordpress", label: "WordPress", icon: "📝" },
];

const PIXEL_OPTIONS: { value: TrackingPixel; label: string; color: string }[] = [
  { value: "meta", label: "Meta (Facebook)", color: "bg-blue-500" },
  { value: "google", label: "Google Analytics", color: "bg-yellow-500" },
  { value: "tiktok", label: "TikTok", color: "bg-pink-500" },
];

const REGION_OPTIONS: { value: TargetRegion; label: string; flag: string }[] = [
  { value: "us_general", label: "US General", flag: "🇺🇸" },
  { value: "california_ccpa", label: "California (CCPA)", flag: "🏴" },
  { value: "eu_gdpr", label: "EU (GDPR)", flag: "🇪🇺" },
];

const DISCLAIMER_TEXT =
  "Disclaimer: Comply-Quick provides automated operational templates based on technical configuration inputs. Comply-Quick is not a law firm, does not provide formal legal counsel, and the outputs generated does not constitute legal advice.";

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

export default function DashboardPage() {
  const searchParams = useSearchParams();

  // Wizard state
  const [step, setStep] = useState<number>(1);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [framework, setFramework] = useState<Framework | null>(null);
  const [trackingPixels, setTrackingPixels] = useState<TrackingPixel[]>([]);
  const [targetRegions, setTargetRegions] = useState<TargetRegion[]>([]);

  // Premium state — defaults to false
  const [isPremiumUser, setIsPremiumUser] = useState<boolean>(false);

  // Actively listen to URL query string for ?status=success
  // useSearchParams is reactive: component re-renders when params change,
  // so this instantly toggles premium when the param is detected
  const urlIndicatesPremium = searchParams.get("status") === "success";
  const premiumActive = isPremiumUser || urlIndicatesPremium;

  // Persist premium state once detected from URL (for navigation away and back)
  if (urlIndicatesPremium && !isPremiumUser) {
    setIsPremiumUser(true);
  }

  // Generated result
  const [compliancePackage, setCompliancePackage] = useState<CompliancePackage | null>(null);

  // Clipboard
  const [copiedText, copyToClipboard] = useCopyToClipboard();

  // Generate compliance package when wizard completes
  const handleGenerate = useCallback(() => {
    if (!userType || !framework) return;
    const result = generateCompliancePackage({
      userType,
      framework,
      trackingPixels,
      targetRegions,
    });
    setCompliancePackage(result);
    setStep(5);
  }, [userType, framework, trackingPixels, targetRegions]);

  // Toggle pixel selection
  const togglePixel = useCallback((pixel: TrackingPixel) => {
    setTrackingPixels((prev) =>
      prev.includes(pixel) ? prev.filter((p) => p !== pixel) : [...prev, pixel]
    );
  }, []);

  // Toggle region selection
  const toggleRegion = useCallback((region: TargetRegion) => {
    setTargetRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Comply-Quick
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Generate your compliance package in minutes
          </p>
        </header>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step >= s
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-500"
                }`}
              >
                {s}
              </div>
              {s < 4 && (
                <div
                  className={`w-8 sm:w-12 h-0.5 transition-colors ${
                    step > s ? "bg-indigo-600" : "bg-gray-800"
                  }`}
                />
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
                  <span className="block text-lg font-semibold text-white">
                    {option.label}
                  </span>
                  <span className="block mt-1 text-sm text-gray-400">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </WizardCard>
        )}

        {/* Step 2: Framework */}
        {step === 2 && (
          <WizardCard title="Choose your framework" subtitle="Which platform are you building on?">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <span className="block text-sm font-medium text-white">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
            <BackButton onClick={() => setStep(1)} />
          </WizardCard>
        )}

        {/* Step 3: Tracking Pixels */}
        {step === 3 && (
          <WizardCard title="Active tracking pixels" subtitle="Select all that apply">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <span className="block text-sm font-medium text-white">
                    {option.label}
                  </span>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <span className="block text-sm font-medium text-white">
                    {option.label}
                  </span>
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
                onClick={handleGenerate}
                disabled={targetRegions.length === 0}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate Compliance Package
              </button>
            </div>
          </WizardCard>
        )}

        {/* Step 5: Results */}
        {step === 5 && compliancePackage && (
          <div className="relative">
            {/* Results Content */}
            <div className="space-y-6">
              {/* Inward Contract Shield */}
              <ResultSection
                title="Inward Contract Shield"
                copiedText={copiedText}
                onCopy={copyToClipboard}
              >
                <p className="text-sm text-gray-300 mb-4">
                  {compliancePackage.inwardContractShield.preamble}
                </p>
                {compliancePackage.inwardContractShield.clauses.map((clause) => (
                  <div key={clause.title} className="mb-4 last:mb-0">
                    <h4 className="text-sm font-semibold text-indigo-400 mb-1">
                      {clause.title}
                    </h4>
                    <p className="text-sm text-gray-400">{clause.body}</p>
                  </div>
                ))}
              </ResultSection>

              {/* Privacy Policy Addendum */}
              <ResultSection
                title="Consumer Privacy Policy Addendum"
                copiedText={copiedText}
                onCopy={copyToClipboard}
              >
                <p className="text-sm text-gray-300 mb-4 whitespace-pre-line">
                  {compliancePackage.consumerPrivacyPolicyAddendum.header}
                </p>
                {compliancePackage.consumerPrivacyPolicyAddendum.scriptDeclarations.map(
                  (declaration, i) => (
                    <div key={i} className="mb-3 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-sm text-gray-300">{declaration}</p>
                    </div>
                  )
                )}
                {compliancePackage.consumerPrivacyPolicyAddendum.regionalDisclosures.map(
                  (disclosure, i) => (
                    <div key={i} className="mb-3 p-3 bg-gray-800/50 rounded-lg border-l-2 border-indigo-500">
                      <p className="text-sm text-gray-300">{disclosure}</p>
                    </div>
                  )
                )}
              </ResultSection>

              {/* Developer Pre-Launch Checklist */}
              <ResultSection
                title="Developer Pre-Launch Checklist"
                copiedText={copiedText}
                onCopy={copyToClipboard}
              >
                <p className="text-sm text-gray-400 mb-4 italic">
                  {compliancePackage.developerPreLaunchChecklist.frameworkNotes}
                </p>
                <div className="space-y-2">
                  {compliancePackage.developerPreLaunchChecklist.items.map((item) => (
                    <div
                      key={item.step}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-800/30"
                    >
                      <span
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          item.critical
                            ? "bg-red-500/20 text-red-400"
                            : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {item.step}
                      </span>
                      <span className="text-sm text-gray-300">{item.action}</span>
                    </div>
                  ))}
                </div>
              </ResultSection>

              {/* Reset Button */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setCompliancePackage(null);
                    setUserType(null);
                    setFramework(null);
                    setTrackingPixels([]);
                    setTargetRegions([]);
                  }}
                  className="px-5 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:border-gray-500 hover:text-white transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>

            {/* Paywall Overlay */}
            {!premiumActive && (
              <div className="absolute inset-0 backdrop-blur-md bg-gray-950/40 rounded-2xl flex items-center justify-center p-4 z-10">
                <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-600/20 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-indigo-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    Unlock Your Compliance Package
                  </h3>
                  <p className="text-sm text-gray-400 mb-6">
                    Your custom compliance documents have been generated. Choose a plan to access,
                    copy, and deploy your legal protection package.
                  </p>
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="w-full py-3 px-4 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
                    >
                      One-Time Access — $12
                    </button>
                    <button
                      type="button"
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all"
                    >
                      Unlimited Pass — $29/month
                    </button>
                  </div>
                  <p className="mt-4 text-xs text-gray-500">
                    Instant access after payment. No recurring commitment on one-time purchases.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mandatory Disclaimer */}
        <footer className="mt-12 pt-6 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center leading-relaxed">
            {DISCLAIMER_TEXT}
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function WizardCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
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
    <button
      type="button"
      onClick={onClick}
      className="mt-4 text-sm text-gray-400 hover:text-white transition-colors"
    >
      &larr; Back
    </button>
  );
}

function ResultSection({
  title,
  children,
  copiedText,
  onCopy,
}: {
  title: string;
  children: React.ReactNode;
  copiedText: string | null;
  onCopy: (text: string) => void;
}) {
  const handleCopySection = () => {
    const el = document.getElementById(`section-${title.replace(/\s+/g, "-")}`);
    if (el) {
      onCopy(el.innerText);
    }
  };

  const sectionId = `section-${title.replace(/\s+/g, "-")}`;
  const isCopied = copiedText !== null && document.getElementById(sectionId)?.innerText === copiedText;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <button
          type="button"
          onClick={handleCopySection}
          className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
        >
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div id={sectionId}>{children}</div>
    </div>
  );
}
