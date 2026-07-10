import { Card, CardBody, Badge } from "@/components/ui";
import type { Tier } from "@/lib/pricing";
import type { WorkspaceData } from "@/lib/workspace/data";

/** Coverage tab — compliance module enablement grid, gated by tier. */
export function CoveragePanel({ coverage, tier }: { coverage: WorkspaceData["coverage"]; tier: Tier }) {
  const enabled = coverage.filter((c) => c.enabled).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {enabled} of {coverage.length} compliance modules enabled for this project.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {coverage.map((c) => (
          <Card key={c.module} className={c.enabled ? "" : "opacity-80"}>
            <CardBody className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl" aria-hidden>
                  {c.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{c.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{c.description}</p>
                </div>
              </div>
              {c.enabled ? (
                <Badge tone="emerald">Enabled</Badge>
              ) : tier === "free" ? (
                <Badge tone="gray">Locked</Badge>
              ) : (
                <Badge tone="gray">Off</Badge>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
