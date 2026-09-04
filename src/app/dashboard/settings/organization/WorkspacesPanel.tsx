"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, EmptyState, Input, Select, Textarea } from "@/components/ui";
import { can, type Role } from "@/lib/rbac";
import type { Workspace } from "@/lib/workspaces-db";
import { THEME_PALETTES, type ThemePalette } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/client";
import { getPaletteClasses } from "@/lib/theme";
import { uploadBrandLogo, validateLogoFile } from "@/lib/storage/brand";
import { createWorkspaceAction, deleteWorkspaceAction, updateWorkspaceBrandingAction } from "./actions";

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function WorkspaceBrandingCard({
  orgId,
  workspace,
  canManage,
}: {
  orgId: string;
  workspace: Workspace;
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [logoUrl, setLogoUrl] = useState<string | null>(workspace.logoUrl);
  const [palette, setPalette] = useState<ThemePalette>(workspace.themePalette);
  const [primaryColor, setPrimaryColor] = useState(workspace.primaryColor);
  const [footerText, setFooterText] = useState(workspace.footerText ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteClasses = useMemo(() => getPaletteClasses(palette), [palette]);

  async function handleUpload(file: File | null) {
    setError(null);
    setSuccess(null);
    if (!file) return;
    const invalid = validateLogoFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in again.");
      return;
    }
    const result = await uploadBrandLogo(user.id, file);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLogoUrl(result.url);
  }

  async function saveBranding() {
    setError(null);
    setSuccess(null);
    if (!isValidHex(primaryColor.trim())) {
      setError("Primary color must be a 6-digit hex code like #4f46e5.");
      return;
    }
    setBusy(true);
    try {
      const result = await updateWorkspaceBrandingAction(orgId, workspace.id, {
        logoUrl,
        primaryColor: primaryColor.trim(),
        themePalette: palette,
        footerText: footerText.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Workspace branding saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Client deliverable branding</h3>
              <p className="mt-1 text-xs text-gray-400">
                White-label this workspace&apos;s exports with its own logo, palette, and footer.
              </p>
            </div>
            <Badge tone="gray">{workspace.slug}</Badge>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={`${workspace.name} logo`} className="h-full w-full object-contain" />
              ) : (
                <span className="text-lg font-bold text-white">{workspace.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={!canManage} onClick={() => inputRef.current?.click()}>
                Upload logo
              </Button>
              {logoUrl && (
                <Button type="button" size="sm" variant="ghost" disabled={!canManage} onClick={() => setLogoUrl(null)}>
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                void handleUpload(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Theme Palette" value={palette} disabled={!canManage} onChange={(e) => setPalette(e.target.value as ThemePalette)}>
              {THEME_PALETTES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry.charAt(0).toUpperCase() + entry.slice(1)}
                </option>
              ))}
            </Select>
            <Input
              label="Primary Color"
              value={primaryColor}
              disabled={!canManage}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#4f46e5"
            />
          </div>

          <Textarea
            label="Footer"
            hint="Shown on client exports and shared deliverables"
            rows={3}
            value={footerText}
            disabled={!canManage}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder={`Prepared by ${workspace.name} with Comply-Quick.`}
          />

          {(error || success) && <p className={`text-xs ${error ? "text-rose-400" : "text-emerald-400"}`}>{error ?? success}</p>}

          <div className="flex justify-end border-t border-gray-800 pt-4">
            <Button type="button" size="sm" disabled={!canManage || busy} loading={busy} onClick={() => void saveBranding()}>
              Save branding
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500">Live preview</p>
          <div className="mt-4 rounded-2xl border border-gray-800 bg-gray-950 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                  ) : (
                    workspace.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{workspace.name}</p>
                  <p className="text-xs text-gray-400">Client-ready compliance report</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${paletteClasses.badgeBg} ${paletteClasses.badgeText}`}>
                {palette}
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <p className="text-sm font-semibold text-white" style={{ color: primaryColor }}>
                Executive summary
              </p>
              <p className="mt-2 text-xs leading-6 text-gray-400">
                Surface the score, critical findings, and regulation-by-regulation next steps in a polished client deliverable.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-200">
                  Critical 2
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
                  Warning 3
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500">{footerText.trim() || `Prepared by ${workspace.name} with Comply-Quick.`}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspacesPanel({ orgId, role, workspaces }: { orgId: string; role: Role; workspaces: Workspace[] }) {
  const router = useRouter();
  const canCreate = can(role, "workspace:create");
  const canDelete = can(role, "workspace:delete");
  const canUpdate = can(role, "workspace:update");

  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError(null);
    try {
      const res = await createWorkspaceAction(orgId, name);
      if (res.ok) {
        setName("");
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(w: Workspace) {
    setBusy(w.id);
    setError(null);
    try {
      const res = await deleteWorkspaceAction(orgId, w.id);
      if (!res.ok) setError(res.error);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {canCreate && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">New Workspace</h2>
            <p className="mt-1 text-sm text-gray-400">
              Workspaces group projects for a team or client engagement inside your organization.
            </p>
            <form onSubmit={create} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-gray-400">Name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. EU Compliance"
                />
              </label>
              <Button type="submit" size="sm" disabled={busy === "new"}>
                {busy === "new" ? "Creating…" : "Create"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </CardBody>
        </Card>
      )}

      {workspaces.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No Workspaces Yet"
          description="Create a workspace to organize projects by team or client."
        />
      ) : (
        <div className="space-y-4">
          {workspaces.map((w) => (
            <div key={w.id} className="rounded-2xl border border-gray-800 bg-gray-900/40 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="truncate text-sm font-medium text-white">{w.name}</span>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {w.projectCount} {w.projectCount === 1 ? "project" : "projects"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="gray">{w.slug}</Badge>
                  {canDelete && (
                    <Button size="sm" variant="ghost" disabled={busy === w.id} onClick={() => remove(w)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {canUpdate && <div className="mt-4"><WorkspaceBrandingCard orgId={orgId} workspace={w} canManage={canUpdate} /></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
