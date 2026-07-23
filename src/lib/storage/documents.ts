// Direct document upload and evidence pipeline.
//
// Stores project-level documents in the private `project-documents` storage
// bucket and records them in the public.project_documents table. All access is
// gated by project membership through RLS.

import { createClient } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const PROJECT_DOCUMENTS_BUCKET = "project-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string;
  url?: string;
}

interface DocumentRow {
  id: string;
  project_id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
}

function mapRow(row: DocumentRow): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    storagePath: row.storage_path,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

export function validateDocumentFile(file: File): string | null {
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    return "Unsupported file type. Upload PDF, Word, text, markdown, or images.";
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "File must be 10 MB or smaller.";
  }
  return null;
}

export async function listProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_documents")
    .select("id, project_id, name, storage_path, size_bytes, mime_type, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  const docs = (data as DocumentRow[]).map(mapRow);
  const { data: signedData } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).createSignedUrls(
    docs.map((d) => d.storagePath),
    60 * 60 // 1 hour
  );
  const urlsByPath = new Map<string, string>();
  if (signedData) {
    for (const item of signedData) {
      if (item.path && item.signedUrl) urlsByPath.set(item.path, item.signedUrl);
    }
  }
  return docs.map((d) => ({ ...d, url: urlsByPath.get(d.storagePath) }));
}

export async function uploadProjectDocument(
  projectId: string,
  file: File
): Promise<{ ok: true; document: ProjectDocument } | { ok: false; error: string }> {
  const validationError = validateDocumentFile(file);
  if (validationError) return { ok: false, error: validationError };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${projectId}/${Date.now()}-${sanitized}`;

  const { error: uploadError } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error: insertError } = await supabase
    .from("project_documents")
    .insert({
      project_id: projectId,
      uploaded_by: user.id,
      name: file.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type,
    })
    .select("id, project_id, name, storage_path, size_bytes, mime_type, created_at")
    .single();
  if (insertError || !data) {
    // Best-effort cleanup
    await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([path]);
    return { ok: false, error: insertError?.message ?? "Could not record document." };
  }

  return { ok: true, document: mapRow(data as DocumentRow) };
}

export async function deleteProjectDocument(documentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Sign in required." };

  // Use admin to read the document (RLS would still allow owner/project owner),
  // then remove from storage and table.
  const admin = createAdminClient();
  const { data: doc, error: findError } = await admin
    .from("project_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .single();
  if (findError || !doc) return { ok: false, error: "Document not found." };

  const row = doc as { storage_path: string };
  await admin.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([row.storage_path]);
  const { error: deleteError } = await admin.from("project_documents").delete().eq("id", documentId);
  if (deleteError) return { ok: false, error: deleteError.message };
  return { ok: true };
}
