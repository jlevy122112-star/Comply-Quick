"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";
import { Input, Select } from "@/components/ui/Field";
import { uploadBrandLogo, uploadBrandFavicon, validateLogoFile } from "@/lib/storage/brand";
import { createClient } from "@/lib/supabase/client";
import { type ThemePalette, THEME_PALETTES, type Organization } from "@/lib/organizations";
import { getPaletteClasses } from "@/lib/theme";
import { updateOrganizationBrandingAction, updateOrganizationSmtpAction } from "./actions";

function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function WhiteLabelPanel({ org, canManage }: { org: Organization; canManage: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [logoUrl, setLogoUrl] = useState<string | null>(org.logoUrl);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(org.faviconUrl);
  const [palette, setPalette] = useState<ThemePalette>(org.themePalette);
  const [primaryColor, setPrimaryColor] = useState(org.primaryColor);
  const [supportEmail, setSupportEmail] = useState(org.supportEmail ?? "");
  const [smtpFrom, setSmtpFrom] = useState(org.smtpFromEmail ?? "");
  const [smtpReplyTo, setSmtpReplyTo] = useState(org.smtpReplyToEmail ?? "");

  const [busyBrand, setBusyBrand] = useState(false);
  const [busySmtp, setBusySmtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const paletteClasses = useMemo(() => getPaletteClasses(palette), [palette]);

  const handleUpload = useCallback(
    async (file: File | null, type: "logo" | "favicon") => {
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
      const uploader = type === "logo" ? uploadBrandLogo : uploadBrandFavicon;
      const res = await uploader(user.id, file);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (type === "logo") setLogoUrl(res.url);
      else setFaviconUrl(res.url);
    },
    [supabase]
  );

  async function saveBrand() {
    setError(null);
    setSuccess(null);
    if (!isValidHex(primaryColor.trim())) {
      setError("Primary color must be a 6-digit hex code like #4f46e5.");
      return;
    }
    const support = supportEmail.trim() || null;
    if (support && !isValidEmail(support)) {
      setError("Support email is invalid.");
      return;
    }
    setBusyBrand(true);
    const res = await updateOrganizationBrandingAction(org.id, {
      logoUrl,
      faviconUrl,
      primaryColor: primaryColor.trim(),
      themePalette: palette,
      supportEmail: support,
    });
    setBusyBrand(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess("Brand settings saved.");
    router.refresh();
  }

  async function saveSmtp() {
    setError(null);
    setSuccess(null);
    const from = smtpFrom.trim() || null;
    const replyTo = smtpReplyTo.trim() || null;
    if (from && !isValidEmail(from)) {
      setError("From email is invalid.");
      return;
    }
    if (replyTo && !isValidEmail(replyTo)) {
      setError("Reply-To email is invalid.");
      return;
    }
    setBusySmtp(true);
    const res = await updateOrganizationSmtpAction(org.id, { smtpFromEmail: from, smtpReplyToEmail: replyTo });
    setBusySmtp(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess("Email settings saved.");
    router.refresh();
  }

  const previewStyle = { backgroundColor: primaryColor };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Brand & Appearance" description="Make Comply-Quick feel like your organization." />
        <CardBody>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Logo */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-300">Organization logo</label>
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo preview" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs text-gray-600">No logo</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Upload logo
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canManage}
                      onClick={() => setLogoUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  void handleUpload(e.target.files?.[0] ?? null, "logo");
                  e.currentTarget.value = "";
                }}
              />
              <p className="mt-2 text-xs text-gray-500">PNG, JPG, or WebP up to 2 MB.</p>
            </div>

            {/* Favicon */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-300">Favicon</label>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-700 bg-gray-950">
                  {faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={faviconUrl} alt="Favicon preview" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-600">ICO</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!canManage}
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    Upload favicon
                  </Button>
                  {faviconUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canManage}
                      onClick={() => setFaviconUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={faviconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/x-icon,image/ico"
                className="hidden"
                onChange={(e) => {
                  void handleUpload(e.target.files?.[0] ?? null, "favicon");
                  e.currentTarget.value = "";
                }}
              />
              <p className="mt-2 text-xs text-gray-500">Recommended: 32×32 or 180×180, square.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Select
              label="Theme Palette"
              value={palette}
              disabled={!canManage}
              onChange={(e) => setPalette(e.target.value as ThemePalette)}
            >
              {THEME_PALETTES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
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

            <Input
              label="Support Email"
              type="email"
              value={supportEmail}
              disabled={!canManage}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@company.com"
            />
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
            <p className="text-xs text-gray-500">Changes apply to your dashboard and public-facing pages.</p>
            <Button type="button" disabled={!canManage || busyBrand} loading={busyBrand} onClick={saveBrand}>
              Save brand
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Live Preview" description="How the branded experience appears to users." />
        <CardBody>
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
                  style={previewStyle}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    org.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="font-semibold text-white">{org.name}</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${paletteClasses.badgeBg} ${paletteClasses.badgeText}`}
              >
                {palette}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white">Compliance, Simplified</h3>
            <p className="mt-1 text-sm text-gray-400">Your brand colors, logo, and support email in one place.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${paletteClasses.button} ${paletteClasses.buttonHover}`}
              >
                Primary action
              </button>
              <button
                type="button"
                className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600"
              >
                Secondary action
              </button>
            </div>
            {supportEmail && (
              <p className="mt-4 text-xs text-gray-500">
                Questions?{" "}
                <a href={`mailto:${supportEmail}`} className="underline hover:text-gray-300">
                  {supportEmail}
                </a>
              </p>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Outbound Email"
          description="Use your own sender address for transactional emails sent by this organization."
        />
        <CardBody>
          <div className="grid gap-6 lg:grid-cols-2">
            <Input
              label="From Email"
              type="email"
              value={smtpFrom}
              disabled={!canManage}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="noreply@company.com"
            />
            <Input
              label="Reply-To Email"
              type="email"
              value={smtpReplyTo}
              disabled={!canManage}
              onChange={(e) => setSmtpReplyTo(e.target.value)}
              placeholder="support@company.com"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            The address must be verified in your Resend account before emails will deliver.
          </p>
          <div className="mt-4 flex justify-end border-t border-gray-800 pt-4">
            <Button type="button" disabled={!canManage || busySmtp} loading={busySmtp} onClick={saveSmtp}>
              Save email settings
            </Button>
          </div>
        </CardBody>
      </Card>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {success && <p className="text-sm text-emerald-400">{success}</p>}
    </div>
  );
}
