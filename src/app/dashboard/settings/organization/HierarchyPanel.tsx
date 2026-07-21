"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input, Select } from "@/components/ui";
import { can, type Role } from "@/lib/rbac";
import type { Organization } from "@/lib/organizations";
import { createChildOrganizationAction, moveOrganizationAction } from "./actions";

function buildTree(orgs: Organization[], parentId: string | null): Organization[] {
  return orgs
    .filter((o) => o.parentOrganizationId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function descendants(orgs: Organization[], orgId: string): Set<string> {
  const result = new Set<string>();
  const children = orgs.filter((o) => o.parentOrganizationId === orgId);
  for (const child of children) {
    result.add(child.id);
    for (const d of descendants(orgs, child.id)) result.add(d);
  }
  return result;
}

export function HierarchyPanel({
  orgs,
  currentOrgId,
  role,
  isEnabled,
}: {
  orgs: Organization[];
  currentOrgId: string;
  role: Role;
  isEnabled: boolean;
}) {
  const router = useRouter();
  const canManage = can(role, "org:update") && isEnabled;
  const [newName, setNewName] = useState("");
  const [selectedParent, setSelectedParent] = useState<string>(currentOrgId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roots = useMemo(() => buildTree(orgs, null), [orgs]);

  async function createChild(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const res = await createChildOrganizationAction(selectedParent, newName);
      if (res.ok) {
        setNewName("");
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function move(orgId: string, newParentId: string | null) {
    setBusy(orgId);
    setError(null);
    try {
      const res = await moveOrganizationAction(orgId, newParentId);
      if (!res.ok) setError(res.error);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function TreeItem({ org, depth }: { org: Organization; depth: number }) {
    const children = buildTree(orgs, org.id);
    const excludedForMove = new Set([org.id, ...descendants(orgs, org.id)]);
    const moveTargets = orgs.filter((o) => !excludedForMove.has(o.id));

    return (
      <div className={depth > 0 ? "ml-4 border-l border-gray-800 pl-4" : ""}>
        <div className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{org.name}</p>
            <p className="text-xs text-gray-500">{org.slug}</p>
          </div>
          {canManage && (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const select = form.elements.namedItem("parent") as HTMLSelectElement;
                move(org.id, select.value === "" ? null : select.value);
              }}
            >
              <Select
                name="parent"
                defaultValue={org.parentOrganizationId ?? ""}
                disabled={busy === org.id}
                className="w-48 text-xs"
              >
                <option value="">No parent (root)</option>
                {moveTargets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" size="sm" disabled={busy === org.id}>
                Move
              </Button>
            </form>
          )}
        </div>
        {children.map((child) => (
          <TreeItem key={child.id} org={child} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isEnabled && (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-300">
              Nested organization hierarchies are an Enterprise feature. Upgrade to create
              sub-organizations such as regions, departments, or client accounts.
            </p>
          </CardBody>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader
            title="Create sub-organization"
            description="Add a region, department, or client org under the selected parent."
          />
          <CardBody>
            <form onSubmit={createChild} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-gray-400">Name</span>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. EMEA Region"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Parent</span>
                <Select value={selectedParent} onChange={(e) => setSelectedParent(e.target.value)}>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </Select>
              </label>
              <Button type="submit" size="sm" disabled={busy === "create" || !newName.trim()}>
                {busy === "create" ? "Creating…" : "Create"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Organization hierarchy"
          description="Organizations you can administer, including inherited sub-orgs."
        />
        <CardBody>
          <div className="space-y-3">
            {roots.map((org) => (
              <TreeItem key={org.id} org={org} depth={0} />
            ))}
            {roots.length === 0 && <p className="text-sm text-gray-400">No organizations visible.</p>}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
