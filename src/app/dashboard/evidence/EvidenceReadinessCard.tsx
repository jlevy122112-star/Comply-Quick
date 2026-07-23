"use client";

import { Card, CardBody, ScoreRing, Button } from "@/components/ui";
import type { AuditEvidencePack } from "@/lib/agents";

/** Readiness summary + compile/re-compile action for an evidence pack. */
export function EvidenceReadinessCard({
  pack,
  saved,
  busy,
  disabled,
  onCompile,
}: {
  pack: AuditEvidencePack;
  saved: boolean;
  busy: boolean;
  disabled: boolean;
  onCompile: () => void;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <ScoreRing score={pack.readiness} size="lg" label="Ready" />
          <div>
            <h2 className="text-lg font-semibold text-white">Audit readiness</h2>
            <p className="mt-1 text-sm text-gray-400">
              {pack.collected} of {pack.collected + pack.missing} applicable controls have evidence
              {pack.missing > 0 ? ` · ${pack.missing} outstanding` : " · audit-ready"}.
            </p>
            {saved && <p className="mt-0.5 text-xs text-gray-500">Saved pack — updates persist automatically.</p>}
          </div>
        </div>
        <Button onClick={onCompile} disabled={disabled}>
          {busy ? "Compiling…" : saved ? "Re-compile pack" : "Compile & save pack"}
        </Button>
      </CardBody>
    </Card>
  );
}
