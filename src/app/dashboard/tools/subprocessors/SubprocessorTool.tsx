"use client";

import { useMemo, useState, useCallback } from "react";
import { Badge, Button, Card, CardBody, CardHeader, CopyButton } from "@/components/ui";
import { buildSubprocessorMap } from "@/lib/tools/subprocessors";
import type { TrackingPixel } from "@/lib/tools/data";
import { PixelPicker } from "../_components/Selectors";
import { NextStepCard, ValueBanner } from "../_components/ToolExtras";
import { recordToolUsageAction } from "../actions";

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SubprocessorTool() {
  const [pixels, setPixels] = useState<TrackingPixel[]>(["meta", "google", "tiktok"]);

  const toggle = useCallback(
    (value: TrackingPixel, next: boolean) =>
      setPixels((prev) => (next ? [...prev, value] : prev.filter((v) => v !== value))),
    []
  );

  const map = useMemo(() => buildSubprocessorMap(pixels), [pixels]);

  // The register is derived reactively, so "usage" is when the user exports it.
  const markUsed = useCallback(() => void recordToolUsageAction("subprocessors"), []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader title="Select vendors" description="Pick the tracking pixels active on your site." icon="🔗" />
          <CardBody className="space-y-5">
            <PixelPicker selected={pixels} onToggle={toggle} />
            <div className="flex flex-wrap gap-2">
              <CopyButton value={map.csv} label="Copy CSV" onCopy={markUsed} />
              <CopyButton value={map.markdown} label="Copy Markdown" onCopy={markUsed} />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  download("subprocessors.csv", map.csv, "text/csv");
                  markUsed();
                }}
                disabled={map.rows.length === 0}
              >
                Download .csv
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-4">
        {map.rows.length > 0 && <ValueBanner kind="subprocessor_map" />}

        <Card>
          <CardHeader
            title="Subprocessor register"
            description="GDPR Art. 30 record of processing / DPA Annex II."
            icon="🔗"
            actions={<Badge tone="gray">{map.rows.length} subprocessors</Badge>}
          />
          <CardBody>
            {map.rows.length === 0 ? (
              <div className="py-12 text-center">
                <span className="text-4xl">🔗</span>
                <p className="mt-4 text-sm text-gray-400">Select at least one vendor to build the register.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {map.rows.map((r) => (
                  <div key={r.vendor} className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{r.vendor}</p>
                        <p className="text-xs text-gray-500">{r.company}</p>
                      </div>
                      <Badge tone="violet">{r.category}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">{r.purpose}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.dataCategories.map((d) => (
                        <span
                          key={d}
                          className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    <a
                      href={r.optOutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      Opt-out / privacy controls &rarr;
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {map.rows.length > 0 && (
          <NextStepCard
            title="Generate the matching DPA"
            description="Turn this register into a controller–processor Data Processing Agreement with Annex II filled in."
            href="/dashboard/tools/dpa"
            cta="Build DPA"
          />
        )}
      </div>
    </div>
  );
}
