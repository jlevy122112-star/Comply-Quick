// components/ComplianceFileUpload.tsx
"use client";

import React, { useState } from "react";

type Props = {
  workspaceId: string;
};

export function ComplianceFileUpload({ workspaceId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/uploads", {
      method: "POST",
      headers: {
        "x-workspace-id": workspaceId,
      },
      body: formData,
    });

    const json = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(json.error || "Upload failed");
      return;
    }

    setSuccess("File uploaded successfully");
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">
        Attach compliance document (PDF, DOCX, TXT)
      </label>
      <input
        type="file"
        onChange={handleChange}
        disabled={uploading}
        className="block w-full text-sm"
      />
      {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}
    </div>
  );
}
