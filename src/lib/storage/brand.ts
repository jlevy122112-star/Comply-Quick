import { createClient } from "@/lib/supabase/client";

export const BRAND_LOGO_BUCKET = "brand-logos";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] as const;

export type LogoUploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Human-readable client-side validation before we bother hitting storage. */
export function validateLogoFile(file: File): string | null {
  if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    return "Use a PNG, JPG, SVG, or WebP image.";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Image must be 2 MB or smaller.";
  }
  return null;
}

function extensionFor(file: File): string {
  const fromType: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
    "image/webp": "webp",
  };
  return fromType[file.type] ?? "png";
}

/**
 * Uploads a brand logo to the public `brand-logos` bucket under the user's own
 * uid folder and returns its public URL. Requires an authenticated session
 * (RLS restricts writes to the caller's own folder). Overwrites any prior logo
 * for the user so the URL stays stable.
 */
export async function uploadBrandLogo(userId: string, file: File): Promise<LogoUploadResult> {
  const validationError = validateLogoFile(file);
  if (validationError) return { ok: false, error: validationError };

  const supabase = createClient();
  const path = `${userId}/logo.${extensionFor(file)}`;

  const { error } = await supabase.storage.from(BRAND_LOGO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(BRAND_LOGO_BUCKET).getPublicUrl(path);
  // Cache-bust so a re-upload to the same path shows immediately.
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}
