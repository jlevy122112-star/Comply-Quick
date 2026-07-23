"use client";

import { useCallback, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, CopyButton } from "@/components/ui";
import { Input, Select } from "@/components/ui/Field";
import { listPlatforms, generatePlatformSnippet, type PlatformSnippetInput } from "@/lib/platforms";
import type { TargetRegion, TrackingPixel } from "@/lib/tools/data";
import { PixelPicker, RegionPicker } from "../_components/Selectors";
import { recordToolUsageAction } from "../actions";

const GEN_STEPS = [
  "Resolving governing consent model…",
  "Mapping tracking pixels to categories…",
  "Generating platform-native snippet…",
  "Finalizing integration steps…",
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

export default function PlatformIntegrationsTool() {
  const platforms = useMemo(() => listPlatforms(), []);
  const [platformId, setPlatformId] = useState<string>("generic");
  const [companyName, setCompanyName] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [regions, setRegions] = useState<TargetRegion[]>(["eu_gdpr", "california_ccpa"]);
  const [pixels, setPixels] = useState<TrackingPixel[]>(["meta", "google"]);

  const [result, setResult] = useState<ReturnType<typeof generatePlatformSnippet>>();
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);

  const platform = useMemo(
    () => platforms.find((p) => p.id === platformId) ?? platforms[platforms.length - 1]!,
    [platforms, platformId]
  );

  const toggle = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>) =>
      (value: T, next: boolean) =>
        setter((prev) => (next ? [...prev, value] : prev.filter((v) => v !== value))),
    []
  );

  const canGenerate = regions.length > 0 && platform.products.includes("cookie-banner");

  const generate = useCallback(async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setResult(undefined);
    for (let i = 0; i < GEN_STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 180));
    }
    const input: PlatformSnippetInput = {
      companyName,
      privacyPolicyUrl,
      regions,
      pixels,
      policyUrl: privacyPolicyUrl,
    };
    const snippet = generatePlatformSnippet(platformId, input);
    setResult(snippet ?? undefined);
    setGenerating(false);
    void recordToolUsageAction("platform_integration");
  }, [canGenerate, companyName, privacyPolicyUrl, regions, pixels, platformId]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader
            title="Platform"
            description="Choose the website builder or CMS you want to integrate with."
            icon="🌐"
          />
          <CardBody>
            <Select label="Website Builder" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.category}
                </option>
              ))}
            </Select>
            <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs text-gray-400">
              <span className="font-medium text-gray-300">Install Method:</span> {platform.installLabel}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Configure"
            description="Banner behavior is derived from your jurisdictions and pixels."
            icon="⚙️"
          />
          <CardBody className="space-y-5">
            <Input
              label="Company / Site Name"
              placeholder="Acme Store"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              label="Privacy Policy URL"
              placeholder="/privacy"
              value={privacyPolicyUrl}
              onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
            />
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Target Jurisdictions</p>
              <RegionPicker selected={regions} onToggle={toggle(setRegions)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Tracking Pixels to Gate</p>
              <PixelPicker selected={pixels} onToggle={toggle(setPixels)} />
            </div>
            <Button onClick={generate} loading={generating} disabled={!canGenerate} className="w-full" size="lg">
              {generating ? "Generating…" : `Generate ${platform.name} snippet`}
            </Button>
            {!canGenerate && (
              <p className="text-xs text-amber-400">
                {platform.products.includes("cookie-banner")
                  ? "Select at least one jurisdiction."
                  : `${platform.name} does not support the cookie banner via code injection. Use hosted policy links instead.`}
              </p>
            )}
            {generating && (
              <div className="space-y-2">
                {GEN_STEPS.map((s, i) => (
                  <div key={s} className={`text-xs ${i <= step ? "text-indigo-300" : "text-gray-600"}`}>
                    {i + 1}. {s}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="lg:col-span-3">
        {!result && !generating && (
          <Card>
            <CardBody className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl">🌐</span>
              <p className="mt-4 text-sm text-gray-400">
                Pick a platform and configure your banner, then generate a copy-paste snippet.
              </p>
            </CardBody>
          </Card>
        )}

        {result && (
          <Card>
            <CardHeader
              title={`${result.platform.name} Integration`}
              description="Copy this snippet into the location described below."
              icon="🧩"
            />
            <CardBody className="space-y-4">
              {result.platform.snippetHint && (
                <p className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
                  <span className="font-semibold">Where to Paste:</span> {result.platform.snippetHint}
                </p>
              )}

              <pre className="max-h-96 overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-300">
                <code>{result.snippet}</code>
              </pre>

              <div className="flex flex-wrap gap-2">
                <CopyButton value={result.snippet} label="Copy snippet" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    download(`comply-quick-${result.platform.id}-snippet.html`, result.snippet, "text/html")
                  }
                >
                  Download .html
                </Button>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-gray-300">Integration Steps</p>
                <ol className="list-decimal space-y-1.5 pl-5 text-xs text-gray-400">
                  {result.platform.instructions.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
