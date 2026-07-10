"use client";

import { Button, Card, CardBody } from "@/components/ui";
import type { Framework } from "@/components/ClauseEngine";
import type { OnboardingAnswers } from "@/lib/agents/onboarding";
import { PLATFORMS, TOGGLES } from "./wizard-constants";

/** Step 1 — business profile intake: description, industry toggles, platform. */
export function OnboardingStepBusiness({
  description,
  onDescriptionChange,
  flags,
  onToggle,
  framework,
  onFrameworkChange,
  busy,
  onRecommend,
}: {
  description: string;
  onDescriptionChange: (value: string) => void;
  flags: Partial<OnboardingAnswers>;
  onToggle: (key: keyof OnboardingAnswers) => void;
  framework: Framework;
  onFrameworkChange: (value: Framework) => void;
  busy: boolean;
  onRecommend: () => void;
}) {
  return (
    <Card>
      <CardBody className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Tell us about your business</h2>
          <p className="mt-1 text-sm text-gray-400">
            The Onboarding agent classifies your industry and recommends exactly which frameworks and jurisdictions to
            track — nothing is created until you approve it.
          </p>
        </div>

        <div>
          <label htmlFor="ob-desc" className="mb-1.5 block text-sm font-medium text-gray-300">
            What does your product do?
          </label>
          <textarea
            id="ob-desc"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
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
              onClick={() => onToggle(t.key)}
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
                onClick={() => onFrameworkChange(p.value)}
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
          <Button onClick={onRecommend} disabled={busy || description.trim().length < 3}>
            {busy ? "Analyzing…" : "Get recommendation →"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
