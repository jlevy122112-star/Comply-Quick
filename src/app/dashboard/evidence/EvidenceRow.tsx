"use client";

import { Badge, Button, SeverityPill, TR, TD } from "@/components/ui";
import type { EvidenceItem, EvidenceStatus } from "@/lib/agents";

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

/** One control's evidence row: risk, control, required evidence, status + controls. */
export function EvidenceRow({
  item,
  busy,
  disabled,
  onSet,
}: {
  item: EvidenceItem;
  busy: boolean;
  disabled: boolean;
  onSet: (controlId: string, status: EvidenceStatus) => void;
}) {
  return (
    <TR>
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
            onClick={() => onSet(item.controlId, "collected")}
          >
            {busy ? "…" : "Collected"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => onSet(item.controlId, item.status === "not_applicable" ? "missing" : "not_applicable")}
          >
            {item.status === "not_applicable" ? "Undo N/A" : "N/A"}
          </Button>
        </div>
      </TD>
    </TR>
  );
}
