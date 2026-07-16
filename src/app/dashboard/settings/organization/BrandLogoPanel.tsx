"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody } from "@/components/ui";
import { uploadBrandLogo, validateLogoFile } from "@/lib/storage/brand";
import { createClient } from "@/lib/supabase/client";

function safeImageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function BrandLogoPanel() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const previewLogo = safeImageSrc(logoUrl);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted) setLogoUrl(user?.user_metadata?.company_logo_url ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const uploadLogo = useCallback(
    async (file: File | null) => {
      setError(null);
      setSaved(false);
      if (!file) return;
      const invalid = validateLogoFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }

      setUploading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("Please sign in again to upload.");
          return;
        }
        const res = await uploadBrandLogo(user.id, file);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({
          data: { company_logo_url: res.url },
        });
        if (updateError) {
          setError(updateError.message);
          return;
        }
        setLogoUrl(res.url);
        setSaved(true);
      } catch {
        setError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [supabase]
  );

  const removeLogo = useCallback(async () => {
    setError(null);
    setSaved(false);
    setUploading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { company_logo_url: null },
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setLogoUrl(null);
      setSaved(true);
    } catch {
      setError("Could not remove logo. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [supabase]);

  return (
    <Card>
      <CardBody>
        <h2 className="text-sm font-semibold text-white">Company logo</h2>
        <p className="mt-1 text-sm text-gray-400">Upload the logo used for your organization.</p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-700 bg-gray-950">
            {previewLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewLogo} alt="Company logo preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-600">No logo</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload logo
            </Button>
            {logoUrl && (
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={removeLogo}>
                Remove
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                void uploadLogo(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">PNG, JPG, or WebP up to 2 MB.</p>
        {saved && <p className="mt-2 text-xs text-emerald-400">Saved</p>}
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </CardBody>
    </Card>
  );
}
