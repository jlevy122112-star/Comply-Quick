"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, Input, Select } from "@/components/ui";
import { ROLE_LABELS, assignableRoles, can, type Role } from "@/lib/rbac";
import type { OrgMember } from "@/lib/organizations-db";
import { addMemberAction, updateMemberRoleAction, removeMemberAction } from "./actions";

export function MembersPanel({ orgId, role, members }: { orgId: string; role: Role; members: OrgMember[] }) {
  const router = useRouter();
  const assignable = assignableRoles(role).filter((r) => r !== "owner");
  const canInvite = can(role, "member:invite");
  const canSetRole = can(role, "member:role");
  const canRemove = can(role, "member:remove");

  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("member");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy("invite");
    setError(null);
    try {
      const res = await addMemberAction(orgId, email, newRole);
      if (res.ok) {
        setEmail("");
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function changeRole(m: OrgMember, next: string) {
    setBusy(m.id);
    setError(null);
    try {
      const res = await updateMemberRoleAction(orgId, m.id, next);
      if (!res.ok) setError(res.error);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: OrgMember) {
    setBusy(m.id);
    setError(null);
    try {
      const res = await removeMemberAction(orgId, m.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {canInvite && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">Invite a member</h2>
            <p className="mt-1 text-sm text-gray-400">
              Add an existing Comply-Quick account by email and assign a role.
            </p>
            <form onSubmit={invite} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-gray-400">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Role</span>
                <Select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  {assignable.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </label>
              <Button type="submit" size="sm" disabled={busy === "invite"}>
                {busy === "invite" ? "Adding…" : "Add"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </CardBody>
        </Card>
      )}

      <div className="space-y-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
          >
            <div className="min-w-0">
              <span className="truncate text-sm font-medium text-white">{m.email ?? "Unknown user"}</span>
              {m.isOwner && (
                <Badge tone="indigo" className="ml-2">
                  Owner
                </Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canSetRole && !m.isOwner ? (
                <Select
                  value={m.role}
                  onChange={(e) => changeRole(m, e.target.value)}
                  disabled={busy === m.id}
                  className="w-32"
                >
                  {assignable.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              ) : (
                <Badge tone="gray">{ROLE_LABELS[m.role]}</Badge>
              )}
              {canRemove && !m.isOwner && (
                <Button size="sm" variant="ghost" disabled={busy === m.id} onClick={() => remove(m)}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
