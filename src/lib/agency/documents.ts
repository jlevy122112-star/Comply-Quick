// Agency/Enterprise white-label custom documents service.
//
// Reads/writes go through the RLS-scoped client. Agency members can list, create,
// update, brand per client, share publicly, and email documents to clients.

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "node:crypto";
import { validateDocumentFile } from "@/lib/storage/documents";

export type AgencyDocumentStatus = "draft" | "active" | "archived";

export interface AgencyDocument {
  id: string;
  agencyId: string;
  clientId: string | null;
  name: string;
  regulationName: string | null;
  summary: string | null;
  content: string | null;
  status: AgencyDocumentStatus;
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  sharedToken: string | null;
  sharedAt: string | null;
  emailedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgencyDocumentInput {
  agencyId: string;
  clientId?: string | null;
  name: string;
  regulationName?: string;
  summary?: string;
  content?: string;
  status?: AgencyDocumentStatus;
}

const DOC_COLUMNS = "id, agency_id, client_id, name, regulation_name, summary, content, status, storage_path, mime_type, size_bytes, uploaded_by, shared_token, shared_at, emailed_at, created_at, updated_at";

const AGENCY_DOCUMENTS_BUCKET = "agency-documents";

function mapDoc(row: Record<string, unknown>): AgencyDocument {
  return {
    id: row.id as string,
    agencyId: row.agency_id as string,
    clientId: (row.client_id as string | null) ?? null,
    name: row.name as string,
    regulationName: (row.regulation_name as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    content: (row.content as string | null) ?? null,
    status: (row.status as AgencyDocumentStatus) ?? "draft",
    storagePath: (row.storage_path as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    sizeBytes: (row.size_bytes as number | null) ?? null,
    uploadedBy: (row.uploaded_by as string | null) ?? null,
    sharedToken: (row.shared_token as string | null) ?? null,
    sharedAt: (row.shared_at as string | null) ?? null,
    emailedAt: (row.emailed_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listAgencyDocuments(agencyId: string): Promise<AgencyDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agency_documents")
    .select(DOC_COLUMNS)
    .eq("agency_id", agencyId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Failed to list agency documents:", error);
    return [];
  }

  return (data ?? []).map((row) => mapDoc(row));
}

export async function getAgencyDocumentBySharedToken(token: string): Promise<AgencyDocument | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agency_documents")
    .select(DOC_COLUMNS)
    .eq("shared_token", token)
    .single();
  if (error || !data) return null;
  return mapDoc(data);
}

export async function createAgencyDocument(
  input: CreateAgencyDocumentInput
): Promise<{ ok: true; document: AgencyDocument } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("agency_documents")
    .insert({
      agency_id: input.agencyId,
      client_id: input.clientId ?? null,
      name: input.name,
      regulation_name: input.regulationName ?? null,
      summary: input.summary ?? null,
      content: input.content ?? null,
      status: input.status ?? "draft",
    })
    .select(DOC_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }

  return { ok: true, document: mapDoc(data) };
}

export async function updateAgencyDocument(
  id: string,
  input: Partial<
    Pick<CreateAgencyDocumentInput, "name" | "clientId" | "regulationName" | "summary" | "content" | "status">
  >
): Promise<{ ok: true; document: AgencyDocument } | { ok: false; error: string }> {
  const supabase = createClient();
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.clientId !== undefined) updates.client_id = input.clientId ?? null;
  if (input.regulationName !== undefined) updates.regulation_name = input.regulationName ?? null;
  if (input.summary !== undefined) updates.summary = input.summary ?? null;
  if (input.content !== undefined) updates.content = input.content ?? null;
  if (input.status !== undefined) updates.status = input.status;

  const { data, error } = await supabase
    .from("agency_documents")
    .update(updates)
    .eq("id", id)
    .select(DOC_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Update failed" };
  }

  return { ok: true, document: mapDoc(data) };
}

export async function getAgencyDocumentSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(AGENCY_DOCUMENTS_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? "Could not create signed URL." };
  return { ok: true, url: data.signedUrl };
}

export async function uploadAgencyDocumentFile(
  agencyId: string,
  file: File,
  options: { clientId?: string | null; name?: string } = {}
): Promise<{ ok: true; document: AgencyDocument } | { ok: false; error: string }> {
  const validationError = validateDocumentFile(file);
  if (validationError) return { ok: false, error: validationError };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${agencyId}/${Date.now()}-${sanitized}`;

  const { error: uploadError } = await supabase.storage.from(AGENCY_DOCUMENTS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error: insertError } = await supabase
    .from("agency_documents")
    .insert({
      agency_id: agencyId,
      client_id: options.clientId ?? null,
      name: options.name?.trim() || file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
      status: "draft",
    })
    .select(DOC_COLUMNS)
    .single();

  if (insertError || !data) {
    await supabase.storage.from(AGENCY_DOCUMENTS_BUCKET).remove([path]);
    return { ok: false, error: insertError?.message ?? "Could not record document." };
  }

  return { ok: true, document: mapDoc(data) };
}

export async function deleteAgencyDocument(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Sign in required." };

  const admin = createAdminClient();
  const { data: doc, error: findError } = await admin
    .from("agency_documents")
    .select("id, storage_path")
    .eq("id", id)
    .single();
  if (findError || !doc) return { ok: false, error: "Document not found." };

  const { error: deleteError } = await supabase.from("agency_documents").delete().eq("id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  const row = doc as { storage_path?: string | null };
  if (row.storage_path) {
    await admin.storage.from(AGENCY_DOCUMENTS_BUCKET).remove([row.storage_path]);
  }
  return { ok: true };
}

function makeShareToken(): string {
  return `doc_${randomBytes(16).toString("hex")}`;
}

export async function shareAgencyDocument(
  id: string
): Promise<{ ok: true; token: string; url: string } | { ok: false; error: string }> {
  const supabase = createClient();
  const token = makeShareToken();
  const { data, error } = await supabase
    .from("agency_documents")
    .update({ shared_token: token, shared_at: new Date().toISOString() })
    .eq("id", id)
    .select(DOC_COLUMNS)
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not share document" };

  const host = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${host}/share/documents/${token}`;
  return { ok: true, token, url };
}

export async function unshareAgencyDocument(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("agency_documents")
    .update({ shared_token: null, shared_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markDocumentEmailed(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("agency_documents").update({ emailed_at: new Date().toISOString() }).eq("id", id);
}
