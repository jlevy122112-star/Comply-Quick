"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Button, Badge, EmptyState } from "@/components/ui";
import type { ProjectMember, ProjectMemberRole } from "@/lib/workspace/members";
import { addProjectMemberAction, removeProjectMemberAction } from "./member-actions";

const ROLE_TONE: Record<ProjectMemberRole, "indigo" | "sky" | "gray"> = {
  owner: "indigo",
  editor: "sky",
  viewer: "gray",
};

export function TeamPanel({ projectId, members }: { projectId: string; members: ProjectMember[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectMemberRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await addProjectMemberAction(projectId, email, role);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(memberId: string) {
    setBusy(true);
    try {
      await removeProjectMemberAction(projectId, memberId);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-white">Share this project</h2>
          <p className="mt-1 text-sm text-gray-400">
            Invite a teammate (by the email on their Comply-Quick account) to collaborate. They get read access to this
            project&apos;s scans, findings, and tasks.
          </p>
          <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ProjectMemberRole)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <Button type="submit" disabled={disabled || !email}>
              {busy ? "Adding…" : "Add collaborator"}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        </CardBody>
      </Card>

      {members.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No collaborators yet"
          description="This project is private to you. Invite a teammate above to share it."
        />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{m.email || m.userId}</p>
                <p className="text-xs text-gray-500">Added {new Date(m.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={ROLE_TONE[m.role]}>{m.role}</Badge>
                <Button variant="ghost" size="sm" disabled={disabled} onClick={() => remove(m.id)}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
