"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { can, type Role } from "@/lib/rbac";
import type { FeatureFlagStatus } from "@/lib/feature-flags";
import { setFeatureFlagAction } from "./actions";

export function FeatureFlagsPanel({
  orgId,
  role,
  flags,
}: {
  orgId: string;
  role: Role;
  flags: FeatureFlagStatus[];
}) {
  const router = useRouter();
  const canManage = can(role, "org:update");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(flag: FeatureFlagStatus) {
    setBusy(flag.flag);
    setError(null);
    try {
      const res = await setFeatureFlagAction(orgId, flag.flag, !flag.enabled);
      if (!res.ok) setError(res.error);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Feature flags"
        description={'Tenant-scoped overrides for plan-gated features. Values marked "plan" follow the subscription tier; "override" means an admin has set a custom value.'}
      />
      <CardBody>
        <div className="space-y-3">
          {flags.map((flag) => (
            <div
              key={flag.flag}
              className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-gray-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{flag.name}</p>
                <p className="text-xs text-gray-400">{flag.description}</p>
                <p className="mt-1 text-xs text-gray-500">Source: {flag.source}</p>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  size="sm"
                  variant={flag.enabled ? "secondary" : "primary"}
                  loading={busy === flag.flag}
                  disabled={busy === flag.flag}
                  onClick={() => toggle(flag)}
                >
                  {flag.enabled ? "Disable" : "Enable"}
                </Button>
              ) : (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    flag.enabled ? "bg-green-900/40 text-green-300" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {flag.enabled ? "On" : "Off"}
                </span>
              )}
            </div>
          ))}
        </div>
        {error && <p className="mt-4 text-xs text-rose-400">{error}</p>}
      </CardBody>
    </Card>
  );
}
