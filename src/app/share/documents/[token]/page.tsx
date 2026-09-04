import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgencyDocumentBySharedToken } from "@/lib/agency/documents";
import { REPORT_DISCLAIMER } from "@/lib/legal";
import { BrandedDeliverableLayout } from "@/components/client-portal/BrandedDeliverableLayout";
import { defaultDeliverableFooter, type DeliverableBranding } from "@/lib/workspace/branding";

export const dynamic = "force-dynamic";

const AGENCY_DOCUMENTS_BUCKET = "agency-documents";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SharePageProps {
  params: Promise<{ token: string }>;
}

async function resolveBranding(document: {
  agencyId: string;
  clientId: string | null;
}): Promise<DeliverableBranding & { clientName: string | null }> {
  const admin = createAdminClient();

  // The agency/enterprise is the white-label reseller: shared documents always
  // carry their brand, colors, and logo when sent to customers.
  const { data: agency } = await admin
    .from("agencies")
    .select("name, logo_url, primary_color, support_email")
    .eq("id", document.agencyId)
    .single();
  const branding: DeliverableBranding & { clientName: string | null } = {
    name: (agency as { name?: string } | null)?.name ?? "Comply-Quick",
    logoUrl: (agency as { logo_url?: string | null } | null)?.logo_url ?? null,
    primaryColor: (agency as { primary_color?: string } | null)?.primary_color ?? "#4f46e5",
    palette: "indigo",
    supportEmail: (agency as { support_email?: string | null } | null)?.support_email ?? null,
    footerText: defaultDeliverableFooter((agency as { name?: string } | null)?.name ?? "Comply-Quick"),
    clientName: null,
  };

  if (document.clientId) {
    const { data: client } = await admin
      .from("agency_clients")
      .select("name, contact_email")
      .eq("id", document.clientId)
      .single();
    const clientRow = client as { name?: string; contact_email?: string | null } | null;
    if (clientRow) {
      branding.clientName = clientRow.name ?? null;
      branding.supportEmail = clientRow.contact_email ?? branding.supportEmail;
    }
  }

  return branding;
}
export default async function SharedDocumentPage({ params }: SharePageProps) {
  const { token } = await params;
  const document = await getAgencyDocumentBySharedToken(token);
  if (!document || document.status !== "active") notFound();

  const branding = await resolveBranding(document);

  let fileUrl: string | null = null;
  let fileContent: string | null = null;
  if (document.storagePath) {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(AGENCY_DOCUMENTS_BUCKET)
      .createSignedUrl(document.storagePath, 60 * 60);
    if (!error && data?.signedUrl) {
      fileUrl = data.signedUrl;
      if (document.mimeType === "text/plain" || document.mimeType === "text/markdown") {
        try {
          fileContent = await fetch(fileUrl).then((r) => r.text());
        } catch {
          // Fall back to download link
        }
      }
    }
  }

  const hasContent = Boolean(document.content || document.storagePath);

  return (
    <BrandedDeliverableLayout
      brand={branding}
      eyebrow="Shared document"
      title={document.name}
      subtitle={branding.clientName ? `Client deliverable for ${branding.clientName}` : "Branded compliance document"}
      footerNote={REPORT_DISCLAIMER}
    >
      {document.regulationName && <p className="mt-1 text-sm font-medium text-gray-400">{document.regulationName}</p>}
      {document.summary && <p className="mt-4 text-sm text-gray-300">{document.summary}</p>}
      {!hasContent ? (
        <p className="mt-6 text-sm text-gray-500">No content provided.</p>
      ) : document.storagePath ? (
        <div className="mt-6">
          {document.mimeType?.startsWith("image/") && fileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl} alt={document.name} className="max-h-96 rounded-lg border border-gray-800 object-contain" />
          ) : document.mimeType === "application/pdf" && fileUrl ? (
            <div className="rounded-lg border border-gray-800 bg-gray-950">
              <iframe src={fileUrl} title={document.name} className="h-96 w-full rounded-lg" />
            </div>
          ) : fileContent !== null ? (
            <div className="prose prose-invert max-w-none">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{fileContent}</p>
            </div>
          ) : fileUrl ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
              <p className="text-sm text-gray-300">
                {document.name} · {formatBytes(document.sizeBytes)}
              </p>
              <a
                href={fileUrl}
                download={document.name}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300"
              >
                Download file
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-500">File is not available.</p>
          )}
        </div>
      ) : (
        <div className="prose prose-invert mt-6 max-w-none">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{document.content}</p>
        </div>
      )}
    </BrandedDeliverableLayout>
  );
}
