"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, CopyButton, Input } from "@/components/ui";
import { generateCookiePolicy, type CookiePolicyResult } from "@/lib/tools/cookiePolicy";
import type { TargetRegion, TrackingPixel } from "@/lib/tools/data";
import { PixelPicker, RegionPicker } from "../_components/Selectors";
import { GenerateProgress, NextStepCard, ValueBanner } from "../_components/ToolExtras";
import { recordToolUsageAction } from "../actions";

const GEN_STEPS = [
  "Resolving governing consent model…",
  "Classifying cookies into consent categories…",
  "Building the per-vendor disclosure table…",
  "Assembling the policy document…",
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

const PREVIEW_STYLE =
  "body{margin:0;padding:24px;background:#0b0f19;color:#e5e7eb;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;line-height:1.6}" +
  "h1{font-size:20px;color:#fff;margin:0 0 4px}h2{font-size:15px;color:#fff;margin:22px 0 6px}" +
  ".cq-meta{color:#9ca3af;font-size:12px}a{color:#a5b4fc}" +
  "table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}" +
  "th,td{border:1px solid #1f2937;padding:6px 8px;text-align:left;vertical-align:top}th{background:#111827;color:#cbd5e1}" +
  "hr{border:0;border-top:1px solid #1f2937;margin:20px 0}.cq-disclaimer{color:#9ca3af;font-size:11px}";

export default function CookiePolicyTool() {
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [regions, setRegions] = useState<TargetRegion[]>(["eu_gdpr", "california_ccpa"]);
  const [pixels, setPixels] = useState<TrackingPixel[]>(["meta", "google"]);
  const [result, setResult] = useState<CookiePolicyResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"preview" | "markdown" | "html">("preview");

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
    const output = generateCookiePolicy({ companyName, websiteUrl, privacyPolicyUrl, contactEmail, regions, pixels });
    setResult(output);
    setGenerating(false);
    setTab("preview");
    void recordToolUsageAction("cookie_policy");
  }, [canGenerate, companyName, websiteUrl, privacyPolicyUrl, contactEmail, regions, pixels]);

  const previewSrcDoc = useMemo(() => {
    if (!result) return "";
    return `<!doctype html><html><head><meta charset="utf-8"><style>${PREVIEW_STYLE}</style></head><body>${result.html}</body></html>`;
  }, [result]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Configuration */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader
            title="Configure"
            description="Disclosures are derived from your jurisdictions and the technologies you run."
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
              label="Website URL (Optional)"
              placeholder="https://acme.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <Input
              label="Privacy Policy URL"
              placeholder="/privacy"
              value={privacyPolicyUrl}
              onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
            />
            <Input
              label="Contact Email (Optional)"
              placeholder="privacy@acme.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Target Jurisdictions</p>
              <RegionPicker selected={regions} onToggle={toggle(setRegions)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Tracking Technologies in Use</p>
              <PixelPicker selected={pixels} onToggle={toggle(setPixels)} />
            </div>
            <Button onClick={generate} loading={generating} disabled={!canGenerate} className="w-full" size="lg">
              {generating ? "Generating…" : "Generate cookie policy"}
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
              <span className="text-4xl">📃</span>
              <p className="mt-4 text-sm text-gray-400">
                Configure your jurisdictions and technologies, then generate a regulator-ready cookie policy.
              </p>
            </CardBody>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            <ValueBanner kind="cookie_policy" />

            <Card>
              <CardHeader
                title="Your Cookie Policy"
                description={`Version ${result.policyVersion} · effective ${result.effectiveDate}.`}
                icon="📃"
                actions={<Badge tone={CONSENT_TONE[result.consentModel]}>{result.consentModel} model</Badge>}
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="gray">{result.vendors.length} technologies disclosed</Badge>
                  <Badge tone="violet">{result.categories.length} categories</Badge>
                  {result.requiresDoNotSell && <Badge tone="amber">Do Not Sell Clause</Badge>}
                </div>

                <div className="flex gap-2 border-b border-gray-800">
                  {(["preview", "markdown", "html"] as const).map((t) => (
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
                      {t === "preview" ? "Live preview" : t === "markdown" ? "Markdown" : "HTML"}
                    </button>
                  ))}
                </div>

                {tab === "preview" ? (
                  <iframe
                    title="Cookie Policy Preview"
                    srcDoc={previewSrcDoc}
                    className="h-[28rem] w-full rounded-lg border border-gray-800 bg-gray-900"
                  />
                ) : (
                  <div className="space-y-3">
                    <pre className="max-h-[28rem] overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-300">
                      <code>{tab === "markdown" ? result.markdown : result.html}</code>
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton
                        value={tab === "markdown" ? result.markdown : result.html}
                        label={`Copy ${tab === "markdown" ? "Markdown" : "HTML"}`}
                      />
                      {tab === "markdown" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => download("cookie-policy.md", result.markdown, "text/markdown")}
                        >
                          Download .md
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => download("cookie-policy.html", result.html, "text/html")}
                        >
                          Download .html
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>

            <NextStepCard
              title="Collect Consent for These Cookies"
              description="Generate a matching consent banner that gates these exact technologies until the visitor agrees."
              href="/dashboard/tools/cookie-banner"
              cta="Generate banner"
            />
          </div>
        )}
      </div>
    </div>
  );
}
