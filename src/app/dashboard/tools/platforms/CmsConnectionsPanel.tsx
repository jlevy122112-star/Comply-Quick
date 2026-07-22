"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Skeleton } from "@/components/ui";
import { Input, Select } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";
import type { CmsPlatform } from "@/lib/connector/cms";

type Connection = {
  id: string;
  platform: CmsPlatform;
  externalAccountId: string;
  status: string;
  mode: string;
  createdAt: string;
};

interface CmsConnectionsPanelProps {
  organizationId: string;
}

export default function CmsConnectionsPanel({ organizationId }: CmsConnectionsPanelProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [platform, setPlatform] = useState<CmsPlatform>("wordpress");
  const [externalAccountId, setExternalAccountId] = useState("");

  const supabase = createClient();

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema("connector")
      .from("connector_connections")
      .select("id, platform, external_account_id, status, mode, created_at")
      .eq("agency_org_id", organizationId)
      .in("platform", ["webflow", "wordpress"])
      .order("created_at", { ascending: false });
    if (!error && data) {
      setConnections(
        (data as Array<{
          id: string;
          platform: CmsPlatform;
          external_account_id: string;
          status: string;
          mode: string;
          created_at: string;
        }>).map((row) => ({
          id: row.id,
          platform: row.platform,
          externalAccountId: row.external_account_id,
          status: row.status,
          mode: row.mode,
          createdAt: row.created_at,
        }))
      );
    }
    setLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConnections();
  }, [fetchConnections]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!externalAccountId.trim()) return;
    setSubmitting(true);
    await supabase.schema("connector").from("connector_connections").insert({
      agency_org_id: organizationId,
      platform,
      external_account_id: externalAccountId.trim(),
    });
    setExternalAccountId("");
    setSubmitting(false);
    await fetchConnections();
  }

  return (
    <Card className="mt-8">
      <CardHeader
        title="CMS plugin connections"
        description="Track Webflow app and WordPress plugin installations."
      />
      <CardBody>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-4 items-end mb-6">
          <div className="flex-1 w-full">
            <Select label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as CmsPlatform)}>
              <option value="wordpress">WordPress</option>
              <option value="webflow">Webflow</option>
            </Select>
          </div>
          <div className="flex-[2] w-full">
            <Input
              label="Site / account identifier"
              placeholder="example.com or Webflow site id"
              value={externalAccountId}
              onChange={(e) => setExternalAccountId(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting || !externalAccountId.trim()}>
            {submitting ? "Adding..." : "Add connection"}
          </Button>
        </form>

        {loading ? (
          <Skeleton className="h-24" />
        ) : connections.length === 0 ? (
          <p className="text-sm text-gray-500">No CMS connections yet. Install the plugin for your site or add a manual connection above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="text-gray-400 border-b border-gray-700">
                <tr>
                  <th className="pb-2">Platform</th>
                  <th className="pb-2">Identifier</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Mode</th>
                  <th className="pb-2">Connected</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {connections.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0">
                    <td className="py-3 capitalize">{c.platform}</td>
                    <td className="py-3">{c.externalAccountId}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          c.status === "active"
                            ? "bg-green-900/40 text-green-300"
                            : c.status === "pending"
                              ? "bg-yellow-900/40 text-yellow-300"
                              : "bg-gray-800 text-gray-300"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3">{c.mode}</td>
                    <td className="py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
