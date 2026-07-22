"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, Plus, Pencil, Trash2, Share2, Mail, Eye, Unlink, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Input, Select } from "@/components/ui/Field";
import type { AgencyDocument, AgencyDocumentStatus } from "@/lib/agency/documents";
import type { Agency, AgencyClient } from "@/lib/agency/service";
import {
  listAgencyDocuments,
  createAgencyDocument,
  updateAgencyDocument,
  deleteAgencyDocument,
  shareAgencyDocument,
  unshareAgencyDocument,
  uploadAgencyDocumentFile,
  getAgencyDocumentSignedUrl,
} from "@/lib/agency/documents";
import { emailDocumentToClient } from "@/app/dashboard/agency/actions";

interface DocumentsTabProps {
  agency: Agency;
  clients: AgencyClient[];
  canManage: boolean;
}

const STATUS_TONES: Record<AgencyDocumentStatus, "gray" | "emerald" | "amber"> = {
  draft: "gray",
  active: "emerald",
  archived: "amber",
};

const STATUS_LABELS: Record<AgencyDocumentStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

function safeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentFileRenderer({ document }: { document: AgencyDocument }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!document.storagePath) return;
    let canceled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getAgencyDocumentSignedUrl(document.storagePath as string, 60 * 60);
      if (canceled) return;
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setFileUrl(res.url);
      if (document.mimeType === "text/plain" || document.mimeType === "text/markdown") {
        try {
          const text = await fetch(res.url).then((r) => r.text());
          if (!canceled) setTextContent(text);
        } catch {
          // Fall back to download link
        }
      }
      setLoading(false);
    };

    load().catch((err) => {
      setError(String(err));
      setLoading(false);
    });

    return () => {
      canceled = true;
    };
  }, [document.storagePath, document.mimeType]);

  if (loading) return <p className="text-sm text-gray-500">Loading file…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!fileUrl) return null;

  if (document.mimeType?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fileUrl} alt={document.name} className="mt-6 max-h-96 rounded-lg border border-gray-800 object-contain" />
    );
  }

  if (document.mimeType === "application/pdf") {
    return (
      <div className="mt-6 rounded-lg border border-gray-800 bg-gray-950">
        <iframe src={fileUrl} title={document.name} className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (textContent !== null) {
    return <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{textContent}</p>;
  }

  return (
    <div className="mt-6 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <p className="text-sm text-gray-300">{document.name} · {formatBytes(document.sizeBytes)}</p>
      <a
        href={fileUrl}
        download={document.name}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-400 hover:text-indigo-300"
      >
        Download file
      </a>
    </div>
  );
}

function BrandedDocumentPreview({
  document,
  client,
  agency,
  onClose,
}: {
  document: AgencyDocument;
  client: AgencyClient | undefined;
  agency: Agency;
  onClose: () => void;
}) {
  // The agency/enterprise is the white-label reseller; the document is always
  // branded with their colors, logo, and company name when sent to a customer.
  const brandName = agency.name;
  const brandColor = agency.primaryColor;
  const logoSrc = safeImageSrc(agency.logoUrl);
  const shareUrl = document.sharedToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/documents/${document.sharedToken}`
    : null;
  const recipientText = client ? `Shared with ${client.name}` : "Shared with customer";
  const hasContent = Boolean(document.content || document.storagePath);

  return (
    <Card>
      <CardHeader
        icon={<Eye className="h-5 w-5 text-indigo-400" />}
        title="Branded customer preview"
        description={`How ${brandName} customers see this document. ${recipientText}.`}
        actions={<Button size="sm" variant="secondary" onClick={onClose}>Close</Button>}
      />
      <CardBody>
        <div
          className="rounded-2xl border border-gray-800 bg-gray-950 p-6"
          style={{ ["--brand" as string]: brandColor, borderColor: `${brandColor}30` }}
        >
          <div className="mb-6 flex items-center gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt={brandName} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                brandName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{brandName}</h3>
              <p className="text-xs text-gray-400">Shared compliance document</p>
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-white" style={{ color: brandColor }}>
            {document.name}
          </h2>
          {document.regulationName && <p className="mt-1 text-sm font-medium text-gray-400">{document.regulationName}</p>}
          {document.summary && <p className="mt-4 text-sm text-gray-300">{document.summary}</p>}
          {!hasContent ? (
            <p className="mt-6 text-sm text-gray-500">No content provided.</p>
          ) : document.storagePath ? (
            <DocumentFileRenderer document={document} />
          ) : (
            <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{document.content}</p>
          )}
          {shareUrl && (
            <div className="mt-6 rounded-lg bg-gray-900/50 p-3 text-xs text-gray-400">
              Customer share link: <span className="text-indigo-400">{shareUrl}</span>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

export function DocumentsTab({ agency, clients, canManage }: DocumentsTabProps) {
  const [documents, setDocuments] = useState<AgencyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    clientId: "",
    regulationName: "",
    summary: "",
    content: "",
    status: "draft" as AgencyDocumentStatus,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listAgencyDocuments(agency.id);
    setDocuments(data);
    setLoading(false);
  }, [agency.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resetForm = useCallback(() => {
    setForm({ name: "", clientId: "", regulationName: "", summary: "", content: "", status: "draft" });
    setEditingId(null);
    setError(null);
  }, []);

  const startNew = useCallback(() => {
    resetForm();
    setFormOpen(true);
  }, [resetForm]);

  const startEdit = useCallback((doc: AgencyDocument) => {
    setForm({
      name: doc.name,
      clientId: doc.clientId ?? "",
      regulationName: doc.regulationName ?? "",
      summary: doc.summary ?? "",
      content: doc.content ?? "",
      status: doc.status,
    });
    setEditingId(doc.id);
    setFormOpen(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setFormOpen(false);
    resetForm();
  }, [resetForm]);

  const handleUploadFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setUploading(true);
      setError(null);
      const res = await uploadAgencyDocumentFile(agency.id, file);
      setUploading(false);
      if (!res.ok) {
        setError(res.error);
      } else {
        setDocuments((prev) => [res.document, ...prev]);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [agency.id]
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.name.trim()) return;
      setBusy(true);
      setError(null);

      if (editingId) {
        const res = await updateAgencyDocument(editingId, {
          name: form.name.trim(),
          clientId: form.clientId || undefined,
          regulationName: form.regulationName.trim() || undefined,
          summary: form.summary.trim() || undefined,
          content: form.content.trim() || undefined,
          status: form.status,
        });
        if (!res.ok) {
          setError(res.error);
        } else {
          setDocuments((prev) => prev.map((d) => (d.id === res.document.id ? res.document : d)));
          setFormOpen(false);
          resetForm();
        }
      } else {
        const res = await createAgencyDocument({
          agencyId: agency.id,
          clientId: form.clientId || undefined,
          name: form.name.trim(),
          regulationName: form.regulationName.trim() || undefined,
          summary: form.summary.trim() || undefined,
          content: form.content.trim() || undefined,
          status: form.status,
        });
        if (!res.ok) {
          setError(res.error);
        } else {
          setDocuments((prev) => [res.document, ...prev]);
          setFormOpen(false);
          resetForm();
        }
      }

      setBusy(false);
    },
    [agency.id, editingId, form, resetForm]
  );

  const updateStatus = useCallback(async (doc: AgencyDocument, status: AgencyDocumentStatus) => {
    if (status === doc.status) return;
    setProcessing((prev) => new Set(prev).add(doc.id));
    const res = await updateAgencyDocument(doc.id, { status });
    if (res.ok) {
      setDocuments((prev) => prev.map((d) => (d.id === res.document.id ? res.document : d)));
    } else {
      setError(res.error);
    }
    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(doc.id);
      return next;
    });
  }, []);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm("Delete this document?")) return;
    setProcessing((prev) => new Set(prev).add(id));
    const res = await deleteAgencyDocument(id);
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } else {
      setError(res.error);
    }
    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const [previewDocId, setPreviewDocId] = useState<string | null>(null);

  const handleShare = useCallback(async (doc: AgencyDocument) => {
    setProcessing((prev) => new Set(prev).add(doc.id));
    const res = await shareAgencyDocument(doc.id);
    if (res.ok) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? { ...d, sharedToken: res.token, sharedAt: new Date().toISOString() }
            : d
        )
      );
    } else {
      setError(res.error);
    }
    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(doc.id);
      return next;
    });
  }, []);

  const handleUnshare = useCallback(async (doc: AgencyDocument) => {
    setProcessing((prev) => new Set(prev).add(doc.id));
    const res = await unshareAgencyDocument(doc.id);
    if (res.ok) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, sharedToken: null, sharedAt: null } : d))
      );
    } else {
      setError(res.error);
    }
    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(doc.id);
      return next;
    });
  }, []);

  const handleEmail = useCallback(async (doc: AgencyDocument) => {
    if (!doc.clientId) {
      setError("Assign a client before emailing.");
      return;
    }
    setProcessing((prev) => new Set(prev).add(doc.id));
    const res = await emailDocumentToClient(doc.id);
    if (res.ok) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, emailedAt: new Date().toISOString() } : d))
      );
    } else {
      setError(res.error);
    }
    setProcessing((prev) => {
      const next = new Set(prev);
      next.delete(doc.id);
      return next;
    });
  }, []);

  const clientById = useCallback(
    (id: string | null) => clients.find((c) => c.id === id),
    [clients]
  );

  const previewDocument = documents.find((d) => d.id === previewDocId) || null;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader
          icon={<FileText className="h-5 w-5 text-indigo-400" />}
          title="White-label documents"
          description="Reusable compliance templates and policies you can brand, share, and email to clients."
          actions={
            canManage ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading} disabled={uploading}>
                  <Upload className="h-4 w-4" />
                  Upload file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp"
                  onChange={(e) => handleUploadFile(e.target.files?.[0] ?? null)}
                />
                <Button size="sm" onClick={startNew}>
                  <Plus className="h-4 w-4" />
                  New document
                </Button>
              </div>
            ) : undefined
          }
        />
        <CardBody>
          {loading ? (
            <p className="text-sm text-gray-500">Loading documents…</p>
          ) : documents.length === 0 ? (
            <EmptyState
              icon="📄"
              title="No custom documents"
              description="Create white-label compliance templates and policies for your clients."
              action={
                canManage ? (
                  <Button size="sm" variant="secondary" onClick={startNew}>
                    <Plus className="h-4 w-4" />
                    Add your first document
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Document</TH>
                  <TH>Client</TH>
                  <TH>Regulation</TH>
                  <TH>Status</TH>
                  <TH>Shared</TH>
                  <TH>Emailed</TH>
                  <TH>Updated</TH>
                  {canManage && <TH className="text-right">Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {documents.map((doc) => {
                  const client = clientById(doc.clientId);
                  return (
                    <TR key={doc.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-white">{doc.name}</div>
                          {doc.storagePath && (
                            <Badge tone="gray" className="text-[10px]">
                              {doc.mimeType?.split("/").pop() ?? "file"} · {formatBytes(doc.sizeBytes)}
                            </Badge>
                          )}
                        </div>
                        {doc.summary && <div className="text-xs text-gray-500">{doc.summary}</div>}
                      </TD>
                      <TD>
                        {client ? <Badge tone="sky">{client.name}</Badge> : <span className="text-gray-600">—</span>}
                      </TD>
                      <TD>
                        {doc.regulationName ? (
                          <Badge tone="indigo">{doc.regulationName}</Badge>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </TD>
                      <TD>
                        {canManage ? (
                          <select
                            value={doc.status}
                            disabled={processing.has(doc.id)}
                            onChange={(e) => updateStatus(doc, e.target.value as AgencyDocumentStatus)}
                            className="rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-white focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                          </select>
                        ) : (
                          <Badge tone={STATUS_TONES[doc.status]}>{STATUS_LABELS[doc.status]}</Badge>
                        )}
                      </TD>
                      <TD>
                        {doc.sharedToken ? (
                          <div className="flex items-center gap-2">
                            <Badge tone="emerald">Shared</Badge>
                            <button
                              type="button"
                              onClick={() =>
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/share/documents/${doc.sharedToken}`
                                )
                              }
                              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                            >
                              Copy
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </TD>
                      <TD className="text-xs text-gray-500">
                        {doc.emailedAt ? new Date(doc.emailedAt).toLocaleDateString() : "—"}
                      </TD>
                      <TD className="text-xs text-gray-500">
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TD>
                      {canManage && (
                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(doc)} disabled={processing.has(doc.id)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {doc.sharedToken ? (
                              <Button size="sm" variant="ghost" onClick={() => handleUnshare(doc)} disabled={processing.has(doc.id)} title="Unshare">
                                <Unlink className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => handleShare(doc)} disabled={processing.has(doc.id)} title="Share with customer">
                                <Share2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleEmail(doc)} disabled={processing.has(doc.id)} title="Email to client">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setPreviewDocId(doc.id)} title="Preview">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => remove(doc.id)} disabled={processing.has(doc.id)} title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {formOpen && canManage && (
        <Card>
          <CardHeader
            icon={<FileText className="h-5 w-5 text-indigo-400" />}
            title={editingId ? "Edit document" : "New document"}
            description={editingId ? "Update your white-label document." : "Create a new reusable white-label document."}
          />
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  placeholder="e.g. Privacy Policy"
                />
                <Select
                  label="Client"
                  value={form.clientId}
                  onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                >
                  <option value="">All clients (agency branding)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Regulation / framework"
                  value={form.regulationName}
                  onChange={(e) => setForm((f) => ({ ...f, regulationName: e.target.value }))}
                  placeholder="e.g. GDPR"
                />
                <Select
                  label="Status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AgencyDocumentStatus }))}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </Select>
                <div className="md:col-span-2">
                  <Input
                    label="Summary"
                    value={form.summary}
                    onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    placeholder="Short description shown on client portals"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={5}
                  placeholder="Document body or notes"
                  className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button type="button" variant="secondary" onClick={cancelEdit} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" loading={busy} disabled={busy || !form.name.trim()}>
                  {editingId ? "Save changes" : "Add document"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {previewDocument && (
        <BrandedDocumentPreview
          document={previewDocument}
          client={clientById(previewDocument.clientId)}
          agency={agency}
          onClose={() => setPreviewDocId(null)}
        />
      )}
    </div>
  );
}
