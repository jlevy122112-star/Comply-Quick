"use client";

import { useCallback, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, CheckboxRow, CopyButton, Input } from "@/components/ui";
import { MODULE_OPTIONS, type ComplianceModule } from "@/components/EnterpriseModules";
import { generateDpa, type DpaResult } from "@/lib/tools/dpa";
import type { TargetRegion, TrackingPixel } from "@/lib/tools/data";
import { PixelPicker, RegionPicker } from "../_components/Selectors";
import { GenerateProgress, NextStepCard, ValueBanner } from "../_components/ToolExtras";
import { recordToolUsageAction } from "../actions";

const GEN_STEPS = [
  "Resolving governing jurisdictions…",
  "Deriving subprocessor annex from vendors…",
  "Composing security & module clauses…",
  "Assembling the agreement…",
];

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DpaTool() {
  const [controllerName, setControllerName] = useState("");
  const [processorName, setProcessorName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [regions, setRegions] = useState<TargetRegion[]>(["eu_gdpr"]);
  const [pixels, setPixels] = useState<TrackingPixel[]>(["meta", "google"]);
  const [modules, setModules] = useState<ComplianceModule[]>([]);
  const [result, setResult] = useState<DpaResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);

  const toggle = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
      (value: T, next: boolean) =>
        setter((prev) => (next ? [...prev, value] : prev.filter((v) => v !== value))),
    []
  );

  const canGenerate = regions.length > 0;

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setResult(null);
    for (let i = 0; i < GEN_STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 180));
    }
    setResult(generateDpa({ controllerName, processorName, regions, pixels, modules, effectiveDate }));
    setGenerating(false);
    void recordToolUsageAction("dpa");
  }, [canGenerate, controllerName, processorName, regions, pixels, modules, effectiveDate]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader
            title="Agreement details"
            description="Clauses adapt to jurisdictions, vendors & modules."
            icon="⚙️"
          />
          <CardBody className="space-y-5">
            <Input
              label="Controller (your client)"
              placeholder="Acme Store LLC"
              value={controllerName}
              onChange={(e) => setControllerName(e.target.value)}
            />
            <Input
              label="Processor (you / vendor)"
              placeholder="Your Agency Ltd"
              value={processorName}
              onChange={(e) => setProcessorName(e.target.value)}
            />
            <Input
              label="Effective date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Governing jurisdictions</p>
              <RegionPicker selected={regions} onToggle={toggle(setRegions)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Subprocessors (from pixels)</p>
              <PixelPicker selected={pixels} onToggle={toggle(setPixels)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Additional security modules</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {MODULE_OPTIONS.map((m) => (
                  <CheckboxRow
                    key={m.value}
                    checked={modules.includes(m.value)}
                    onChange={(next) => toggle(setModules)(m.value, next)}
                    label={`${m.icon} ${m.label}`}
                    description={m.description}
                  />
                ))}
              </div>
            </div>
            <Button onClick={generate} loading={generating} disabled={!canGenerate} className="w-full" size="lg">
              {generating ? "Generating…" : "Generate DPA"}
            </Button>
            {!canGenerate && <p className="text-xs text-amber-400">Select at least one jurisdiction.</p>}
            {generating && <GenerateProgress steps={GEN_STEPS} activeStep={step} />}
          </CardBody>
        </Card>
      </div>

      <div className="lg:col-span-3">
        {!result && !generating && (
          <Card>
            <CardBody className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl">📄</span>
              <p className="mt-4 text-sm text-gray-400">
                Fill in the parties and configuration, then generate a controller–processor DPA with a subprocessor
                annex.
              </p>
            </CardBody>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <ValueBanner kind="dpa" />
            <Card>
              <CardHeader
                title="Data Processing Agreement"
                description={`${result.sections.length} sections · ${result.subprocessorCount} subprocessors`}
                icon="📄"
                actions={<Badge tone="emerald">Ready</Badge>}
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <CopyButton value={result.markdown} label="Copy Markdown" />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => download("data-processing-agreement.md", result.markdown, "text/markdown")}
                  >
                    Download .md
                  </Button>
                </div>
                <pre className="max-h-[28rem] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-4 text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap">
                  {result.markdown}
                </pre>
              </CardBody>
            </Card>
            <NextStepCard
              title="Add a consent banner"
              description="Pair this DPA with a jurisdiction-aware cookie consent banner for the same vendors."
              href="/dashboard/tools/cookie-banner"
              cta="Generate banner"
            />
          </div>
        )}
      </div>
    </div>
  );
}
