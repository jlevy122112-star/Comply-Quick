import { createClient } from "@/lib/supabase/client";

export const BRAND_LOGO_BUCKET = "brand-logos";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
// SVG is intentionally excluded: the bucket is public, and an SVG served from a
// public URL can execute embedded scripts on direct navigation (stored XSS).
export const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type LogoUploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Human-readable client-side validation before we bother hitting storage. */
export function validateLogoFile(file: File): string | null {
  if (!(ALLOWED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    return "Use a PNG, JPG, or WebP image.";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Image must be 2 MB or smaller.";
  }
  return null;
}

/**
 * Uploads a brand logo to the public `brand-logos` bucket under the user's own
 * uid folder and returns its public URL. Requires an authenticated session
 * (RLS restricts writes to the caller's own folder). Uses a single fixed path
 * per user so re-uploading any format overwrites the prior logo (no orphans)
 * and the URL stays stable.
 */
export async function uploadBrandLogo(userId: string, file: File): Promise<LogoUploadResult> {
  const validationError = validateLogoFile(file);
  if (validationError) return { ok: false, error: validationError };

  const supabase = createClient();
  const path = `${userId}/logo`;

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

/** Uploads a favicon to the same public brand-logos bucket under the user's uid. */
export async function uploadBrandFavicon(userId: string, file: File): Promise<LogoUploadResult> {
  const validationError = validateLogoFile(file);
  if (validationError) return { ok: false, error: validationError };

  const supabase = createClient();
  const path = `${userId}/favicon`;

  const { error } = await supabase.storage.from(BRAND_LOGO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) return { ok: false, error: error.message };

  const { data } = supabase.storage.from(BRAND_LOGO_BUCKET).getPublicUrl(path);
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}
