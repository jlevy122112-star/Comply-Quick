"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, ScoreRing } from "@/components/ui";
import type { Framework } from "@/components/ClauseEngine";
import { REGULATION_SOURCES } from "@/lib/regulations/sources/registry";
import type { OnboardingAnswers, OnboardingRecommendation } from "@/lib/agents/onboarding";
import { recommendOnboardingAction, createProjectFromOnboardingAction } from "./actions";

const PLATFORMS: { value: Framework; label: string; icon: string }[] = [
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

const TOGGLES: { key: keyof OnboardingAnswers; label: string; hint: string }[] = [
  { key: "sellsOnline", label: "We sell online / take payments", hint: "Adds payment & consumer protections" },
  { key: "handlesHealthData", label: "We handle health data", hint: "Triggers HIPAA/health coverage" },
  { key: "servesEu", label: "We serve EU / UK users", hint: "Adds GDPR obligations" },
  { key: "isAgency", label: "We're an agency managing client sites", hint: "Enables multi-project posture" },
];

const REGION_LABELS: Record<string, string> = {
  us_general: "United States",
  california_ccpa: "California (CCPA/CPRA)",
  eu_gdpr: "European Union (GDPR)",
  canada_pipeda: "Canada (PIPEDA)",
  brazil_lgpd: "Brazil (LGPD)",
  australia_privacy: "Australia",
};

function frameworkLabel(id: string): string {
  return REGULATION_SOURCES[id as keyof typeof REGULATION_SOURCES]?.label ?? id.toUpperCase();
}

type Step = 1 | 2 | 3;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  const [description, setDescription] = useState("");
  const [flags, setFlags] = useState<Partial<OnboardingAnswers>>({});
  const [framework, setFramework] = useState<Framework>("nextjs");
  const [projectName, setProjectName] = useState("");

  const [rec, setRec] = useState<OnboardingRecommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answers: OnboardingAnswers = { description, ...flags };

  const toggle = useCallback((key: keyof OnboardingAnswers) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleRecommend = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await recommendOnboardingAction(answers);
      setRec(result);
      setStep(2);
    } catch {
      setError("Could not build a recommendation. Please try again.");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, flags]);

  const handleApply = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createProjectFromOnboardingAction({ answers, framework, projectName });
      if (res.ok) {
        setStep(3);
        router.push(`/dashboard/projects/${res.projectId}`);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Setup failed. Please try again.");
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description, flags, framework, projectName, router]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                step >= s ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-500"
              }`}
            >
              {s}
            </div>
            {s < 2 && <div className={`h-0.5 w-12 ${step > s ? "bg-indigo-600" : "bg-gray-800"}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Step 1 — answers */}
      {step === 1 && (
        <Card>
          <CardBody className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Tell us about your business</h2>
              <p className="mt-1 text-sm text-gray-400">
                The Onboarding agent classifies your industry and recommends exactly which frameworks and jurisdictions
                to track — nothing is created until you approve it.
              </p>
            </div>

            <div>
              <label htmlFor="ob-desc" className="mb-1.5 block text-sm font-medium text-gray-300">
                What does your product do?
              </label>
              <textarea
                id="ob-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. A telehealth platform that lets clinics book patient appointments online."
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              {TOGGLES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => toggle(t.key)}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    flags[t.key]
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-gray-700 bg-gray-900 hover:border-gray-600"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-medium text-white">{t.label}</span>
                    <span className="block text-xs text-gray-500">{t.hint}</span>
                  </span>
                  <span
                    className={`ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                      flags[t.key] ? "border-indigo-400 bg-indigo-500 text-white" : "border-gray-600 text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Platform</label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFramework(p.value)}
                    className={`rounded-lg border px-3 py-2 text-center text-sm transition-colors ${
                      framework === p.value
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    <span className="mr-1">{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleRecommend} disabled={busy || description.trim().length < 3}>
                {busy ? "Analyzing…" : "Get recommendation →"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 2 — review & approve */}
      {step === 2 && rec && (
        <Card>
          <CardBody className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge tone="sky">Recommended setup</Badge>
                <h2 className="mt-2 text-lg font-semibold text-white">{rec.industryLabel}</h2>
                <p className="mt-1 text-sm text-gray-400">{rec.rationale}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-300">
                Frameworks to track ({rec.frameworks.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {rec.frameworks.map((f) => (
                  <span
                    key={f}
                    className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300"
                  >
                    {frameworkLabel(f)}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-300">Jurisdictions</h3>
              <div className="flex flex-wrap gap-2">
                {rec.regions.map((r) => (
                  <Badge key={r} tone="gray">
                    {REGION_LABELS[r] ?? r}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-300">Setup plan</h3>
              <ol className="space-y-2">
                {rec.plan.actions.map((a, i) => (
                  <li key={a.type} className="flex gap-3 rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-medium text-indigo-300">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-300">{a.detail}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <label htmlFor="ob-name" className="mb-1.5 block text-sm font-medium text-gray-300">
                Project name
              </label>
              <input
                id="ob-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={`${rec.industryLabel} project`}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(1)} disabled={busy}>
                ← Back
              </Button>
              <Button onClick={handleApply} disabled={busy}>
                {busy ? "Creating project…" : "Approve & create project"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Step 3 — done (brief, before redirect) */}
      {step === 3 && (
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
            <ScoreRing score={100} label="ready" />
            <div>
              <h2 className="text-lg font-semibold text-white">Project created</h2>
              <p className="mt-1 text-sm text-gray-400">Taking you to your new compliance workspace…</p>
            </div>
            <Link href="/dashboard/home" className="text-sm text-indigo-400 hover:text-indigo-300">
              Back to Command Center
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
