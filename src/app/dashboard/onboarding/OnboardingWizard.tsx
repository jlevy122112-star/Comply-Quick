"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Framework } from "@/components/ClauseEngine";
import type { OnboardingAnswers, OnboardingRecommendation } from "@/lib/agents/onboarding";
import { recommendOnboardingAction, createProjectFromOnboardingAction } from "./actions";
import { OnboardingStepBusiness } from "./OnboardingStepBusiness";
import { OnboardingStepReview } from "./OnboardingStepReview";
import { OnboardingStepDone } from "./OnboardingStepDone";

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

  const toggle = useCallback((key: keyof OnboardingAnswers) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleRecommend = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await recommendOnboardingAction({ description, ...flags });
      setRec(result);
      setStep(2);
    } catch {
      setError("Could not build a recommendation. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [description, flags]);

  const handleApply = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createProjectFromOnboardingAction({
        answers: { description, ...flags },
        framework,
        projectName,
      });
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
  }, [description, flags, framework, projectName, router]);

  return (
    <div className="mx-auto max-w-3xl">
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

      {step === 1 && (
        <OnboardingStepBusiness
          description={description}
          onDescriptionChange={setDescription}
          flags={flags}
          onToggle={toggle}
          framework={framework}
          onFrameworkChange={setFramework}
          busy={busy}
          onRecommend={handleRecommend}
        />
      )}

      {step === 2 && rec && (
        <OnboardingStepReview
          rec={rec}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          busy={busy}
          onBack={() => setStep(1)}
          onApply={handleApply}
        />
      )}

      {step === 3 && <OnboardingStepDone />}
    </div>
  );
}
