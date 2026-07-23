"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Network, Building, ChevronRight, ChevronDown, Plus, ArrowRightLeft } from "lucide-react";
import { Button, Card, CardHeader, CardBody, Badge } from "@/components/ui";
import { Input, Select } from "@/components/ui/Field";
import type { OrganizationTreeNode, OrganizationKind } from "@/lib/org-hierarchy";
import { createChildOrganizationAction, reparentOrganizationAction } from "./actions";

const KIND_TONE: Record<OrganizationKind, "indigo" | "sky" | "violet"> = {
  organization: "indigo",
  department: "sky",
  region: "violet",
};

const KIND_LABEL: Record<OrganizationKind, string> = {
  organization: "Organization",
  department: "Department",
  region: "Region",
};

function descendantIds(node: OrganizationTreeNode): Set<string> {
  const ids = new Set<string>();
  for (const child of node.children) {
    ids.add(child.id);
    for (const id of descendantIds(child)) ids.add(id);
  }
  return ids;
}

function flatten(node: OrganizationTreeNode): OrganizationTreeNode[] {
  const out = [node];
  for (const child of node.children) out.push(...flatten(child));
  return out;
}

function TreeNode({
  node,
  canManage,
  options,
  onMove,
  movingId,
}: {
  node: OrganizationTreeNode;
  canManage: boolean;
  options: OrganizationTreeNode[];
  onMove: (id: string, parent: string | null) => void;
  movingId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isMoving = movingId === node.id;
  const validOptions = options.filter((option) => option.id !== node.id && !descendantIds(node).has(option.id));

  return (
    <li className="relative">
      <div className="group flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-gray-800/50">
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          aria-expanded={expanded}
          disabled={!hasChildren}
          onClick={() => setExpanded((prev) => !prev)}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:text-white disabled:invisible"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-800 text-gray-300">
          <Building className="h-3.5 w-3.5" />
        </span>

        <span className="font-medium text-white">{node.name}</span>

        {node.kind && (
          <Badge tone={KIND_TONE[node.kind]} className="capitalize">
            {KIND_LABEL[node.kind]}
          </Badge>
        )}

        {canManage && !node.isPersonal && node.parentOrganizationId !== undefined && (
          <div className="ml-auto flex items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <ArrowRightLeft className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
            <Select
              aria-label={`Move ${node.name} under`}
              disabled={isMoving}
              value={node.parentOrganizationId ?? ""}
              onChange={(event) => onMove(node.id, event.target.value || null)}
              className="w-40 text-xs py-1.5"
            >
              <option value="">Root</option>
              {validOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <ul className="ml-5 border-l border-gray-800 pl-3">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              canManage={canManage}
              options={options}
              onMove={onMove}
              movingId={movingId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function HierarchyPanel({ root, canManage }: { root: OrganizationTreeNode; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OrganizationKind>("organization");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);

  const allNodes = useMemo(() => flatten(root), [root]);

  const addChild = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setSuccess(null);
    setCreating(true);
    try {
      const result = await createChildOrganizationAction(root.id, { name: trimmed, kind });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName("");
      setSuccess("Child organization created.");
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const move = async (id: string, parent: string | null) => {
    setError(null);
    setSuccess(null);
    setMovingId(id);
    try {
      const result = await reparentOrganizationAction(id, parent || null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Organization moved.");
      router.refresh();
    } finally {
      setMovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={<Network className="h-5 w-5 text-indigo-400" />}
        title="Organization Hierarchy"
        description="Structure management does not grant access to child organization data."
      />
      <CardBody className="space-y-6">
        {canManage && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-800 bg-gray-950 p-4">
            <div className="min-w-[12rem] flex-1">
              <Input
                label="Child Name"
                placeholder="e.g. West Coast Agency"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={creating}
              />
            </div>
            <div className="w-40">
              <Select
                label="Kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as OrganizationKind)}
                disabled={creating}
              >
                <option value="organization">Organization</option>
                <option value="department">Department</option>
                <option value="region">Region</option>
              </Select>
            </div>
            <Button onClick={addChild} loading={creating} disabled={!name.trim()} size="md">
              <Plus className="h-4 w-4" />
              Create child
            </Button>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {success}
          </p>
        )}

        {root.children.length === 0 ? (
          <p className="text-sm text-gray-500">
            No child organizations yet. Add one above to model departments, regions, or client groups.
          </p>
        ) : (
          <ul aria-label="Organization Hierarchy" className="space-y-1">
            <TreeNode node={root} canManage={canManage} options={allNodes} onMove={move} movingId={movingId} />
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
