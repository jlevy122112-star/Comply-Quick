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

interface ManagedDeployment {
  id: string;
  publicId: string;
  siteOrigin: string;
  policyVersion: string;
  status: "ready" | "verified" | "paused";
  lastVerifiedAt: string | null;
  verificationDetail: string | null;
}

function download(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CookieBannerTool({
  projects,
  consentEndpoint,
}: {
  projects: { id: string; name: string }[];
  consentEndpoint: string;
}) {
  const [companyName, setCompanyName] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [regions, setRegions] = useState<TargetRegion[]>(["eu_gdpr", "california_ccpa"]);
  const [pixels, setPixels] = useState<TrackingPixel[]>(["meta", "google"]);
  const [result, setResult] = useState<CookieConsentResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [auditProjectId, setAuditProjectId] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [policyVersion, setPolicyVersion] = useState(() => new Date().toISOString().slice(0, 10));
  const [deployment, setDeployment] = useState<ManagedDeployment | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

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
    setDeploymentError(null);
    for (let i = 0; i < GEN_STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 180));
    }
    let managedDeployment: ManagedDeployment | null = null;
    // A project + website URL creates an accountable managed deployment. Keeping
    // the project selector optional preserves standalone/self-hosted banners.
    if (auditProjectId && siteUrl.trim()) {
      try {
        const response = await fetch("/api/consent/deployments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: auditProjectId,
            siteUrl,
            privacyPolicyUrl,
            policyVersion,
            regions,
            pixels,
            enforcementMode: "automatic",
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.deployment) {
          setDeploymentError(data?.message ?? "Could not save the managed deployment.");
          setGenerating(false);
          return;
        }
        managedDeployment = data.deployment as ManagedDeployment;
        setDeployment(managedDeployment);
      } catch {
        setDeploymentError("Could not save the managed deployment. Check your connection and try again.");
        setGenerating(false);
        return;
      }
    } else {
      setDeployment(null);
    }
    const output = generateConsentBanner({
      companyName,
      privacyPolicyUrl,
      regions,
      pixels,
      ...(auditProjectId
        ? {
            recordEndpoint: consentEndpoint,
            projectId: auditProjectId,
            policyVersion,
            ...(managedDeployment ? { deploymentId: managedDeployment.publicId } : {}),
          }
        : {}),
    });
    setResult(output);
    setGenerating(false);
    setTab("preview");
    void recordToolUsageAction("cookie_banner");
  }, [
    auditProjectId,
    canGenerate,
    companyName,
    consentEndpoint,
    pixels,
    policyVersion,
    privacyPolicyUrl,
    regions,
    siteUrl,
  ]);

  const verifyDeployment = useCallback(async () => {
    if (!deployment) return;
    setVerifying(true);
    setDeploymentError(null);
    try {
      const response = await fetch(`/api/consent/deployments/${deployment.id}/verify`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.deployment) {
        setDeploymentError(data?.message ?? "Could not verify the live installation.");
        return;
      }
      setDeployment(data.deployment as ManagedDeployment);
    } catch {
      setDeploymentError("Could not verify the live installation. Try again.");
    } finally {
      setVerifying(false);
    }
  }, [deployment]);

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
              label="Company / site name"
              placeholder="Acme Store"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              label="Privacy policy URL"
              placeholder="/privacy"
              value={privacyPolicyUrl}
              onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
            />
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Target jurisdictions</p>
              <RegionPicker selected={regions} onToggle={toggle(setRegions)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-gray-300">Tracking pixels to gate</p>
              <PixelPicker selected={pixels} onToggle={toggle(setPixels)} />
            </div>
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
              <label htmlFor="consent-audit-project" className="text-sm font-semibold text-white">
                Consent evidence
              </label>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Attach this banner to a project to record visitor choices in its audit trail.
              </p>
              <select
                id="consent-audit-project"
                value={auditProjectId}
                onChange={(event) => setAuditProjectId(event.target.value)}
                className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">No audit recording</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {auditProjectId && (
                <div className="mt-3 space-y-3 border-t border-indigo-500/15 pt-3">
                  <Input
                    label="Live website URL (creates a managed deployment)"
                    placeholder="https://www.acme.com"
                    value={siteUrl}
                    onChange={(event) => setSiteUrl(event.target.value)}
                  />
                  <Input
                    label="Policy version"
                    placeholder="2026-07-13"
                    value={policyVersion}
                    onChange={(event) => setPolicyVersion(event.target.value)}
                  />
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    Add a public website URL to persist a deployable configuration and verify its installation. Without
                    one, choices are still recorded to this project, but the banner is self-managed.
                  </p>
                </div>
              )}
            </div>
            <Button onClick={generate} loading={generating} disabled={!canGenerate} className="w-full" size="lg">
              {generating ? "Generating…" : "Generate banner"}
            </Button>
            {!canGenerate && <p className="text-xs text-amber-400">Select at least one jurisdiction.</p>}
            {deploymentError && <p className="text-xs text-red-400">{deploymentError}</p>}
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
                title="Your consent banner"
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
                  {result.requiresDoNotSell && <Badge tone="amber">Do Not Sell control</Badge>}
                  {auditProjectId && <Badge tone="emerald">Audit evidence enabled</Badge>}
                  {deployment && (
                    <Badge tone={deployment.status === "verified" ? "emerald" : "violet"}>
                      {deployment.status === "verified" ? "Live install verified" : "Managed deployment ready"}
                    </Badge>
                  )}
                </div>

                {deployment && (
                  <div
                    className={`rounded-xl border p-4 ${deployment.status === "verified" ? "border-emerald-500/30 bg-emerald-500/5" : "border-indigo-500/25 bg-indigo-500/5"}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {deployment.status === "verified"
                            ? "Live deployment verified"
                            : "Ready for production deployment"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-400">
                          {deployment.verificationDetail ??
                            `Publish this snippet on ${deployment.siteOrigin}, then verify that its marker is present.`}
                        </p>
                      </div>
                      <Button variant="secondary" size="sm" loading={verifying} onClick={verifyDeployment}>
                        {deployment.status === "verified" ? "Verify again" : "Verify installation"}
                      </Button>
                    </div>
                    <p className="mt-3 text-[11px] text-gray-500">
                      Automatic enforcement is enabled: tags marked with <code>data-cq-category</code> remain inert
                      until the saved preference permits them.
                    </p>
                  </div>
                )}

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
                    title="Consent banner preview"
                    srcDoc={previewSrcDoc}
                    className="h-64 w-full rounded-lg border border-gray-800 bg-gray-900"
                  />
                ) : (
                  <div className="space-y-3">
                    <pre className="max-h-72 overflow-auto rounded-lg border border-gray-800 bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-300">
                      <code>{result.snippet}</code>
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <CopyButton value={result.snippet} label="Copy snippet" />
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
                  <p className="mb-2 text-xs font-semibold text-gray-300">Integration steps</p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-xs text-gray-400">
                    {result.instructions.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ol>
                </div>
              </CardBody>
            </Card>

            <NextStepCard
              title="Document these vendors"
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
