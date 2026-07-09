"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * Approve / reject controls for a single autopilot proposal. Calls the existing
 * PATCH /api/autopilot/proposals/[id] endpoint (human-in-the-loop: nothing is
 * applied until the user confirms here) and refreshes the workspace on success.
 */
export function ApprovalActions({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);

  async function resolve(action: "accept" | "reject") {
    setError(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/autopilot/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not update this proposal.");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || isPending;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => resolve("reject")}>
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </Button>
        <Button size="sm" disabled={disabled} onClick={() => resolve("accept")}>
          {busy === "accept" ? "Applying…" : "Approve & apply"}
        </Button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
