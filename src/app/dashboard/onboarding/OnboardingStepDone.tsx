import Link from "next/link";
import { Card, CardBody, ScoreRing } from "@/components/ui";

/** Step 3 — brief success confirmation shown before the redirect to the project. */
export function OnboardingStepDone() {
  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
        <ScoreRing score={100} label="Ready" />
        <div>
          <h2 className="text-lg font-semibold text-white">Project Created</h2>
          <p className="mt-1 text-sm text-gray-400">Taking you to your new compliance workspace…</p>
        </div>
        <Link href="/dashboard/home" className="text-sm text-indigo-400 hover:text-indigo-300">
          Back to Command Center
        </Link>
      </CardBody>
    </Card>
  );
}
