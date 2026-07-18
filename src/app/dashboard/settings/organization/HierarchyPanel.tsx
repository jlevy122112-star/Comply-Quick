"use client";

import { useState } from "react";
import type { OrganizationTreeNode, OrganizationKind } from "@/lib/org-hierarchy";
import { createChildOrganizationAction, reparentOrganizationAction } from "./actions";

function descendantIds(node: OrganizationTreeNode): Set<string> {
  const ids = new Set<string>();
  for (const child of node.children) {
    ids.add(child.id);
    for (const id of descendantIds(child)) ids.add(id);
  }
  return ids;
}

function Tree({
  node,
  canManage,
  onMove,
  options,
}: {
  node: OrganizationTreeNode;
  canManage: boolean;
  onMove: (id: string, parent: string | null) => void;
  options: OrganizationTreeNode[];
}) {
  return (
    <li className="border-l border-gray-700 pl-4">
      <div className="flex flex-wrap items-center gap-2 py-2">
        <span className="font-medium text-white">{node.name}</span>
        {node.kind && <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">{node.kind}</span>}
        {canManage && !node.isPersonal && node.parentOrganizationId && (
          <label className="text-xs text-gray-400">
            Move under
            <select
              aria-label={`Move ${node.name}`}
              className="ml-1 rounded border border-gray-700 bg-gray-950 px-1 py-0.5 text-xs text-white"
              value={node.parentOrganizationId}
              onChange={(event) => onMove(node.id, event.target.value || null)}
            >
              <option value="">Root</option>
              {options
                .filter((option) => option.id !== node.id && !descendantIds(node).has(option.id))
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <Tree key={child.id} node={child} canManage={canManage} onMove={onMove} options={options} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function HierarchyPanel({ root, canManage }: { root: OrganizationTreeNode; canManage: boolean }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OrganizationKind>("organization");
  const [message, setMessage] = useState<string | null>(null);
  const options: OrganizationTreeNode[] = [];
  const collect = (node: OrganizationTreeNode) => {
    options.push(node);
    node.children.forEach(collect);
  };
  collect(root);
  const addChild = async () => {
    const result = await createChildOrganizationAction(root.id, { name, kind });
    setMessage(result.ok ? "Child organization created." : result.error);
    if (result.ok) setName("");
  };
  const move = async (id: string, parent: string | null) => {
    const result = await reparentOrganizationAction(id, parent);
    setMessage(result.ok ? "Organization moved." : result.error);
  };
  return (
    <section className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Organization hierarchy</h2>
        <p className="mt-1 text-sm text-gray-400">
          Structure management does not grant access to child organization data.
        </p>
      </div>
      {canManage && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-300">
            Child name
            <input
              className="mt-1 block rounded border border-gray-700 bg-gray-950 px-3 py-2 text-white"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="text-sm text-gray-300">
            Kind
            <select
              className="mt-1 block rounded border border-gray-700 bg-gray-950 px-3 py-2 text-white"
              value={kind}
              onChange={(event) => setKind(event.target.value as OrganizationKind)}
            >
              <option value="organization">Organization</option>
              <option value="department">Department</option>
              <option value="region">Region</option>
            </select>
          </label>
          <button
            type="button"
            onClick={addChild}
            disabled={!name.trim()}
            className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Create child
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-gray-300">
          {message}
        </p>
      )}
      <ul aria-label="Organization hierarchy">
        <Tree node={root} canManage={canManage} onMove={move} options={options} />
      </ul>
    </section>
  );
}
