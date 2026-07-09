"use client";

import { useState, useTransition } from "react";
import { Badge, SeverityPill, Select } from "@/components/ui";
import type { DbFinding, FindingStatus } from "@/lib/findings-db";
import { setFindingStatusAction, assignFindingAction } from "./actions";

const STATUS_LABEL: Record<FindingStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  reopened: "Reopened",
};

const STATUS_TONE: Record<FindingStatus, "rose" | "amber" | "emerald" | "sky"> = {
  open: "rose",
  in_progress: "amber",
  reopened: "amber",
  resolved: "emerald",
};

function FindingRow({ finding }: { finding: DbFinding }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<FindingStatus>(finding.status);
  const [owner, setOwner] = useState(finding.owner ?? "");
  const [savedOwner, setSavedOwner] = useState(finding.owner ?? "");

  function changeStatus(next: FindingStatus) {
    setStatus(next);
    startTransition(() => setFindingStatusAction(finding.id, next));
  }

  function commitOwner() {
    if (owner.trim() === savedOwner.trim()) return;
    setSavedOwner(owner);
    startTransition(() => assignFindingAction(finding.id, owner));
  }

  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900/40 p-4 transition-opacity ${isPending ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <SeverityPill severity={finding.severity} />
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            <span className="text-xs text-gray-500">{finding.category}</span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">{finding.title}</h3>
          <p className="mt-1 text-sm text-gray-400">{finding.detail}</p>
          {finding.recommendation && <p className="mt-2 text-sm text-indigo-300">→ {finding.recommendation}</p>}
          <p className="mt-2 text-xs text-gray-600">
            First seen {new Date(finding.firstDetectedAt).toLocaleDateString()} &middot; Last seen{" "}
            {new Date(finding.lastDetectedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-56">
          <label className="text-xs font-medium text-gray-400">
            Status
            <Select
              value={status}
              onChange={(e) => changeStatus(e.target.value as FindingStatus)}
              disabled={isPending}
              className="mt-1"
            >
              {(Object.keys(STATUS_LABEL) as FindingStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-medium text-gray-400">
            Owner
            <input
              type="text"
              value={owner}
              placeholder="Unassigned"
              onChange={(e) => setOwner(e.target.value)}
              onBlur={commitOwner}
              disabled={isPending}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export function FindingsManager({ findings }: { findings: DbFinding[] }) {
  return (
    <div className="space-y-3">
      {findings.map((f) => (
        <FindingRow key={f.id} finding={f} />
      ))}
    </div>
  );
}
