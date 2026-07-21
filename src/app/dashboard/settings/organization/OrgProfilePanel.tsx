"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Input, Select } from "@/components/ui";
import type { Organization } from "@/lib/organizations";
import { updateOrgAction } from "./actions";

const PLANS: Organization["plan"][] = ["free", "team", "enterprise"];

export function OrgProfilePanel({ org, canManage }: { org: Organization; canManage: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [plan, setPlan] = useState<Organization["plan"]>(org.plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await updateOrgAction(org.id, { name, plan });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <h2 className="text-sm font-semibold text-white">Organization profile</h2>
        <p className="mt-1 text-sm text-gray-400">
          The organization is the top of your tenant hierarchy — workspaces and projects live inside it.
        </p>
        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={!canManage} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">Plan</span>
            <Select
              value={plan}
              onChange={(e) => setPlan(e.target.value as Organization["plan"])}
              disabled={!canManage}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={!canManage || busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            {saved && <span className="text-xs text-emerald-400">Saved</span>}
            {error && <span className="text-xs text-rose-400">{error}</span>}
          </div>
          {!canManage && (
            <p className="text-xs text-gray-500">Only owners and admins can edit the organization profile.</p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
