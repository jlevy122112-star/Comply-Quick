import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScanBySharedToken } from "@/lib/scanner/service";
import { REPORT_DISCLAIMER } from "@/lib/legal";
import { BrandedDeliverableLayout } from "@/components/client-portal/BrandedDeliverableLayout";
import { PrintReportButton } from "@/components/client-portal/PrintReportButton";
import { resolveWorkspaceDeliverableBranding, type DeliverableBranding } from "@/lib/workspace/branding";

export const dynamic = "force-dynamic";

interface ShareScanPageProps {
  params: Promise<{ token: string }>;
}

function scoreColorClass(score: number): string {
  return score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
}

async function resolveScanBranding(scan: {
  organizationId: string | null;
  clientId: string | null;
  projectId: string | null;
}): Promise<DeliverableBranding & { clientName: string | null }> {
  const admin = createAdminClient();
  let organization: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    themePalette: DeliverableBranding["palette"];
    supportEmail: string | null;
  } | null = null;
  let workspace: {
    name: string;
    logoUrl: string | null;
    primaryColor: string;
    themePalette: DeliverableBranding["palette"];
    footerText: string | null;
  } | null = null;

  if (scan.organizationId) {
    const { data: org } = await admin
      .from("organizations")
      .select("name, logo_url, primary_color, theme_palette, support_email")
      .eq("id", scan.organizationId)
      .single();
    const orgRow = org as {
      name?: string;
      logo_url?: string | null;
      primary_color?: string;
      theme_palette?: DeliverableBranding["palette"];
      support_email?: string | null;
    } | null;
    if (orgRow) {
      organization = {
        name: orgRow.name ?? "Comply-Quick",
        logoUrl: orgRow.logo_url ?? null,
        primaryColor: orgRow.primary_color ?? "#4f46e5",
        themePalette: orgRow.theme_palette ?? "indigo",
        supportEmail: orgRow.support_email ?? null,
      };
    }
  }

  if (scan.projectId) {
    const { data: project } = await admin
      .from("projects")
      .select("workspace_id")
      .eq("id", scan.projectId)
      .maybeSingle();
    const workspaceId = (project as { workspace_id?: string | null } | null)?.workspace_id ?? null;
    if (workspaceId) {
      const { data: row } = await admin
        .from("workspaces")
        .select("name, logo_url, primary_color, theme_palette, footer_text")
        .eq("id", workspaceId)
        .maybeSingle();
      const workspaceRow = row as {
        name?: string;
        logo_url?: string | null;
        primary_color?: string | null;
        theme_palette?: DeliverableBranding["palette"];
        footer_text?: string | null;
      } | null;
      if (workspaceRow) {
        workspace = {
          name: workspaceRow.name ?? organization?.name ?? "Comply-Quick",
          logoUrl: workspaceRow.logo_url ?? null,
          primaryColor: workspaceRow.primary_color ?? organization?.primaryColor ?? "#4f46e5",
          themePalette: workspaceRow.theme_palette ?? organization?.themePalette ?? "indigo",
          footerText: workspaceRow.footer_text ?? null,
        };
      }
    }
  }

  const branding = resolveWorkspaceDeliverableBranding({ workspace, organization });
  let clientName: string | null = null;

  if (scan.clientId) {
    const { data: client } = await admin
      .from("agency_clients")
      .select("name, contact_email")
      .eq("id", scan.clientId)
      .single();
    const clientRow = client as { name?: string; contact_email?: string | null } | null;
    if (clientRow) {
      clientName = clientRow.name ?? null;
      branding.supportEmail = clientRow.contact_email ?? branding.supportEmail;
    }
  }

  return { ...branding, clientName };
}

export default async function SharedScanPage({ params }: ShareScanPageProps) {
  const { token } = await params;
  const scan = await getScanBySharedToken(token);
  if (!scan || scan.status !== "completed") notFound();
  const completedScan = scan;

  const branding = await resolveScanBranding({
    organizationId: completedScan.organizationId,
    clientId: completedScan.clientId,
    projectId: completedScan.projectId,
  });

  return (
    <BrandedDeliverableLayout
      brand={branding}
      eyebrow="Compliance report"
      title={completedScan.url}
      subtitle={branding.clientName ? `Client deliverable for ${branding.clientName}` : "Branded client deliverable"}
      footerNote={REPORT_DISCLAIMER}
      actions={<PrintReportButton />}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>{completedScan.summary && <p className="mt-1 text-sm text-gray-400">{completedScan.summary}</p>}</div>
        {completedScan.score !== null && (
          <div className="shrink-0 text-center">
            <span className={`text-4xl font-bold ${scoreColorClass(completedScan.score)}`}>{completedScan.score}</span>
            <p className="text-xs text-gray-500">Compliance Score</p>
          </div>
        )}
      </div>

      {completedScan.detectedTools.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {completedScan.detectedTools.map((t) => (
            <span
              key={t.id}
              className="rounded-full border border-gray-700 bg-gray-800/50 px-3 py-1 text-xs text-gray-300"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {completedScan.findings.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-white">Findings</h3>
          {completedScan.findings.map((f) => {
            const isCritical = f.severity === "critical";
            const isWarning = f.severity === "warning";
            const border = isCritical ? "border-red-500/30" : isWarning ? "border-yellow-500/30" : "border-sky-500/30";
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
    </BrandedDeliverableLayout>
  );
}
