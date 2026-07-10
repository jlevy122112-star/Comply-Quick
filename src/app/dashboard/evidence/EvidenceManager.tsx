"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, Table, THead, TBody, TR, TH } from "@/components/ui";
import type { AuditEvidencePack, EvidenceStatus } from "@/lib/agents";
import type { EvidenceRecord } from "@/lib/evidence-db";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import { compileEvidenceAction, setEvidenceStatusAction } from "./actions";
import { EvidenceReadinessCard } from "./EvidenceReadinessCard";
import { EvidenceRow } from "./EvidenceRow";

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
      <EvidenceReadinessCard
        pack={pack}
        saved={saved}
        busy={busy === "compile"}
        disabled={disabled}
        onCompile={compile}
      />

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
            <EvidenceRow
              key={item.controlId}
              item={item}
              busy={busy === item.controlId}
              disabled={disabled}
              onSet={updateStatus}
            />
          ))}
        </TBody>
      </Table>
    </div>
  );
}
