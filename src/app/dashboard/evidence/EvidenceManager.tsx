"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  ScoreRing,
  Badge,
  Button,
  SeverityPill,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/components/ui";
import type { AuditEvidencePack, EvidenceStatus } from "@/lib/agents";
import type { EvidenceRecord } from "@/lib/evidence-db";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import { compileEvidenceAction, setEvidenceStatusAction } from "./actions";

const STATUS_TONE: Record<EvidenceStatus, "emerald" | "amber" | "gray"> = {
  collected: "emerald",
  missing: "amber",
  not_applicable: "gray",
};
const STATUS_LABEL: Record<EvidenceStatus, string> = {
  collected: "Collected",
  missing: "Missing",
  not_applicable: "N/A",
};
const RISK_SEVERITY = { high: "critical", medium: "warning", low: "info" } as const;

export function EvidenceManager({
  framework,
  pack,
  records,
}: {
  framework: RegulationFrameworkId;
  pack: AuditEvidencePack | null;
  records: EvidenceRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  // Map controlId → persisted record so each row can update its own status.
  const recordByControl = new Map(records.map((r) => [r.controlId, r]));

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function compile() {
    setBusy("compile");
    try {
      await compileEvidenceAction(framework);
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function updateStatus(controlId: string, status: EvidenceStatus) {
    const rec = recordByControl.get(controlId);
    if (!rec) {
      // No row yet — compile the pack first to materialize rows, then retry.
      await compileEvidenceAction(framework);
      refresh();
      return;
    }
    setBusy(controlId);
    try {
      await setEvidenceStatusAction(rec.id, status);
      refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!pack) {
    return (
      <EmptyState
        icon="📁"
        title="No static control catalog for this framework"
        description="Full-text frameworks are sourced live by the ingestion pipeline. Pick SOC 2, ISO 27001, or PCI DSS to build an evidence pack now."
      />
    );
  }

  const saved = records.length > 0;
  const disabled = busy !== null || isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <ScoreRing score={pack.readiness} size="lg" label="ready" />
            <div>
              <h2 className="text-lg font-semibold text-white">Audit readiness</h2>
              <p className="mt-1 text-sm text-gray-400">
                {pack.collected} of {pack.collected + pack.missing} applicable controls have evidence
                {pack.missing > 0 ? ` · ${pack.missing} outstanding` : " · audit-ready"}.
              </p>
              {saved && <p className="mt-0.5 text-xs text-gray-500">Saved pack — updates persist automatically.</p>}
            </div>
          </div>
          <Button onClick={compile} disabled={disabled}>
            {busy === "compile" ? "Compiling…" : saved ? "Re-compile pack" : "Compile & save pack"}
          </Button>
        </CardBody>
      </Card>

      <Table>
        <THead>
          <TR>
            <TH>Risk</TH>
            <TH>Control</TH>
            <TH>Required evidence</TH>
            <TH>Status</TH>
            <TH className="text-right">Set</TH>
          </TR>
        </THead>
        <TBody>
          {pack.items.map((item) => (
            <TR key={item.controlId}>
              <TD>
                <SeverityPill severity={RISK_SEVERITY[item.riskLevel]} />
              </TD>
              <TD>
                <div className="font-medium text-white">
                  <span className="tabular-nums text-gray-400">{item.controlId}</span> {item.controlTitle}
                </div>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Official source ↗
                  </a>
                )}
              </TD>
              <TD className="max-w-sm text-sm text-gray-400">
                <ul className="list-disc pl-4">
                  {item.requiredEvidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </TD>
              <TD>
                <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
              </TD>
              <TD className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant={item.status === "collected" ? "primary" : "secondary"}
                    disabled={disabled}
                    onClick={() => updateStatus(item.controlId, "collected")}
                  >
                    {busy === item.controlId ? "…" : "Collected"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      updateStatus(item.controlId, item.status === "not_applicable" ? "missing" : "not_applicable")
                    }
                  >
                    {item.status === "not_applicable" ? "Undo N/A" : "N/A"}
                  </Button>
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
