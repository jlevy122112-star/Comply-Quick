"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import type { TenantEncryptionStatus } from "@/lib/security/tenant-keys";

interface Props {
  isEnterprise: boolean;
  initialStatus: TenantEncryptionStatus | null;
}

function formatRotation(value: string | null): string {
  if (!value) return "Not initialized";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

export function DataEncryptionPanel({ isEnterprise, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function rotateKey() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/security/encryption", { method: "POST" });
      const body = (await response.json()) as { status?: TenantEncryptionStatus; error?: string };
      if (!response.ok || !body.status) throw new Error(body.error ?? "Could not rotate the encryption key.");
      setStatus(body.status);
      setMessage("Encryption key wrapped successfully.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rotate the encryption key.");
    } finally {
      setBusy(false);
    }
  }

  if (!isEnterprise) {
    return (
      <Card className="overflow-hidden border-indigo-500/25 bg-gradient-to-br from-indigo-950/40 via-gray-900 to-gray-900">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              Data Encryption <Badge tone="violet">Enterprise</Badge>
            </span>
          }
          description="Protect sensitive tenant fields with per-organization envelope encryption."
          icon="◆"
        />
        <CardBody>
          <p className="max-w-2xl text-sm leading-6 text-gray-300">
            Enterprise encryption keeps each organization&apos;s data-encryption key separate while your data remains
            protected by pooled-database RLS.
          </p>
          <Link
            href="/#pricing"
            className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 focus-visible:outline-offset-2"
          >
            Explore Enterprise
          </Link>
        </CardBody>
      </Card>
    );
  }

  const providerLabel = status?.provider === "kms" ? "AWS KMS (planned)" : "Environment KEK";
  const statusTone = status?.enabled ? "emerald" : status?.providerConfigured ? "amber" : "rose";

  return (
    <Card className="overflow-hidden border-indigo-500/25 bg-gradient-to-br from-indigo-950/30 via-gray-900 to-gray-900">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Data Encryption <Badge tone={statusTone}>{status?.enabled ? "Enabled" : "Configuration needed"}</Badge>
          </span>
        }
        description="Enterprise field-level protection with a tenant-specific wrapped data-encryption key."
        icon="◆"
        actions={
          <Button type="button" size="sm" onClick={rotateKey} loading={busy} disabled={!status?.providerConfigured}>
            {status?.enabled ? "Rotate key" : "Initialize key"}
          </Button>
        }
      />
      <CardBody>
        {!status?.providerConfigured && (
          <div
            className="mb-5 rounded-lg border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200"
            role="alert"
          >
            Configure the tenant encryption KEK before initializing encryption. Key material is never stored in
            Supabase.
          </div>
        )}
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Provider</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-100">{providerLabel}</dd>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">KEK version</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-100">{status?.keyVersion ?? "Not initialized"}</dd>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/50 p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Last rotation</dt>
            <dd className="mt-1 text-sm font-semibold text-gray-100">{formatRotation(status?.lastRotation ?? null)}</dd>
          </div>
        </dl>
        <p className="mt-5 text-xs leading-5 text-gray-500">
          v1 rotations re-wrap the same DEK, so existing encrypted fields remain readable without a data migration. Full
          DEK rotation and row re-encryption will run as a later background job.
        </p>
        {message && (
          <p className="mt-4 text-sm text-emerald-300" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
