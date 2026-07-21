"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function safeInternalPath(raw: FormDataEntryValue | null): Promise<string> {
  const fallback = "/dashboard/home";
  if (typeof raw !== "string" || !raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  try {
    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const url = new URL(raw, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = await safeInternalPath(formData.get("redirect"));

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(redirectTo);
}

export async function signupAction(
  formData: FormData
): Promise<{ error: string } | { notice: "confirm"; email: string } | void> {
  const supabase = await createClient();
  const fullName = String(formData.get("fullName") ?? "");
  const companyName = String(formData.get("companyName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const redirectTo = await safeInternalPath(formData.get("redirect"));

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords don't match." };

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const emailRedirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}&channel=signup`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
      data: { full_name: fullName.trim() || null, company_name: companyName.trim() || null },
    },
  });

  if (error) return { error: error.message };
  if (data.session && data.user) redirect(redirectTo);

  return { notice: "confirm", email };
}
