"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, EmptyState } from "@/components/ui";
import type { ProjectDomain } from "@/lib/project-domains-db";
import { addProjectDomainAction, removeProjectDomainAction } from "./domain-actions";

export function DomainsPanel({ projectId, domains }: { projectId: string; domains: ProjectDomain[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState("");

  const disabled = busyId !== null || isPending;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new");
    try {
      const res = await addProjectDomainAction(projectId, value);
      if (res.ok) {
        setValue("");
        refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await removeProjectDomainAction(projectId, id);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-semibold text-white">Domains</h3>
        <p className="mt-1 text-sm text-gray-400">The domains this project owns and scopes scanning to.</p>

        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="example.com"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={disabled}>
            {busyId === "new" ? "Adding…" : "Add"}
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

        <div className="mt-4">
          {domains.length === 0 ? (
            <EmptyState icon="🌐" title="No domains yet" description="Add a domain to define this project's scope." />
          ) : (
            <ul className="space-y-2">
              {domains.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{d.domain}</span>
                    {d.verified && <Badge tone="emerald">verified</Badge>}
                  </span>
                  <Button size="sm" variant="ghost" disabled={disabled} onClick={() => remove(d.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
