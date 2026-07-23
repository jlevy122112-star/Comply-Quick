import type { PublicScanResult } from "@/app/api/public-scan/route";
import { LeadCaptureForm } from "./LeadCaptureForm";

function scoreTone(score: number): { text: string; ring: string; label: string } {
  if (score >= 80) return { text: "text-emerald-400", ring: "border-emerald-500/40", label: "Low Risk" };
  if (score >= 50) return { text: "text-amber-400", ring: "border-amber-500/40", label: "Needs Attention" };
  return { text: "text-rose-400", ring: "border-rose-500/40", label: "High Risk" };
}

const SEV_DOT: Record<string, string> = {
  critical: "bg-rose-400",
  warning: "bg-amber-400",
  info: "bg-sky-400",
};

export function ScanResultCard({ result }: { result: PublicScanResult }) {
  const tone = scoreTone(result.score);
  const issues = result.counts.critical + result.counts.warning;

  return (
    <div className="w-full max-w-xl mx-auto text-left rounded-2xl border border-gray-800 bg-gray-900/70 p-6 sm:p-8">
      <div className="flex items-center gap-5">
        <div
          className={`shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 ${tone.ring} bg-gray-950`}
        >
          <span className={`text-3xl font-bold ${tone.text}`}>{result.score}</span>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">/ 100</span>
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${tone.text}`}>{tone.label}</p>
          <p className="mt-1 text-sm text-gray-200 break-words">
            We scanned <span className="text-white font-medium">{result.url}</span> and found{" "}
            <span className="text-white font-medium">{issues}</span> issue{issues === 1 ? "" : "s"} across{" "}
            <span className="text-white font-medium">{result.tools.length}</span> detected tool
            {result.tools.length === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      {result.tools.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {result.tools.slice(0, 8).map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-lg bg-gray-800 text-xs text-gray-200">
              {t}
            </span>
          ))}
        </div>
      )}

      {result.findings.length > 0 && (
        <ul className="mt-5 space-y-2">
          {result.findings.slice(0, 4).map((f) => (
            <li key={f.title} className="flex items-start gap-2.5 text-sm text-gray-200">
              <span className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${SEV_DOT[f.severity] ?? "bg-gray-400"}`} />
              {f.title}
            </li>
          ))}
          {result.findings.length > 4 && (
            <li className="text-xs text-gray-400">+ {result.findings.length - 4} more in your full report</li>
          )}
        </ul>
      )}

      <div className="mt-6 border-t border-gray-800 pt-6">
        <p className="text-sm font-semibold text-white">Get your full report + fix-it checklist</p>
        <p className="mt-1 text-xs text-gray-300">
          Every finding, the exact fix, and your auto-generated documents &mdash; emailed instantly. Join the Founding
          100 for a free premium scan.
        </p>
        <div className="mt-4">
          <LeadCaptureForm source="hero_scan" />
        </div>
      </div>
    </div>
  );
}
