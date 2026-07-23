"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, EmptyState, Input } from "@/components/ui";
import { can, type Role } from "@/lib/rbac";
import type { Workspace } from "@/lib/workspaces-db";
import { createWorkspaceAction, deleteWorkspaceAction } from "./actions";

export function WorkspacesPanel({ orgId, role, workspaces }: { orgId: string; role: Role; workspaces: Workspace[] }) {
  const router = useRouter();
  const canCreate = can(role, "workspace:create");
  const canDelete = can(role, "workspace:delete");

  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError(null);
    try {
      const res = await createWorkspaceAction(orgId, name);
      if (res.ok) {
        setName("");
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(w: Workspace) {
    setBusy(w.id);
    setError(null);
    try {
      const res = await deleteWorkspaceAction(orgId, w.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {canCreate && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">New Workspace</h2>
            <p className="mt-1 text-sm text-gray-400">
              Workspaces group projects for a team or client engagement inside your organization.
            </p>
            <form onSubmit={create} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-gray-400">Name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. EU Compliance"
                />
              </label>
              <Button type="submit" size="sm" disabled={busy === "new"}>
                {busy === "new" ? "Creating…" : "Create"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </CardBody>
        </Card>
      )}

      {workspaces.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No Workspaces Yet"
          description="Create a workspace to organize projects by team or client."
        />
      ) : (
        <div className="space-y-2">
          {workspaces.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
            >
              <div className="min-w-0">
                <span className="truncate text-sm font-medium text-white">{w.name}</span>
                <p className="mt-0.5 text-xs text-gray-500">
                  {w.projectCount} {w.projectCount === 1 ? "project" : "projects"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="gray">{w.slug}</Badge>
                {canDelete && (
                  <Button size="sm" variant="ghost" disabled={busy === w.id} onClick={() => remove(w)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
