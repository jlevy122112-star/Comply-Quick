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

function loginError(message: string, mode: "signin" | "signup") {
  redirect(`/login?mode=${mode}&error=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = await safeInternalPath(formData.get("redirect"));

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) loginError(error.message, "signin");

  redirect(redirectTo);
}

export async function signupAction(formData: FormData) {
  const supabase = await createClient();
  const fullName = String(formData.get("fullName") ?? "");
  const companyName = String(formData.get("companyName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const redirectTo = await safeInternalPath(formData.get("redirect"));

  if (password.length < 8) loginError("Password must be at least 8 characters.", "signup");
  if (password !== confirmPassword) loginError("Passwords don't match.", "signup");

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

  if (error) loginError(error.message, "signup");
  if (data.session && data.user) redirect(redirectTo);

  redirect(`/login?mode=signin&notice=confirm&email=${encodeURIComponent(email)}`);
}
