"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, CopyButton, Input } from "@/components/ui";
import { generateConsentBanner, type CookieConsentResult } from "@/lib/tools/cookieConsent";
import type { TargetRegion, TrackingPixel } from "@/lib/tools/data";
import { PixelPicker, RegionPicker } from "../_components/Selectors";
import { GenerateProgress, NextStepCard, ValueBanner } from "../_components/ToolExtras";
import { recordToolUsageAction } from "../actions";

const GEN_STEPS = [
  "Resolving governing consent model…",
  "Mapping tracking pixels to consent categories…",
  "Assembling banner markup, styles & script…",
  "Finalizing integration guidance…",
];

const CONSENT_TONE = { "opt-in": "rose", "opt-out": "amber", notice: "sky" } as const;

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CookieBannerTool() {
  const [companyName, setCompanyName] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [regions, setRegions] = useState<TargetRegion[]>(["eu_gdpr", "california_ccpa"]);
  const [pixels, setPixels] = useState<TrackingPixel[]>(["meta", "google"]);
  const [result, setResult] = useState<CookieConsentResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"preview" | "code">("preview");

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
    const output = generateConsentBanner({ companyName, privacyPolicyUrl, regions, pixels });
    setResult(output);
    setGenerating(false);
    setTab("preview");
    void recordToolUsageAction("cookie_banner");
  }, [canGenerate, companyName, privacyPolicyUrl, regions, pixels]);

  const previewSrcDoc = useMemo(() => {
    if (!result) return "";
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#111827;height:100vh}</style></head><body><style>${result.css}</style>${result.html.replace(" hidden>", ">")}${result.js}</body></html>`;
  }, [result]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Configuration */}
      <div className="lg:col-span-2">
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
              {generating ? "Generating…" : "Generate banner"}
            </Button>
            {!canGenerate && <p className="text-xs text-amber-400">Select at least one jurisdiction.</p>}
            {generating && <GenerateProgress steps={GEN_STEPS} activeStep={step} />}
          </CardBody>
        </Card>
      </div>

      {/* Output */}
      <div className="lg:col-span-3">
        {!result && !generating && (
          <Card>
            <CardBody className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-4xl">🍪</span>
              <p className="mt-4 text-sm text-gray-400">
                Configure your jurisdictions and pixels, then generate a ready-to-embed consent banner.
              </p>
            </CardBody>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <ValueBanner kind="cookie_banner" />

            <Card>
              <CardHeader
                title="Your Consent Banner"
                description="Framework-agnostic — works on any site."
                icon="🍪"
                actions={<Badge tone={CONSENT_TONE[result.consentModel]}>{result.consentModel} model</Badge>}
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="gray">{result.vendors.length} vendors gated</Badge>
                  {result.categories.map((c) => (
                    <Badge key={c} tone="violet">
                      {c}
                    </Badge>
                  ))}
                  {result.requiresDoNotSell && <Badge tone="amber">Do Not Sell Control</Badge>}
                </div>

                <div className="flex gap-2 border-b border-gray-800">
                  {(["preview", "code"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                        tab === t
                          ? "border-indigo-500 text-white"
                          : "border-transparent text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {t === "preview" ? "Live preview" : "Embed code"}
                    </button>
                  ))}
                </div>

                {tab === "preview" ? (
                  <iframe
                    title="Consent Banner Preview"
                    srcDoc={previewSrcDoc}
                    className="h-64 w-full rounded-lg border border-gray-800 bg-gray-900"
                  />
                ) : (
                  <div className="space-y-3">
                    <pre className="max-h-72 overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-300">
                      <code>{result.snippet}</code>
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton value={result.snippet} label="Copy Snippet" />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => download("cookie-consent-banner.html", result.snippet, "text/html")}
                      >
                        Download .html
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-300">Integration Steps</p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs text-gray-400">
                    {result.instructions.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ol>
                </div>
              </CardBody>
            </Card>

            <NextStepCard
              title="Document These Vendors"
              description="Map where this data flows and generate a subprocessor register for your DPA."
              href="/dashboard/tools/subprocessors"
              cta="Map subprocessors"
            />
          </div>
        )}
      </div>
    </div>
  );
}
