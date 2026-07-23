"use server";

import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email/send";
import { shareAgencyDocument, markDocumentEmailed } from "@/lib/agency/documents";

export async function emailDocumentToClient(documentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  // Load the document and the associated client/organization details. RLS ensures
  // the caller is a member of the owning agency.
  const { data: doc, error: docError } = await supabase
    .from("agency_documents")
    .select("id, agency_id, client_id, name")
    .eq("id", documentId)
    .single();
  if (docError || !doc) return { ok: false, error: "Document not found." };

  const document = doc as { id: string; agency_id: string; client_id: string | null; name: string };
  if (!document.client_id) return { ok: false, error: "Assign a client before emailing." };

  const { data: client } = await supabase
    .from("agency_clients")
    .select("name, contact_email, organization_id")
    .eq("id", document.client_id)
    .single();
  const clientRow = client as { name?: string; contact_email?: string | null; organization_id?: string | null } | null;
  if (!clientRow?.contact_email) return { ok: false, error: "Client has no contact email." };

  const to = clientRow.contact_email;

  // Resolve sender/branding info from the agency.
  const { data: agency } = await supabase
    .from("agencies")
    .select("name, support_email")
    .eq("id", document.agency_id)
    .single();
  const agencyRow = agency as { name?: string; support_email?: string | null } | null;
  const fromName = agencyRow?.name ?? "Comply-Quick";
  const replyTo = agencyRow?.support_email ?? undefined;

  // Ensure a share link exists.
  let shareUrl: string | null = null;
  const { data: existing } = await supabase
    .from("agency_documents")
    .select("shared_token")
    .eq("id", documentId)
    .single();
  if (existing && (existing as { shared_token?: string } | null)?.shared_token) {
    shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/share/documents/${(existing as { shared_token: string }).shared_token}`;
  } else {
    const shared = await shareAgencyDocument(documentId);
    if (!shared.ok) return { ok: false, error: shared.error };
    shareUrl = shared.url;
  }

  const subject = `${document.name} from ${fromName}`;
  const html = `
    <p>Hi ${clientRow.name ?? "there"},</p>
    <p>${fromName} has shared <strong>${document.name}</strong> with you.</p>
    <p><a href="${shareUrl}" style="color:#4f46e5">View document</a></p>
    <p>—<br>${fromName}</p>
  `;
  const text = `Hi ${clientRow.name ?? "there"},\n\n${fromName} has shared "${document.name}" with you.\n\nView: ${shareUrl}\n\n— ${fromName}`;

  const result = await sendTransactionalEmail({ to, subject, html, text, replyTo });
  if (!result.delivered) {
    return { ok: false, error: result.reason ?? "Email could not be sent." };
  }

  await markDocumentEmailed(documentId);
  return { ok: true };
}
