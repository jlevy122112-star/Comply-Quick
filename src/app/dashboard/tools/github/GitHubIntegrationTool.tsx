"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { Input } from "@/components/ui/Field";

type Finding = {
  id?: string;
  finding_type: string;
  severity: string;
  message: string;
  path: string | null;
  line_number: number | null;
};

export default function GitHubIntegrationTool() {
  const [connected, setConnected] = useState(false);
  const [repos, setRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/github/repos");
      const json = (await res.json()) as { connected?: boolean; repos?: string[]; error?: string };
      if (json.error) {
        setError(json.error);
      } else {
        setConnected(!!json.connected);
        setRepos(json.repos ?? []);
      }
    } catch {
      setError("Could not load GitHub repos.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRepos();
  }, [fetchRepos]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepo.trim()) return;
    setScanning(true);
    setError(null);
    setFindings([]);
    try {
      const res = await fetch("/api/github/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: selectedRepo.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; findings?: Finding[]; error?: string };
      if (!json.ok || json.error) {
        setError(json.error ?? "Scan failed.");
      } else {
        setFindings(json.findings ?? []);
      }
    } catch {
      setError("Scan request failed.");
    }
    setScanning(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="GitHub Connection"
          description="Connect your GitHub account to scan repositories for compliance signals."
        />
        <CardBody>
          {loading ? (
            <Skeleton className="h-12" />
          ) : connected ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-400">GitHub connected. Found {repos.length} repositories.</p>
              <Button variant="secondary" onClick={fetchRepos} disabled={loading}>
                Refresh
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">No GitHub account connected.</p>
              <Button
                onClick={() => {
                  window.location.href = "/api/github/auth";
                }}
              >
                Connect GitHub
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {connected && (
        <Card>
          <CardHeader title="Scan Repository" description="Enter an owner/repo name to scan for compliance findings." />
          <CardBody>
            <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <Input
                  label="Repository"
                  placeholder="owner/repo"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                  list="repo-suggestions"
                />
                <datalist id="repo-suggestions">
                  {repos.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
              <Button type="submit" disabled={scanning || !selectedRepo.trim()}>
                {scanning ? "Scanning..." : "Scan repo"}
              </Button>
            </form>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

            {findings.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm text-left">
                  <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                      <th className="pb-2">Severity</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Message</th>
                      <th className="pb-2">Path</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-200">
                    {findings.map((f, idx) => (
                      <tr key={idx} className="border-b border-gray-800 last:border-0">
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                              f.severity === "high"
                                ? "bg-red-900/40 text-red-300"
                                : f.severity === "medium"
                                  ? "bg-yellow-900/40 text-yellow-300"
                                  : "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {f.severity}
                          </span>
                        </td>
                        <td className="py-3">{f.finding_type}</td>
                        <td className="py-3">{f.message}</td>
                        <td className="py-3 text-gray-500">{f.path ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!scanning && findings.length === 0 && selectedRepo && !error && (
              <p className="mt-4 text-sm text-green-400">No findings — this repo looks clean.</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
