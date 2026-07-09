"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, DiffViewer, Badge } from "@/components/ui";
import type { ComplianceScore } from "@/components/ClauseEngine";
import { regeneratePackageAction, applyRegeneratedPackageAction, type RegeneratePreview } from "./policy-actions";

/**
 * Human-in-the-loop policy regeneration. Regenerates the package from the
 * project's current inputs, shows a line diff against the stored version in a
 * modal, and only applies it when the user explicitly approves.
 */
export function PolicyRegenerate({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<RegeneratePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review() {
    setError(null);
    setLoading(true);
    setOpen(true);
    try {
      const res = await regeneratePackageAction(projectId);
      if (!res.ok) {
        setError(res.error ?? "Could not regenerate.");
        return;
      }
      setPreview(res);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!preview?.score) return;
    setApplying(true);
    try {
      const res = await applyRegeneratedPackageAction(projectId, preview.after, preview.score as ComplianceScore);
      if (!res.ok) {
        setError(res.error ?? "Could not apply.");
        return;
      }
      setOpen(false);
      setPreview(null);
      startTransition(() => router.refresh());
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={review} disabled={loading}>
        {loading ? "Regenerating…" : "Regenerate & review"}
      </Button>

      <Modal
        open={open}
        onClose={() => (applying ? null : setOpen(false))}
        title="Review regenerated package"
        description="Regenerated from this project's current inputs. Nothing changes until you apply it."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={applying}>
              Cancel
            </Button>
            <Button size="sm" onClick={apply} disabled={applying || loading || !preview?.hasChanges}>
              {applying ? "Applying…" : "Apply update"}
            </Button>
          </div>
        }
        className="max-w-2xl"
      >
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400">Regenerating package…</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : preview ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {preview.hasChanges ? (
                <Badge tone="amber">Changes detected</Badge>
              ) : (
                <Badge tone="emerald">Already up to date</Badge>
              )}
              {preview.score && (
                <span className="text-xs text-gray-500">New overall score: {preview.score.overall}</span>
              )}
            </div>
            <DiffViewer
              before={preview.before}
              after={preview.after}
              emptyLabel="The regenerated package is identical to the stored one."
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
