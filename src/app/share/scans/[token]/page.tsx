import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScanBySharedToken } from "@/lib/scanner/service";

export const dynamic = "force-dynamic";

interface ShareScanPageProps {
  params: Promise<{ token: string }>;
}

interface ScanBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
  clientName: string | null;
}

function safeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function scoreColorClass(score: number): string {
  return score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
}

async function resolveScanBranding(scan: {
  organizationId: string | null;
  clientId: string | null;
}): Promise<ScanBranding> {
  const admin = createAdminClient();
  const fallback: ScanBranding = {
    name: "Comply-Quick",
    logoUrl: null,
    primaryColor: "#4f46e5",
    supportEmail: null,
    clientName: null,
  };

  let branding: ScanBranding = { ...fallback };

  if (scan.organizationId) {
    const { data: org } = await admin
      .from("organizations")
      .select("name, logo_url, primary_color, support_email")
      .eq("id", scan.organizationId)
      .single();
    const orgRow = org as {
      name?: string;
      logo_url?: string | null;
      primary_color?: string;
      support_email?: string | null;
    } | null;
    if (orgRow) {
      branding = {
        name: orgRow.name ?? fallback.name,
        logoUrl: orgRow.logo_url ?? fallback.logoUrl,
        primaryColor: orgRow.primary_color ?? fallback.primaryColor,
        supportEmail: orgRow.support_email ?? fallback.supportEmail,
        clientName: null,
      };
    }
  }

  if (scan.clientId) {
    const { data: client } = await admin
      .from("agency_clients")
      .select("name, contact_email")
      .eq("id", scan.clientId)
      .single();
    const clientRow = client as { name?: string; contact_email?: string | null } | null;
    if (clientRow) {
      branding.clientName = clientRow.name ?? null;
      branding.supportEmail = clientRow.contact_email ?? branding.supportEmail;
    }
  }

  return branding;
}

export default async function SharedScanPage({ params }: ShareScanPageProps) {
  const { token } = await params;
  const scan = await getScanBySharedToken(token);
  if (!scan || scan.status !== "completed") notFound();

  const branding = await resolveScanBranding({
    organizationId: scan.organizationId,
    clientId: scan.clientId,
  });
  const logoSrc = safeImageSrc(branding.logoUrl);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ ["--brand" as string]: branding.primaryColor }}>
      <header className="border-b border-gray-800/50" style={{ borderColor: `${branding.primaryColor}30` }}>
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
            style={{ backgroundColor: branding.primaryColor }}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt={branding.name} className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              branding.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{branding.name}</h1>
            <p className="text-xs text-gray-400">
              Compliance scan report{branding.clientName ? ` for ${branding.clientName}` : ""}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-6 shadow-sm shadow-black/20 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white" style={{ color: branding.primaryColor }}>
                {scan.url}
              </h2>
              {scan.summary && <p className="mt-1 text-sm text-gray-400">{scan.summary}</p>}
            </div>
            {scan.score !== null && (
              <div className="shrink-0 text-center">
                <span className={`text-4xl font-bold ${scoreColorClass(scan.score)}`}>{scan.score}</span>
                <p className="text-xs text-gray-500">Compliance Score</p>
              </div>
            )}
          </div>

          {scan.detectedTools.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {scan.detectedTools.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full border border-gray-700 bg-gray-800/50 px-3 py-1 text-xs text-gray-300"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}

          {scan.findings.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-white">Findings</h3>
              {scan.findings.map((f) => {
                const isCritical = f.severity === "critical";
                const isWarning = f.severity === "warning";
                const border = isCritical
                  ? "border-red-500/30"
                  : isWarning
                    ? "border-yellow-500/30"
                    : "border-sky-500/30";
                const text = isCritical ? "text-red-300" : isWarning ? "text-yellow-300" : "text-sky-300";
                const icon = isCritical ? "🚨" : isWarning ? "⚠️" : "ℹ️";
                return (
                  <div key={f.id} className={`rounded-lg border ${border} bg-gray-800/50 p-3`}>
                    <p className={`text-xs font-medium ${text}`}>
                      {icon} {f.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">{f.detail}</p>
                    {f.recommendation && <p className="mt-1 text-xs text-gray-500">Fix: {f.recommendation}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
          {branding.supportEmail && (
            <p className="text-center text-xs text-gray-500 sm:text-left">
              Questions?{" "}
              <a href={`mailto:${branding.supportEmail}`} className="underline hover:text-gray-300">
                {branding.supportEmail}
              </a>
            </p>
          )}
          <button
            type="button"
            onClick={() => (typeof window !== "undefined" ? window.print() : undefined)}
            className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white"
          >
            Print report
          </button>
        </div>
      </main>
    </div>
  );
}
