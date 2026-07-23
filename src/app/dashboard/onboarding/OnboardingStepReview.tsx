"use client";

import { Badge, Button, Card, CardBody } from "@/components/ui";
import type { OnboardingRecommendation } from "@/lib/agents/onboarding";
import { REGION_LABELS, frameworkLabel } from "./wizard-constants";

/** Step 2 — review the agent recommendation, name the project, approve. */
export function OnboardingStepReview({
  rec,
  projectName,
  onProjectNameChange,
  busy,
  onBack,
  onApply,
}: {
  rec: OnboardingRecommendation;
  projectName: string;
  onProjectNameChange: (value: string) => void;
  busy: boolean;
  onBack: () => void;
  onApply: () => void;
}) {
  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone="sky">Recommended Setup</Badge>
            <h2 className="mt-2 text-lg font-semibold text-white">{rec.industryLabel}</h2>
            <p className="mt-1 text-sm text-gray-400">{rec.rationale}</p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-300">Frameworks to Track ({rec.frameworks.length})</h3>
          <div className="flex flex-wrap gap-2">
            {rec.frameworks.map((f) => (
              <span key={f} className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300">
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
          <h3 className="mb-2 text-sm font-semibold text-gray-300">Setup Plan</h3>
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
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder={`${rec.industryLabel} project`}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={onBack} disabled={busy}>
            ← Back
          </Button>
          <Button onClick={onApply} disabled={busy}>
            {busy ? "Creating project…" : "Approve & create project"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
