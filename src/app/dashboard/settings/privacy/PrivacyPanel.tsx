"use client";

import { useState } from "react";
import type { RetentionRule } from "@/lib/privacy/retention";

interface Props {
  accountEmail: string;
  retention: readonly RetentionRule[];
}

export function PrivacyPanel({ accountEmail, retention }: Props) {
  const [busy, setBusy] = useState<null | "export" | "delete">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");

  async function handleExport() {
    setBusy("export");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "export" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "comply-quick-data-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Your data export has been downloaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy("delete");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/privacy/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "deletion", confirmationEmail: confirmEmail }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Deletion failed.");
      }
      window.location.href = "/login";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed.");
      setBusy(null);
    }
  }

  const canDelete = confirmEmail.trim().toLowerCase() === accountEmail.toLowerCase();

  return (
    <div className="space-y-8">
      {message && (
        <p className="rounded-md border border-emerald-800/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <section className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-5">
        <h2 className="text-lg font-semibold text-white">Export Your Data</h2>
        <p className="mt-1 text-sm text-gray-400">
          Download a machine-readable copy of the personal data associated with your account (GDPR Art. 15/20, CCPA/CPRA
          access &amp; portability).
        </p>
        <button
          onClick={handleExport}
          disabled={busy !== null}
          className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "export" ? "Preparing…" : "Download My Data"}
        </button>
      </section>

      <section className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-5">
        <h2 className="text-lg font-semibold text-white">Data Retention</h2>
        <p className="mt-1 text-sm text-gray-400">How long each category of data is kept.</p>
        <ul className="mt-4 divide-y divide-gray-800/60 text-sm">
          {retention.map((r) => (
            <li key={r.category} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:justify-between">
              <span className="font-medium text-gray-200">{r.label}</span>
              <span className="text-gray-400 sm:text-right">
                {r.days === null ? "Lifetime of account" : `${Math.round(r.days / 30)} months`} — {r.basis}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-red-900/50 bg-red-950/20 p-5">
        <h2 className="text-lg font-semibold text-red-300">Delete Your Account</h2>
        <p className="mt-1 text-sm text-gray-400">
          Permanently erase your account and all associated data (GDPR Art. 17 / CCPA deletion). This cannot be undone.
          Type your account email <span className="font-mono text-gray-300">{accountEmail}</span> to confirm.
        </p>
        <input
          type="email"
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          placeholder="Type your email to confirm"
          className="mt-4 w-full max-w-sm rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-red-500 focus:outline-none"
        />
        <div className="mt-4">
          <button
            onClick={handleDelete}
            disabled={busy !== null || !canDelete}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "delete" ? "Deleting…" : "Permanently Delete Account"}
          </button>
        </div>
      </section>
    </div>
  );
}
